import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';

const load=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const roadmap=load('vocab/life-1000-roadmap.json');
const seed=load('db/seed-vocabulary.json');
const drafts=load('vocab/cefr-provisional.json').records;
const prior=[1,2,3,4,5,6].flatMap(n=>load('vocab/batches/LIFE-0'+n+'.json').records);
const batch=load('vocab/batches/LIFE-07.json');
const proposals=load('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const ambiguous=load('vocab/editorial/LIFE-07-answer-ambiguity-review.json');
const high=load('vocab/editorial/LIFE-07-high-risk-review-decisions.json');
const normalize=value=>String(value).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase();

test('LIFE-07 has 100 structurally valid, nonimportable provisional candidates',()=>{
 const out=validateLife1000Candidates({roadmap,seed,drafts,priorRecords:prior,batch});
 assert.equal(batch.batch_id,'LIFE-07');
 assert.equal(batch.status,'DRAFT');
 assert.equal(out.lexical_candidates,100);
 assert.deepEqual(out.groups.map(g=>[g.group_id,g.count]),[
  ['symptoms',25],['pharmacy',25],['habits',25],['wellbeing',25]
 ]);
 assert.equal(out.all_items_provisional,true);
 assert.equal(out.independent_review_completed,false);
 assert.equal(out.candidate_import_authorized,false);
 assert.equal(out.production_deployment_authorized,false);
});

test('LIFE-07 translations, examples, POS and teaching-level estimates do not silently drift',()=>{
 assert.equal(proposals.records.length,100);
 assert.equal(batch.records.length,100);
 const keys=['group_id','topic','english','ipa','meaning','example','translation',
  'part_of_speech','level','review_status','source_url','cefr_evidence_kind',
  'cefr_source_label','source_note'].sort();
 const types={};
 for(let i=0;i<batch.records.length;i++){
  const record=batch.records[i],proposal=proposals.records[i];
  assert.deepEqual(Object.keys(record).sort(),keys,record.english);
  for(const field of ['group_id','english','meaning','example','translation','part_of_speech','source_url'])
   assert.equal(record[field],proposal[field],record.english+' '+field);
  assert.equal(record.level,proposal.proposed_cefr);
  assert.equal(record.cefr_evidence_kind,'contextual_inference');
  assert.equal(record.cefr_source_label,null);
  assert.equal(record.review_status,'PROVISIONAL');
  assert.match(record.ipa,/^\/[^/]{2,170}\/$/u);
  assert.match(record.source_note,/NOT independently verified/u);
  assert.match(record.source_note,/NO APPROVAL OR IMPORT AUTHORIZATION/u);
  types[record.level]=(types[record.level]||0)+1;
 }
 assert.deepEqual(types,{B2:22,A2:29,B1:43,A1:6});
});

test('LIFE-07 does not duplicate older exact English answers or Vietnamese cues',()=>{
 const past=[...Object.values(seed).flatMap(rows=>rows.map(r=>({english:r[0],meaning:r[2]}))),
  ...drafts,...prior];
 const english=new Set(past.map(x=>normalize(x.english)));
 const meaning=new Set(past.map(x=>normalize(x.meaning)));
 for(const word of batch.records){
  const en=normalize(word.english),vi=normalize(word.meaning);
  assert.equal(english.has(en),false,'English collision '+word.english);
  assert.equal(meaning.has(vi),false,'Vietnamese collision '+word.meaning);
  english.add(en);meaning.add(vi);
 }
});

test('LIFE-07 keeps 12 high-risk review items pending and alternative answers disabled',()=>{
 const catalog=new Map(batch.records.map(r=>[r.english,r]));
 const risk=ambiguous.records.filter(r=>r.risk==='HIGH');
 assert.equal(ambiguous.records.length,100);
 assert.equal(risk.length,12);
 assert.equal(high.records.length,12);
 const names=new Set();
 for(let i=0;i<12;i++){
  const item=high.records[i],record=catalog.get(item.english),source=risk[i];
  assert.ok(record,'Missing high-risk expression '+item.english);
  assert.equal(item.english,source.english);
  assert.equal(item.meaning,record.meaning);
  assert.equal(item.group_id,record.group_id);
  assert.ok(!names.has(item.english));
  names.add(item.english);
  assert.equal(item.reviewer_signed_off,false);
  assert.equal(item.gameplay_approved,false);
  assert.deepEqual(item.approved_accepted_answers,[]);
  assert.equal(source.grading_mode,'NOT_AUTHORIZED');
  assert.deepEqual(source.accepted_answers_approved,[]);
  assert.equal(source.review_status,'PENDING_BILINGUAL_REVIEW');
  assert.ok(item.sense_boundary);
  assert.ok(item.non_equivalent_or_unsafe_examples_for_editor.length);
 }
 assert.deepEqual(high.records.filter(r=>r.cefr_conflict_flag).map(r=>r.english),[
  'break out in a rash','ask about side effects'
 ]);
 for(const expression of ['take medicine with food','take medicine on an empty stomach']){
  const example=catalog.get(expression)?.example||'';
  assert.match(example,/^The label says to take medicine/u);
  assert.match(catalog.get(expression).source_note,/NOT independently verified/u);
 }
});

test('LIFE-07 offline CLI checks are read-only and do not assert approval',()=>{
 for(const file of ['scripts/qa-life07-candidate.mjs','scripts/qa-life07-unified.mjs',
  'scripts/qa-life07-answer-ambiguity.mjs','scripts/qa-life07-high-risk.mjs']){
  const result=spawnSync(process.execPath,[file],{
   cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH}
  });
  assert.equal(result.status,0,file+' '+result.stdout+' '+result.stderr);
  assert.match(result.stdout,/PASS/u,file);
 }
});

test('LIFE-07 editorial corrections preserve clear Vietnamese cues and medicine examples',()=>{
 const lookup=new Map(batch.records.map(r=>[r.english,r]));
 const cue={
  'break out in a rash':'Bắt đầu nổi phát ban',
  'have muscle cramps':'Bị chuột rút',
  'show a prescription':'Xuất trình đơn thuốc',
  "make a doctor's appointment":'Đặt lịch hẹn với bác sĩ',
  'take a day to recharge':'Dành một ngày nghỉ ngơi để lấy lại năng lượng',
  'feel at ease':'Cảm thấy thoải mái, yên tâm'
 };
 for(const [expression,meaning] of Object.entries(cue))
  assert.equal(lookup.get(expression)?.meaning,meaning,expression);
 assert.equal(lookup.get('show a prescription')?.example,
  'Please show your prescription when you collect this medicine.');
 assert.equal(lookup.get('pick up a prescription')?.example,
  'I need to pick up my prescription from the pharmacy this afternoon.');
 assert.equal(lookup.get('mention a drug allergy')?.example,
  'I need to mention a drug allergy before my appointment.');
 const recharge=lookup.get('take a day to recharge');
 assert.equal(recharge?.level,'B1');
 assert.equal(recharge?.cefr_source_label,null);
 assert.equal(recharge?.cefr_evidence_kind,'contextual_inference');
 assert.equal(recharge?.source_url,'https://dictionary.cambridge.org/dictionary/english/recharge');
 assert.equal(recharge?.ipa,'/teɪk ə deɪ tə ˌriːˈtʃɑːdʒ/');
 assert.match(recharge?.source_note,/C2.*rest\/relax\/regain-energy/u);
 assert.match(recharge?.source_note,/B1 expression estimate is FLAGGED FOR REVIEW/u);
});
