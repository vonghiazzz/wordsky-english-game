import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const roadmap=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const drafts=read('vocab/cefr-provisional.json').records;
const prior=[1,2,3].flatMap(n=>read('vocab/batches/LIFE-0'+n+'.json').records);
const batch=read('vocab/batches/LIFE-04.json');
const norm=(s,loc)=>String(s).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase(loc);

test('LIFE-04 has exactly 100 unpublished candidates in 4 correct groups of 25',()=>{
 const report=validateLife1000Candidates({roadmap,seed,drafts,priorRecords:prior,batch});
 assert.equal(report.batch_id,'LIFE-04');
 assert.equal(report.lexical_candidates,100);
 assert.deepEqual(report.groups.map(r=>[r.group_id,r.count]),[
  ['ingredients',25],['kitchen',25],['cooking',25],['dining',25]
 ]);
 assert.equal(batch.status,'DRAFT');
 assert.equal(report.all_items_provisional,true);
 assert.equal(report.independent_review_completed,false);
 assert.equal(report.candidate_import_authorized,false);
 assert.equal(report.production_deployment_authorized,false);
 assert.equal(Object.hasOwn(seed,'Cooking & Kitchen - Nấu ăn'),false,
  'Proposed topic must not be silently added to public catalog');
 assert.equal(report.existing_topics_created,false);
});

test('LIFE-04 has no literal English or Vietnamese-cue collisions with all earlier catalog sources',()=>{
 const old=[
  ...Object.values(seed).flatMap(rows=>rows.map(r=>({english:r[0],meaning:r[2]}))),
  ...drafts,...prior
 ];
 const en=new Set(old.map(x=>norm(x.english,'en')));
 const vi=new Set(old.map(x=>norm(x.meaning,'vi')));
 for(const item of batch.records){
  const english=norm(item.english,'en'),cue=norm(item.meaning,'vi');
  assert.equal(en.has(english),false,'Duplicate English: '+item.english);
  assert.equal(vi.has(cue),false,'Repeated literal Vietnamese prompt: '+item.meaning);
  en.add(english);vi.add(cue);
 }
 assert.equal(new Set(batch.records.map(r=>norm(r.english,'en'))).size,100);
 assert.equal(new Set(batch.records.map(r=>norm(r.meaning,'vi'))).size,100);
});

test('LIFE-04 includes 14 independently looked-up Cambridge sense labels, not 86 false certainties',()=>{
 const verified={
  tomato:'A1',onion:'A2',garlic:'A2',carrot:'A2',
  potato:'A1',cucumber:'B1',lettuce:'B1',mushroom:'A2',
  beef:'B1',pork:'B1',turkey:'B1',flour:'B1',salt:'A1',vinegar:'B2'
 };
 const groups=batch.records.reduce((acc,r)=>{
  acc[r.cefr_evidence_kind]=(acc[r.cefr_evidence_kind]||0)+1;return acc;
 },{});
 assert.deepEqual(groups,{exact_sense_label:14,contextual_inference:86});
 for(const r of batch.records){
  assert.equal(r.review_status,'PROVISIONAL');
  assert.ok(r.source_note.length>100,'Missing explanatory source note: '+r.english);
  assert.match(r.source_note,/(?:review|human|editor|bilingual)/iu,r.english);
  if(r.cefr_evidence_kind==='exact_sense_label'){
   assert.equal(Object.hasOwn(verified,r.english),true,r.english);
   assert.equal(r.level,verified[r.english],r.english);
   assert.equal(r.cefr_source_label,r.level,r.english);
   assert.equal(r.source_url,'https://dictionary.cambridge.org/dictionary/english/'+r.english);
  }else{
   assert.equal(r.cefr_source_label,null,'Contextual estimate has no certified CEFR label: '+r.english);
   assert.match(r.source_url,/^https:\/\/learnenglish\.britishcouncil\.org\/free-resources\//);
   assert.match(r.source_note,/(?:NOT|not).*(?:individual|explicit|source-certified|certif|assign|grade)/iu,
    'Inference caveat absent: '+r.english);
  }
 }
});

test('LIFE-04 preserves proposed A1-B2 levels without forging learner CEFR approvals',()=>{
 const levels=batch.records.reduce((out,r)=>(out[r.level]=(out[r.level]||0)+1,out),{});
 assert.deepEqual(levels,{A1:10,A2:39,B1:44,B2:7});
 assert.ok(batch.records.every(r=>r.cefr_source_label===null||r.cefr_source_label===r.level));
 for(const x of batch.records){
  for(const field of ['reviewed_by','reviewed_at','approved_by','approved_at',
   'accepted_answers','account_id','user_id','srs_state','enabled','game_mode'])
   assert.equal(Object.hasOwn(x,field),false,x.english+' '+field);
 }
});

test('LIFE-04 food, kitchen, cooking and restaurant mappings preserve intended topics and usage examples',()=>{
 const targets={
  ingredients:'Food',
  kitchen:'Cooking & Kitchen - Nấu ăn',
  cooking:'Cooking & Kitchen - Nấu ăn',
  dining:'Restaurant - Nhà hàng'
 };
 const topicCounts={};
 for(const x of batch.records){
  assert.equal(x.topic,targets[x.group_id],x.english);
  topicCounts[x.topic]=(topicCounts[x.topic]||0)+1;
  assert.match(x.ipa,/^\/[^/]{2,120}\/$/u,x.english+' IPA');
  assert.match(x.example,/^[A-Z].+[.!?]$/u,x.english+' example');
  assert.ok(x.meaning.length>7,x.english+' meaning');
  assert.ok(x.translation.length>12,x.english+' translation');
  assert.ok(!/[<>]/u.test(x.translation));
 }
 assert.deepEqual(topicCounts,{
  Food:25,'Cooking & Kitchen - Nấu ăn':50,'Restaurant - Nhà hàng':25
 });
});

test('LIFE-04 cumulative offline QA validates at least 4 saved batches without needing DB or secrets',()=>{
 const run=spawnSync(process.execPath,['scripts/qa-vocab-life1000.mjs'],{
  cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH},encoding:'utf8'
 });
 assert.equal(run.status,0,run.stderr);
 for(const n of ['01','02','03','04'])
  assert.match(run.stdout,new RegExp('PROVISIONAL CANDIDATES ONLY.*LIFE-'+n+'\\.json'));
 const count=run.stdout.match(/PASS: (\d+) saved batch\(es\) structurally checked/);
 assert.ok(count);
 assert.ok(Number(count[1])>=4);
 assert.match(run.stdout,/"production_deployment_authorized": false/);
});
