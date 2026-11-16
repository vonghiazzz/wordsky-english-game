import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';

const read=relative=>JSON.parse(readFileSync(new URL('../'+relative,import.meta.url),'utf8'));
const plan=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const originalDrafts=read('vocab/cefr-provisional.json').records;
const batch=read('vocab/batches/LIFE-01.json');
const seedKeys=new Set(Object.values(seed).flatMap(rows=>rows.map(row=>row[0].toLocaleLowerCase('en'))));
const oldDraftKeys=new Set(originalDrafts.map(x=>x.english.toLocaleLowerCase('en')));

test('LIFE-01 has 100 real editorial candidates, 4 groups x 25, and no authorization',()=>{
 const r=validateLife1000Candidates({roadmap:plan,seed,drafts:originalDrafts,batch});
 assert.equal(r.batch_id,'LIFE-01');
 assert.equal(r.lexical_candidates,100);
 assert.deepEqual(r.groups.map(x=>[x.group_id,x.count]),[
  ['morning',25],['personal-care',25],['household',25],['evening',25]
 ]);
 assert.equal(r.candidate_import_authorized,false);
 assert.equal(r.production_deployment_authorized,false);
 assert.equal(r.independent_review_completed,false);
 assert.equal(r.all_items_provisional,true);
 assert.equal(Object.keys(seed).length,26,'No new topic created in content PR');
});

test('LIFE-01 does not overlap any original seed, provisional CEFR draft or itself',()=>{
 const en=new Set(),meaning=new Set();
 for(const x of batch.records){
  const k=x.english.normalize('NFKC').trim().toLocaleLowerCase('en');
  const v=x.meaning.normalize('NFKC').trim().toLocaleLowerCase('vi');
  assert.equal(seedKeys.has(k),false,x.english+' already in seed');
  assert.equal(oldDraftKeys.has(k),false,x.english+' already in provisional drafts');
  assert.equal(en.has(k),false,x.english+' duplicate in LIFE-01');
  assert.equal(meaning.has(v),false,x.meaning+' duplicate cue in LIFE-01');
  en.add(k);meaning.add(v);
 }
 assert.equal(en.size,100);
 assert.equal(meaning.size,100);
});

test('LIFE-01 CEFR evidence makes the Oxford headword vs Cambridge sense vs inference distinction',()=>{
 const kinds=batch.records.reduce((out,x)=>{
  out[x.cefr_evidence_kind]=(out[x.cefr_evidence_kind]??0)+1;
  return out;
 },{});
 assert.deepEqual(kinds,{
  headword_pos_label:51,
  exact_sense_label:19,
  contextual_inference:30
 });
 const Oxford='https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf';
 for(const r of batch.records){
  assert.equal(r.review_status,'PROVISIONAL');
  assert.equal(r.part_of_speech.length>0,true);
  assert.ok(r.source_note.length>=50);
  if(r.cefr_evidence_kind==='headword_pos_label'){
   assert.equal(r.source_url,Oxford);
   assert.equal(r.cefr_source_label,r.level);
   assert.match(r.source_note,/headword\/POS/);
  }else{
   assert.ok(r.source_url.startsWith('https://dictionary.cambridge.org/dictionary/english/'));
   assert.equal(r.cefr_source_label,
     r.cefr_evidence_kind==='contextual_inference'?null:r.level);
   if(r.cefr_evidence_kind==='contextual_inference')
    assert.match(r.source_note,/NOT evidence of an explicitly labeled CEFR grade/);
  }
  assert.equal(Object.hasOwn(r,'reviewed_by'),false);
  assert.equal(Object.hasOwn(r,'reviewed_at'),false);
  assert.equal(Object.hasOwn(r,'approved_by'),false);
 }
});

test('LIFE-01 CEFR labels retain higher difficulty when source says so',()=>{
 const levels=batch.records.reduce((out,r)=>{
  out[r.level]=(out[r.level]??0)+1;return out;
 },{});
 assert.deepEqual(levels,{B1:33,A1:23,A2:36,B2:7,C1:1});
 const deodorant=batch.records.find(x=>x.english==='deodorant');
 assert.ok(deodorant);
 assert.equal(deodorant.level,'C1',
  'Do not force Cambridge C1 headword into A1-B2 editorial distribution');
 assert.equal(deodorant.cefr_evidence_kind,'exact_sense_label');
 assert.ok(!batch.records.some(x=>x.review_status==='APPROVED'));
});

test('LIFE-01 source data has original contextual examples and learner-facing translations',()=>{
 for(const c of batch.records){
  assert.match(c.ipa,/^\/[^/]{1,100}\/$/u,c.english+' IPA shape');
  assert.match(c.example,/^[A-Z].+[.!?]$/u,c.english+' example shape');
  assert.match(c.translation,/^[^\s].+[.!?]$/u,c.english+' translation shape');
  assert.equal(c.english.length<=160,true);
  assert.equal(c.meaning.length<=240,true);
  assert.ok(!/[<>]/u.test(c.example));
 }
});

test('LIFE-01 has no hidden answer list, account data or gameplay activation',()=>{
 const forbidden=['approved_answers','accepted_answers','reviewed_by','reviewed_at',
  'account_id','user_id','srs_state','due_at','enabled','active','game_mode','session_id'];
 for(const record of batch.records){
  for(const key of forbidden)assert.equal(Object.hasOwn(record,key),false,
   record.english+' should not contain '+key);
 }
 assert.equal(batch.status,'DRAFT');
 assert.equal(Object.keys(batch).sort().join(','),'batch_id,records,status');
});
