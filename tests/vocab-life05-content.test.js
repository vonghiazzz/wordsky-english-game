import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const roadmap=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const drafts=read('vocab/cefr-provisional.json').records;
const prior=[1,2,3,4].flatMap(n=>read('vocab/batches/LIFE-0'+n+'.json').records);
const batch=read('vocab/batches/LIFE-05.json');
const norm=(s,lang)=>String(s).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase(lang);

test('LIFE-05 contains exactly 100 shopping/payment/returns editorial candidates, 25 in each group',()=>{
 const out=validateLife1000Candidates({roadmap,seed,drafts,priorRecords:prior,batch});
 assert.equal(out.batch_id,'LIFE-05');
 assert.equal(out.lexical_candidates,100);
 assert.deepEqual(out.groups.map(g=>[g.group_id,g.count]),[
  ['shopping',25],['prices',25],['payments',25],['returns',25]
 ]);
 assert.equal(batch.status,'DRAFT');
 assert.equal(out.all_items_provisional,true);
 assert.equal(out.independent_review_completed,false);
 assert.equal(out.candidate_import_authorized,false);
 assert.equal(out.production_deployment_authorized,false);
 assert.equal(Object.hasOwn(seed,'Money & Payments - Thanh toán'),false,
  'Proposed topic must not be implicitly created or enabled');
});

test('LIFE-05 has no exact English entry or Vietnamese cue duplicates across catalog and previous four batches',()=>{
 const existing=[
  ...Object.values(seed).flatMap(rows=>rows.map(r=>({english:r[0],meaning:r[2]}))),
  ...drafts,...prior
 ];
 const en=new Set(existing.map(r=>norm(r.english,'en')));
 const vi=new Set(existing.map(r=>norm(r.meaning,'vi')));
 for(const x of batch.records){
  const key=norm(x.english,'en'),cue=norm(x.meaning,'vi');
  assert.equal(en.has(key),false,'Duplicate English: '+x.english);
  assert.equal(vi.has(cue),false,'Repeated Vietnamese cue: '+x.meaning);
  en.add(key);vi.add(cue);
 }
 assert.equal(new Set(batch.records.map(x=>norm(x.english,'en'))).size,100);
 assert.equal(new Set(batch.records.map(x=>norm(x.meaning,'vi'))).size,100);
});

test('LIFE-05 differentiates Cambridge sense-label from a labeled collocation and 98 inferences',()=>{
 const counts=batch.records.reduce((out,r)=>
  (out[r.cefr_evidence_kind]=(out[r.cefr_evidence_kind]??0)+1,out),{});
 assert.deepEqual(counts,{
  contextual_inference:98,exact_sense_label:1,collocation_in_labeled_sense:1
 });
 const bargain=batch.records.find(x=>x.english==='bargain');
 const offer=batch.records.find(x=>x.english==='special offer');
 assert.equal(bargain?.level,'B1');
 assert.equal(bargain?.cefr_evidence_kind,'exact_sense_label');
 assert.equal(bargain?.cefr_source_label,'B1');
 assert.equal(bargain?.source_url,'https://dictionary.cambridge.org/dictionary/english/bargain');
 assert.equal(offer?.level,'B1');
 assert.equal(offer?.cefr_evidence_kind,'collocation_in_labeled_sense');
 assert.equal(offer?.cefr_source_label,'B1');
 assert.equal(offer?.source_url,'https://dictionary.cambridge.org/dictionary/english/offer');
 for(const x of batch.records){
  assert.equal(x.review_status,'PROVISIONAL');
  assert.ok(x.source_note.length>100,'Evidence note incomplete: '+x.english);
  assert.match(x.source_note,/review|human|editor|sign-off/iu,'No reviewer caveat: '+x.english);
  if(x.cefr_evidence_kind==='contextual_inference'){
   assert.equal(x.cefr_source_label,null,'Unverified CEFR must not impersonate Cambridge: '+x.english);
   assert.match(x.source_note,/(NOT|not).*(individual|verified|certified|certif|designation|CEFR)/u,
    'Missing explicit uncertainty note: '+x.english);
   assert.match(x.source_url,/^https:\/\/learnenglish\.britishcouncil\.org\/free-resources\//u);
  }else{
   assert.equal(x.cefr_source_label,x.level);
   assert.ok(['bargain','special offer'].includes(x.english),'Unexpected direct label');
  }
 }
});

test('LIFE-05 keeps correct topic allocation and does not forge approval or gameplay state',()=>{
 const targets={
  shopping:'Shopping - Mua sắm',
  prices:'Money & Payments - Thanh toán',
  payments:'Money & Payments - Thanh toán',
  returns:'Money & Payments - Thanh toán'
 };
 const topicCounts={};
 for(const x of batch.records){
  assert.equal(x.topic,targets[x.group_id],x.english);
  topicCounts[x.topic]=(topicCounts[x.topic]||0)+1;
  assert.match(x.ipa,/^\/[^/]{2,180}\/$/u,x.english+' draft IPA');
  assert.match(x.example,/^[A-Z].+[.!?]$/u,x.english+' example');
  assert.ok(x.meaning.length>=9,'Missing meaning for '+x.english);
  assert.ok(x.translation.length>10,'Missing translation for '+x.english);
  for(const key of ['reviewed_by','reviewed_at','approved_by','approved_at','accepted_answers',
   'user_id','account_id','srs_state','game_mode','enabled','production_publish'])
   assert.equal(Object.hasOwn(x,key),false,x.english+': forbidden '+key);
 }
 assert.deepEqual(topicCounts,{
  'Shopping - Mua sắm':25,'Money & Payments - Thanh toán':75
 });
 assert.deepEqual(batch.records.reduce((out,r)=>
  (out[r.level]=(out[r.level]??0)+1,out),{}),{A2:37,A1:4,B1:49,B2:10});
});

test('LIFE-05 treats shop dialogue alternatives and consumer complaints as unapproved prompts',()=>{
 const questions=[
  "Do you have this in blue","Can I try this on","I will think about it",
  "request a refund","contact customer service","refund to the original payment method"
 ];
 for(const phrase of questions){
  const r=batch.records.find(x=>x.english===phrase);
  assert.ok(r,'Must include '+phrase);
  assert.equal(r.review_status,'PROVISIONAL');
  assert.equal(Object.hasOwn(r,'accepted_answers'),false);
  assert.equal(Object.hasOwn(r,'reviewed_by'),false);
 }
});

test('LIFE-05 runs five-batch offline gate, including four inherited batches and no external writes',()=>{
 const run=spawnSync(process.execPath,['scripts/qa-vocab-life1000.mjs'],{
  cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH},encoding:'utf8'
 });
 assert.equal(run.status,0,run.stderr);
 for(const n of ['01','02','03','04','05'])
  assert.match(run.stdout,new RegExp('PROVISIONAL CANDIDATES ONLY.*LIFE-'+n+'\\.json'));
 const match=run.stdout.match(/PASS: (\d+) saved batch\(es\) structurally checked/);
 assert.ok(match,'Missing cumulative saved-batch QA summary');
 assert.ok(Number(match[1])>=5,'Five existing batches must remain checked after expansion');
 assert.match(run.stdout,/"production_deployment_authorized": false/);
});
