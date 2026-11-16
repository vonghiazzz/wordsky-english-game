import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const plan=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const drafts=read('vocab/cefr-provisional.json').records;
const life01=read('vocab/batches/LIFE-01.json');
const life02=read('vocab/batches/LIFE-02.json');
const batch=read('vocab/batches/LIFE-03.json');
const norm=(s,lang)=>String(s).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase(lang);

test('LIFE-03 delivers 100 FAMILY/SOCIAL/FEELINGS editorial candidates with 25 per group',()=>{
 const out=validateLife1000Candidates({
  roadmap:plan,seed,drafts,priorRecords:[...life01.records,...life02.records],batch
 });
 assert.equal(out.lexical_candidates,100);
 assert.equal(out.batch_id,'LIFE-03');
 assert.deepEqual(out.groups.map(x=>[x.group_id,x.count]),[
  ['family',25],['friendship',25],['gatherings',25],['feelings',25]
 ]);
 assert.equal(out.candidate_import_authorized,false);
 assert.equal(out.production_deployment_authorized,false);
 assert.equal(out.independent_review_completed,false);
 assert.equal(out.existing_topics_created,false);
 assert.equal(batch.status,'DRAFT');
 assert.equal(Object.keys(seed).length,26);
 assert.equal(Object.hasOwn(seed,'Social Relationships - Quan hệ xã hội'),false);
});

test('LIFE-03 has no exact English or Vietnamese cue duplicates with existing and prior batches',()=>{
 const seenEn=new Set(),seenVi=new Set();
 const old=[
  ...Object.values(seed).flatMap(rows=>rows.map(r=>({english:r[0],meaning:r[2]}))),
  ...drafts,...life01.records,...life02.records
 ];
 const en=new Set(old.map(x=>norm(x.english,'en')));
 const vi=new Set(old.map(x=>norm(x.meaning,'vi')));
 for(const r of batch.records){
  const word=norm(r.english,'en'),cue=norm(r.meaning,'vi');
  assert.equal(en.has(word),false,'duplicate English: '+r.english);
  assert.equal(seenEn.has(word),false,'duplicate within batch: '+r.english);
  assert.equal(vi.has(cue),false,'duplicate Vietnamese cue: '+r.meaning);
  assert.equal(seenVi.has(cue),false,'duplicate within batch cue: '+r.meaning);
  seenEn.add(word);seenVi.add(cue);
 }
 assert.equal(seenEn.size,100);
 assert.equal(seenVi.size,100);
});

test('LIFE-03 has 20 source-labeled family nouns and 80 explicitly inferred study levels',()=>{
 const kinds=batch.records.reduce((a,r)=>(a[r.cefr_evidence_kind]=(a[r.cefr_evidence_kind]||0)+1,a),{});
 assert.deepEqual(kinds,{exact_sense_label:20,contextual_inference:80});
 const directlyLabeled={
  grandmother:'A2',grandfather:'A2',grandson:'A2',granddaughter:'A2',
  sibling:'C2',cousin:'A2',niece:'B1',nephew:'B1',husband:'A1',
  wife:'A1',spouse:'C2',parent:'A1',daughter:'A1',son:'A1',
  toddler:'C2',teenager:'A2',adult:'A1',relative:'B1',
  stepmother:'B2',stepfather:'B2'
 };
 const direct=new Set(Object.keys(directlyLabeled));
 for(const r of batch.records){
  assert.equal(r.review_status,'PROVISIONAL');
  assert.match(r.source_note,/review|Reviewer|editor/iu,'missing human-review caveat '+r.english);
  assert.ok(r.source_note.length>=80,'insufficient context '+r.english);
  if(r.cefr_evidence_kind==='exact_sense_label'){
   assert.equal(direct.has(r.english),true,'unsourced direct label '+r.english);
   assert.equal(r.level,directlyLabeled[r.english]);
   assert.equal(r.cefr_source_label,r.level);
   assert.equal(r.source_url,'https://dictionary.cambridge.org/dictionary/english/'+r.english);
  }else{
   assert.equal(r.cefr_source_label,null,'contextual level impersonates source label: '+r.english);
   assert.match(r.source_note,/(NOT|not).*(?:individual|direct|assign|level|label|grade)/u,
    'missing contextual inference warning '+r.english);
  }
 }
});

test('LIFE-03 does not lower authentic Cambridge C2 labels merely to fit an A1-B2 editorial target',()=>{
 const levels=batch.records.reduce((a,r)=>(a[r.level]=(a[r.level]||0)+1,a),{});
 assert.deepEqual(levels,{A2:26,C2:3,B1:43,A1:8,C1:1,B2:19});
 for(const word of ['sibling','spouse','toddler']){
  const item=batch.records.find(r=>r.english===word);
  assert.ok(item);
  assert.equal(item.cefr_evidence_kind,'exact_sense_label');
  assert.equal(item.level,'C2');
 }
 assert.equal(batch.records.find(r=>r.english==='in-law')?.cefr_evidence_kind,'contextual_inference');
 assert.equal(batch.records.find(r=>r.english==='in-law')?.cefr_source_label,null);
});

test('LIFE-03 editorial text is complete, with unapproved UK-style draft IPA and original examples',()=>{
 const groups={
  family:'Family',
  friendship:'Social Relationships - Quan hệ xã hội',
  gatherings:'Social Relationships - Quan hệ xã hội',
  feelings:'Feelings - Cảm xúc'
 };
 for(const record of batch.records){
  assert.equal(record.topic,groups[record.group_id]);
  assert.match(record.ipa,/^\/[^/]{2,150}\/$/u,record.english);
  assert.match(record.example,/^[A-Z].+[.!?]$/u,record.english);
  assert.ok(record.meaning.length>=8);
  assert.ok(record.translation.length>=10);
  assert.equal(Object.hasOwn(record,'reviewed_by'),false);
  assert.equal(Object.hasOwn(record,'reviewed_at'),false);
  for(const prohibited of [
   'accepted_answers','approved_by','approved_at','user_id','account_id',
   'srs_state','game_mode','enabled'
  ])assert.equal(Object.hasOwn(record,prohibited),false,record.english+'/'+prohibited);
 }
});

test('LIFE-03 remains a draft and the offline CLI preflights all 3 batches together',()=>{
 const p=spawnSync(process.execPath,['scripts/qa-vocab-life1000.mjs'],{
  cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH}
 });
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/LIFE-01\.json/);
 assert.match(p.stdout,/LIFE-02\.json/);
 assert.match(p.stdout,/LIFE-03\.json/);
 assert.match(p.stdout,/PASS: 3 saved batch\(es\) structurally checked/);
 assert.match(p.stdout,/"production_deployment_authorized": false/);
});
