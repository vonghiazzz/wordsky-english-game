import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 recallDraftsEnabled,validateRecallDraft,createRecallDraftService
} from '../lib/ux43e-recall-drafts.js';

const ID=randomUUID(),DRAFT=randomUUID();
const word={id:ID,english:'walk',enabled:true,topic_enabled:true};
const valid=()=>({
 word_id:ID,prompt_vi:'Đi bộ',
 accepted_english:['walk',"walk on foot"],
 answer_revision:'draft-v1',
 admin_password:'TestAdminPassword2026!'
});
const req={headers:{origin:'http://localhost:3000'}};
function harness(actor={role:'admin',id:'owner'}){
 const calls=[],records=[];
 const query=async(statement,params=[])=>{
  calls.push({sql:statement,params});
  if(statement.includes('FROM public.ws_words w')&&statement.includes('FOR SHARE'))
   return {rows:[word]};
  if(statement.includes("count(*)::int AS count FROM public.ws_recall_curated_prompts"))
   return {rows:[{count:records.length}]};
  if(statement.includes("INSERT INTO public.ws_recall_curated_prompts")){
   const row={id:DRAFT,word_id:params[0],prompt_vi:params[1],
    accepted_english:params[2],answer_revision:params[3],
    approved:false,active:false};
   if(records.some(x=>x.word_id===row.word_id&&x.answer_revision===row.answer_revision))
    throw Object.assign(new Error('duplicate'),{code:'23505'});
   records.push(row);return {rows:[row]};
  }
  if(statement.includes('DELETE FROM public.ws_recall_curated_prompts')){
   const index=records.findIndex(x=>x.id===params[0]&&
    x.answer_revision===params[1]&&!x.approved&&!x.active);
   return {rows:index>=0?records.splice(index,1):[]};
  }
  if(statement.includes('count(*)::int AS total'))return {rows:[{total:0}]};
  return {rows:[]};
 };
 const db={query};
 const service=createRecallDraftService({
  db,transaction:async fn=>fn({query}),
  requireAdmin:async()=>actor,
  verifyAdminPassword:async(_admin,password)=>password==='TestAdminPassword2026!',
  expectedOrigin:'http://localhost:3000'
 });
 return {calls,records,service};
}

test('UX43E1 preview gate cannot enable Admin drafts on Production',()=>{
 assert.equal(recallDraftsEnabled({}),false);
 assert.equal(recallDraftsEnabled({WORDSKY_RECALL_PREVIEW_ENABLED:'false'}),false);
 assert.equal(recallDraftsEnabled({VERCEL_ENV:'preview',WORDSKY_RECALL_PREVIEW_ENABLED:'true'}),true);
 assert.equal(recallDraftsEnabled({WORDSKY_RECALL_PREVIEW_ENABLED:'true'}),true);
 assert.equal(recallDraftsEnabled({VERCEL_ENV:'production',WORDSKY_RECALL_PREVIEW_ENABLED:'true'}),false);
});

test('UX43E1 validates trusted enabled catalog, exact answer match and hidden translation',()=>{
 const safe=validateRecallDraft(valid(),word);
 assert.equal(safe.word_id,ID);
 assert.equal(safe.prompt_vi,'Đi bộ');
 assert.deepEqual(safe.accepted_english,['walk','walk on foot']);
 assert.equal('approved' in safe,false);
 assert.equal('active' in safe,false);
 for(const patch of [
  {approved:true},{active:true},{curator:'owner'}, {id:randomUUID()},
  {user_id:randomUUID()}, {word_id:randomUUID()},
  {accepted_english:['wolk']}, {accepted_english:['walk',' WALK ']},
  {accepted_english:['walk.']},{accepted_english:['walk','bad\nline']},
  {prompt_vi:'Đi bộ (walk)'}, {prompt_vi:''},
  {answer_revision:'bad revision #'}, {accepted_english:[]}
 ]){
  assert.throws(()=>validateRecallDraft({...valid(),...patch},word),undefined,
   'Expected rejected input: '+Object.keys(patch).join(','));
 }
 assert.throws(()=>validateRecallDraft(valid(),{...word,enabled:false}),/vô hiệu/);
 assert.throws(()=>validateRecallDraft(valid(),{...word,topic_enabled:false}),/vô hiệu/);
});

test('UX43E1 requires valid admin role, exact Origin and fresh step-up password before any write',async()=>{
 const fake=harness();
 await assert.rejects(()=>harness({role:'player',id:ID}).service.createDraft(req,valid()),e=>e.status===401);
 await assert.rejects(()=>fake.service.createDraft({headers:{}},valid()),e=>e.status===403);
 await assert.rejects(()=>fake.service.createDraft({headers:{origin:'https://evil.invalid'}},valid()),e=>e.status===403);
 await assert.rejects(()=>fake.service.createDraft(req,{...valid(),admin_password:'wrong'}),e=>e.status===403);
 assert.equal(fake.calls.length,0);
 assert.equal(fake.records.length,0);
});

test('UX43E1 draft insert explicitly writes approved=false, active=false and locks quota',async()=>{
 const fake=harness();
 const created=await fake.service.createDraft(req,valid());
 assert.equal(created.draft.approved,false);
 assert.equal(created.draft.active,false);
 assert.equal(created.approval_available,false);
 assert.equal(created.requires_independent_review,true);
 assert.equal(fake.records.length,1);
 const written=fake.calls.find(x=>x.sql.includes('INSERT INTO public.ws_recall_curated_prompts'));
 assert.match(written.sql,/false,false/);
 assert.equal(written.params.includes(valid().admin_password),false);
 assert.ok(fake.calls.some(x=>x.sql.includes('pg_advisory_xact_lock')));
 await assert.rejects(()=>fake.service.createDraft(req,valid()),e=>e.status===409);
 assert.equal(fake.records.length,1);
});

test('UX43E1 only deletes draft with matching revision; never deletes approved/active rows',async()=>{
 const fake=harness();
 await fake.service.createDraft(req,valid());
 await assert.rejects(()=>fake.service.discardDraft(req,DRAFT,{
  confirm_revision:'other',admin_password:valid().admin_password
 }),e=>e.status===409);
 assert.equal(fake.records.length,1);
 fake.records[0].approved=true;
 await assert.rejects(()=>fake.service.discardDraft(req,DRAFT,{
  confirm_revision:valid().answer_revision,admin_password:valid().admin_password
 }),e=>e.status===409);
 assert.equal(fake.records.length,1);
 fake.records[0].approved=false;
 const deleted=await fake.service.discardDraft(req,DRAFT,{
  confirm_revision:valid().answer_revision,admin_password:valid().admin_password
 });
 assert.equal(deleted.deleted_draft,true);
 assert.equal(fake.records.length,0);
 const sql=fake.calls.find(x=>x.sql.includes('DELETE FROM public.ws_recall_curated_prompts')).sql;
 assert.match(sql,/approved=false AND active=false/);
 assert.doesNotMatch(sql,/DELETE FROM public.ws_recall_trials|DELETE FROM public.ws_recall_evidence/);
});

test('UX43E1 public routes and admin UI are fail closed and never offer approval/activation',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const mod=readFileSync(new URL('../lib/ux43e-recall-drafts.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/admin-recall.html',import.meta.url),'utf8');
 const gui=readFileSync(new URL('../public/admin-recall.js',import.meta.url),'utf8');
 assert.match(api,/key\.startsWith\('admin\/recall\/'\)/);
 assert.match(api,/if\(!recallDraftsEnabled\(\)\)/);
 assert.match(api,/curator\.createDraft/);
 assert.match(api,/curator\.discardDraft/);
 assert.match(api,/curator\.listWords/);
 assert.match(api,/curator\.listDrafts/);
 assert.match(mod,/req\?\.headers\?\.origin/);
 assert.match(mod,/verifyAdminPassword/);
 assert.doesNotMatch(mod,/UPDATE public\.ws_recall_curated_prompts|SET approved=true|SET active=true/);
 for(const name of ['rcAuth','rcApp','rcFindWord','rcDraftForm','rcDrafts','rcDeleteDialog'])
  assert.match(html,new RegExp('id="'+name+'"'));
 assert.match(html,/approved=false \/ active=false/);
 assert.match(gui,/data\.approval_available!==false/);
 assert.match(gui,/approved===false&&draft\.active===false/);
 assert.doesNotMatch(gui,/innerHTML|localStorage|sessionStorage|sendBeacon|console\.log/);
 assert.doesNotMatch(gui,/PUT|approved:true|active:true/);
});
