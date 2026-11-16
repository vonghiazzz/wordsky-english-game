import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const roadmap=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const drafts=read('vocab/cefr-provisional.json').records;
const prior=[1,2,3,4,5].flatMap(n=>read('vocab/batches/LIFE-0'+n+'.json').records);
const batch=read('vocab/batches/LIFE-06.json');
const norm=(s,lang)=>String(s).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase(lang);

test('LIFE-06 has exactly 100 everyday commute, directions, bookings and disruption candidates',()=>{
 const out=validateLife1000Candidates({roadmap,seed,drafts,priorRecords:prior,batch});
 assert.equal(out.batch_id,'LIFE-06');
 assert.equal(out.lexical_candidates,100);
 assert.deepEqual(out.groups.map(g=>[g.group_id,g.count]),[
  ['commute',25],['navigation',25],['bookings',25],['disruptions',25]
 ]);
 assert.equal(batch.status,'DRAFT');
 assert.equal(out.all_items_provisional,true);
 assert.equal(out.independent_review_completed,false);
 assert.equal(out.candidate_import_authorized,false);
 assert.equal(out.production_deployment_authorized,false);
});

test('LIFE-06 uses existing 26 catalog topics only and does not provision database topics',()=>{
 const intended={
  commute:'Transport - Di chuyển',
  navigation:'Directions - Chỉ đường',
  bookings:'Travel - Du lịch',
  disruptions:'Travel - Du lịch'
 };
 const topicCount={};
 for(const r of batch.records){
  assert.equal(r.topic,intended[r.group_id],r.english);
  assert.equal(Object.hasOwn(seed,r.topic),true,r.topic+' must be existing seed topic');
  topicCount[r.topic]=(topicCount[r.topic]||0)+1;
  assert.equal(r.review_status,'PROVISIONAL');
 }
 assert.deepEqual(topicCount,{
  'Transport - Di chuyển':25,'Directions - Chỉ đường':25,'Travel - Du lịch':50
 });
});

test('LIFE-06 does not duplicate normalized English or Vietnamese cue strings across six batches',()=>{
 const previous=[
  ...Object.values(seed).flatMap(rows=>rows.map(r=>({english:r[0],meaning:r[2]}))),
  ...drafts,...prior
 ];
 const en=new Set(previous.map(x=>norm(x.english,'en')));
 const vi=new Set(previous.map(x=>norm(x.meaning,'vi')));
 for(const r of batch.records){
  const e=norm(r.english,'en'),v=norm(r.meaning,'vi');
  assert.equal(en.has(e),false,'Duplicate English '+r.english);
  assert.equal(vi.has(v),false,'Duplicate Vietnamese cue '+r.meaning);
  en.add(e);vi.add(v);
 }
 assert.equal(new Set(batch.records.map(x=>norm(x.english,'en'))).size,100);
 assert.equal(new Set(batch.records.map(x=>norm(x.meaning,'vi'))).size,100);
});

test('LIFE-06 preserves 4 matching Cambridge sense labels and 96 explicit inferences',()=>{
 const verified={commute:'C1',fare:'B1',platform:'A2',itinerary:'C1'};
 const types=batch.records.reduce((out,r)=>(out[r.cefr_evidence_kind]=(out[r.cefr_evidence_kind]||0)+1,out),{});
 assert.deepEqual(types,{exact_sense_label:4,contextual_inference:96});
 for(const x of batch.records){
  assert.equal(x.review_status,'PROVISIONAL');
  assert.ok(x.source_note.length>=100);
  assert.match(x.source_note,/(?:human|reviewer|bilingual)/iu);
  if(x.cefr_evidence_kind==='exact_sense_label'){
   assert.equal(Object.hasOwn(verified,x.english),true,x.english);
   assert.equal(x.level,verified[x.english],x.english);
   assert.equal(x.cefr_source_label,x.level);
   assert.equal(x.source_url,'https://dictionary.cambridge.org/dictionary/english/'+x.english);
  }else{
   assert.equal(x.cefr_source_label,null,'No individually assigned source level for '+x.english);
   assert.match(x.source_note,/(?:NOT|not).*(?:individual|certif|assign|CEFR)/u,x.english);
   assert.match(x.source_url,/^https:\/\/learnenglish\.britishcouncil\.org\/free-resources\//u);
  }
 }
});

test('LIFE-06 does not downgrade difficult Cambridge senses to satisfy a quota',()=>{
 assert.deepEqual(batch.records.reduce((acc,r)=>(acc[r.level]=(acc[r.level]||0)+1,acc),{}),{
  C1:2,B1:35,A1:10,A2:46,B2:7
 });
 assert.equal(batch.records.find(x=>x.english==='commute')?.level,'C1');
 assert.equal(batch.records.find(x=>x.english==='platform')?.level,'A2');
 assert.equal(batch.records.find(x=>x.english==='itinerary')?.level,'C1');
 assert.equal(batch.records.find(x=>x.english==='fare')?.level,'B1');
});

test('LIFE-06 has draft examples and IPA, but no reviewers, grading aliases or account data',()=>{
 for(const r of batch.records){
  assert.match(r.ipa,/^\/[^/]{2,170}\/$/u,r.english);
  assert.match(r.example,/^[A-Z].+[.!?]$/u,r.english);
  assert.ok(r.meaning.length>=8,r.english+' meaning');
  assert.ok(r.translation.length>10,r.english+' translation');
  assert.ok(!/[<>]/u.test(r.meaning+r.translation));
  for(const forbidden of [
   'reviewed_by','reviewed_at','approved_by','approved_at',
   'accepted_answers','user_id','account_id','srs_state',
   'game_mode','enabled','published_at','grade'
  ])assert.equal(Object.hasOwn(r,forbidden),false,r.english+' forbidden '+forbidden);
 }
});

test('LIFE-06 cumulative CLI checks all six saved 100-entry batches with no DB writes',()=>{
 const result=spawnSync(process.execPath,['scripts/qa-vocab-life1000.mjs'],{
  cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH}
 });
 assert.equal(result.status,0,result.stderr);
 for(const id of ['01','02','03','04','05','06'])
  assert.match(result.stdout,new RegExp('PROVISIONAL CANDIDATES ONLY.*LIFE-'+id+'\\.json'));
 assert.match(result.stdout,/PASS: 6 saved batch\(es\) structurally checked/);
 assert.match(result.stdout,/"production_deployment_authorized": false/);
});
