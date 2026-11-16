import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {LIFE04_TOPIC_NAME,validateLife04TopicProposal,
 resolveLife04RegistrationTarget,registerInactiveLife04Topic}
 from '../lib/vocab-life04-topic-preview-policy.js';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const roadmap=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const batch=read('vocab/batches/LIFE-04.json');
const copy=v=>JSON.parse(JSON.stringify(v));
const localhost='postgresql://wordsky_test:pass@127.0.0.1:5547/wordsky_v6_test';
const preview='postgresql://preview_editor:pass@isolated-preview.qa-example.net:5432/wordsky_preview_test';

test('LIFE-04 proposal allocates only 50 kitchen/cooking words, never enables or approves any content',()=>{
 const plan=validateLife04TopicProposal(roadmap,seed,batch);
 assert.equal(plan.batch_id,'LIFE-04');
 assert.equal(plan.topic_title,LIFE04_TOPIC_NAME);
 assert.equal(plan.proposed_words,50);
 assert.equal(plan.total_batch_records,100);
 assert.equal(plan.activation,'INACTIVE_ONLY');
 for(const key of ['reviewer_approved','import_authorized','publish_authorized','production_authorized'])
  assert.equal(plan[key],false,key);
 assert.equal(plan.approved_words,0);
 assert.equal(Object.hasOwn(seed,LIFE04_TOPIC_NAME),false);
});

test('LIFE-04 rejects unapproved, renamed, wrongly allocated and reviewer-forged content',()=>{
 const invalids=[
  b=>{b.records[0].review_status='APPROVED'},
  b=>{b.records[0].reviewed_by='made-up'},
  b=>{b.records[0].approved_at='today'},
  b=>{b.records[0].topic=LIFE04_TOPIC_NAME},
  b=>{b.records[26].topic='Food'},
  b=>{b.records[26].cefr_source_label='B1'},
  b=>{b.records[24].group_id='kitchen'},
  b=>{b.records.pop()}
 ];
 for(const mutate of invalids){
  const b=copy(batch);mutate(b);
  assert.throws(()=>validateLife04TopicProposal(roadmap,seed,b),
   /LIFE-04 topic preview/);
 }
 const p=copy(roadmap);
 p.proposed_topics[2].activation='ACTIVE';
 assert.throws(()=>validateLife04TopicProposal(p,seed,batch),/proposed topic/);
 const injected=copy(seed);injected[LIFE04_TOPIC_NAME]=[];
 assert.throws(()=>validateLife04TopicProposal(roadmap,injected,batch),/proposed topic/);
});

test('LIFE-04 dry-run never needs DB secrets and local writes use only isolated QA DB identity',()=>{
 assert.deepEqual(resolveLife04RegistrationTarget([],{}),{mode:'dry-run',mayWrite:false});
 const local=resolveLife04RegistrationTarget(['--write-local-test'],{
  WORDSKY_TEST_DATABASE_URL:localhost
 });
 assert.equal(local.mode,'local-test');
 assert.equal(local.expectedDatabase,'wordsky_v6_test');
 assert.equal(local.expectedRole,'wordsky_test');
 assert.equal(local.mayWrite,true);
 for(const value of [
  'postgresql://wordsky_test:pass@db.example.com:5547/wordsky_v6_test',
  'postgresql://production:pass@127.0.0.1:5547/wordsky_v6_test',
  'postgresql://wordsky_test:pass@localhost:5432/wordsky_v6_test'
 ]){
  assert.throws(()=>resolveLife04RegistrationTarget(['--write-local-test'],{
   WORDSKY_TEST_DATABASE_URL:value
  }),/LIFE-02 topic preview/);
 }
});

test('LIFE-04 Preview mode requires BOTH generic and separate LIFE-04 manual approval',()=>{
 const common={
  WORDSKY_TARGET_ENV:'preview',WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED:'true',
  WORDSKY_LIFE04_TOPIC_WRITE_APPROVED:'true',
  WORDSKY_PREVIEW_DATABASE_URL:preview,
  WORDSKY_PREVIEW_EXPECTED_HOST:'isolated-preview.qa-example.net',
  WORDSKY_PREVIEW_EXPECTED_DB:'wordsky_preview_test',
  WORDSKY_PREVIEW_EXPECTED_ROLE:'preview_editor'
 };
 assert.equal(resolveLife04RegistrationTarget(['--write-preview'],common).mode,'preview');
 for(const overrides of [
  {WORDSKY_LIFE04_TOPIC_WRITE_APPROVED:'false'},
  {WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED:'false'},
  {CI:'true'},
  {VERCEL_ENV:'production'},
  {WORDSKY_TARGET_ENV:'production'},
  {WORDSKY_PREVIEW_EXPECTED_DB:'production'},
  {WORDSKY_PRODUCTION_DATABASE_URL:preview}
 ]){
  assert.throws(()=>resolveLife04RegistrationTarget(['--write-preview'],{
   ...common,...overrides
  }),/topic preview/);
 }
});

const target=resolveLife04RegistrationTarget(['--write-local-test'],{
 WORDSKY_TEST_DATABASE_URL:localhost
});
const plan=validateLife04TopicProposal(roadmap,seed,batch);
function fakeDb({stored=null,wordCount=0,roundCount=0,identityOk=true}={}){
 const state={stored,wordCount,roundCount,calls:[]};
 return {state,async query(sql,params){
  state.calls.push(sql);
  if(sql.startsWith('SELECT current_database()'))return {rows:[{
   db_name:identityOk?'wordsky_v6_test':'production',
   db_role:'wordsky_test'
  }]};
  if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[{}]};
  if(sql.startsWith('SELECT id,title,enabled FROM ws_topics'))
   return {rows:state.stored?[state.stored]:[]};
  if(sql.startsWith('INSERT INTO ws_topics')){
   state.stored={id:'00000000-0000-4000-8000-000000000002',title:LIFE04_TOPIC_NAME,enabled:false};
   return {rows:[state.stored]};
  }
  if(sql.startsWith('SELECT (SELECT count(*)'))
   return {rows:[{words:state.wordCount,rounds:state.roundCount}]};
  throw Error('Unexpected query: '+sql);
 }};
}

test('LIFE-04 registration is disabled-only, idempotent, and refuses dangerous pre-existing rows',async()=>{
 const db=fakeDb();
 const first=await registerInactiveLife04Topic(db,plan,target);
 const second=await registerInactiveLife04Topic(db,plan,target);
 assert.equal(first.action,'created_disabled');
 assert.equal(second.action,'already_disabled');
 assert.equal(first.enabled,false);
 assert.equal(second.topic_id,first.topic_id);
 assert.equal(db.state.calls.filter(x=>x.startsWith('INSERT INTO')).length,1);
 assert.ok(db.state.calls.every(x=>!x.startsWith('UPDATE ')&&!x.startsWith('DELETE ')));
 for(const data of [
  {stored:{id:'bad',title:LIFE04_TOPIC_NAME,enabled:true}},
  {stored:{id:'bad',title:LIFE04_TOPIC_NAME,enabled:false},wordCount:1},
  {stored:{id:'bad',title:LIFE04_TOPIC_NAME,enabled:false},roundCount:1},
  {identityOk:false}
 ]){
  await assert.rejects(registerInactiveLife04Topic(fakeDb(data),plan,target),/LIFE-04 topic preview/);
 }
});

test('LIFE-04 script by default is an offline dry run and never contacts PostgreSQL',()=>{
 const p=spawnSync(process.execPath,['scripts/register-life04-topic.mjs'],{
  cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH}
 });
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/LIFE-04 inactive topic registration/);
 assert.match(p.stdout,/"proposed_topic_words": 50/);
 assert.match(p.stdout,/DRY RUN: no DB connection/);
 assert.doesNotMatch(p.stdout,/postgresql:\/\//);
});
