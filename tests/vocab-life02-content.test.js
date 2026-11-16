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
const norm=s=>String(s).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en');
const normVi=s=>String(s).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const topic='Everyday Conversation - Giao tiếp hằng ngày';

test('LIFE-02 contains exactly 100 new practical conversation candidates, four groups of 25',()=>{
 const out=validateLife1000Candidates({
  roadmap:plan,seed,drafts,priorRecords:life01.records,batch:life02
 });
 assert.equal(out.batch_id,'LIFE-02');
 assert.equal(out.lexical_candidates,100);
 assert.deepEqual(out.groups.map(x=>[x.group_id,x.count]),[
  ['introductions',25],['checking-in',25],['small-talk',25],['requests',25]
 ]);
 assert.ok(life02.records.every(x=>x.topic===topic));
 assert.equal(out.all_items_provisional,true);
 assert.equal(out.independent_review_completed,false);
 assert.equal(out.candidate_import_authorized,false);
 assert.equal(out.production_deployment_authorized,false);
 assert.equal(out.existing_topics_created,false);
 assert.equal(Object.hasOwn(seed,topic),false,'Proposed topic must not be created by a draft');
});

test('LIFE-02 is unique against existing seed, original CEFR drafts, LIFE-01 and itself',()=>{
 const previous=[
  ...Object.values(seed).flatMap(rows=>rows.map(r=>({english:r[0],meaning:r[2]}))),
  ...drafts,
  ...life01.records
 ];
 const eng=new Set(previous.map(r=>norm(r.english)));
 const cues=new Set(previous.map(r=>normVi(r.meaning)));
 for(const r of life02.records){
  const word=norm(r.english),cue=normVi(r.meaning);
  assert.equal(eng.has(word),false,'Duplicate English expression: '+r.english);
  assert.equal(cues.has(cue),false,'Repeated literal Vietnamese recall cue: '+r.meaning);
  eng.add(word);cues.add(cue);
 }
});

test('LIFE-02 records provisional lesson-based CEFR estimates, not fake dictionary labels',()=>{
 assert.deepEqual(
  life02.records.reduce((a,r)=>(a[r.level]=(a[r.level]||0)+1,a),{}),
  {A1:30,A2:49,B1:19,B2:2}
 );
 const sources=new Set([
  'https://learnenglish.britishcouncil.org/free-resources/speaking/a1/meeting-new-people',
  'https://learnenglish.britishcouncil.org/free-resources/speaking/a1/talking-about-where-youre',
  'https://learnenglish.britishcouncil.org/free-resources/speaking/a2/showing-interest',
  'https://learnenglish.britishcouncil.org/free-resources/speaking/a2',
  'https://dictionary.cambridge.org/grammar/british-grammar/requests'
 ]);
 for(const r of life02.records){
  assert.equal(r.review_status,'PROVISIONAL');
  assert.equal(r.cefr_evidence_kind,'contextual_inference');
  assert.equal(r.cefr_source_label,null);
  assert.equal(sources.has(r.source_url),true,'Source URL not part of reviewed reading list: '+r.source_url);
  assert.ok(r.source_note.length>=100,'Missing CEFR evidence caveat: '+r.english);
  assert.ok(/not|NOT/.test(r.source_note),'Missing grade uncertainty: '+r.english);
  assert.match(r.ipa,/^\/[^/]{2,150}\/$/u,r.english+' IPA format');
  assert.match(r.example,/^[A-Z].+[.!?]$/u,r.english+' example');
  assert.ok(r.translation.length>10,r.english+' missing translation');
  for(const forbidden of ['accepted_answers','reviewed_by','reviewed_at','approved_by','enabled','user_id','account_id','srs_state'])
   assert.equal(Object.hasOwn(r,forbidden),false,'Untrusted approval/account state: '+forbidden);
 }
});

test('LIFE-02 is a phrase-learning draft and cannot silently alter recall grading',()=>{
 assert.equal(life02.status,'DRAFT');
 assert.equal(life02.records.find(r=>r.english==='Nice to meet you')?.level,'A1');
 assert.equal(life02.records.find(r=>r.english==='What have you been up to')?.level,'B1');
 assert.equal(life02.records.find(r=>r.english==='Could you help me, please')?.level,'A2');
 assert.equal(life02.records.find(r=>r.english==='I would appreciate your help')?.level,'B2');
 assert.ok(life02.records.every(x=>x.part_of_speech==='question'||
  x.part_of_speech==='polite request'||x.part_of_speech==='conversational phrase'||
  x.part_of_speech==='conversational response'));
 // No changes to gradeRecall, APIs, SRS, or game eligibility in this content PR.
});

test('LIFE-02 CLI automatically validates both LIFE-01 and LIFE-02 without DB/network',()=>{
 const r=spawnSync(process.execPath,['scripts/qa-vocab-life1000.mjs'],{
  cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH},encoding:'utf8'
 });
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/PROVISIONAL CANDIDATES ONLY.*LIFE-01\.json/);
 assert.match(r.stdout,/PROVISIONAL CANDIDATES ONLY.*LIFE-02\.json/);
 const match=r.stdout.match(/PASS: (\d+) saved batch\(es\) structurally checked/);
 assert.ok(match,'Missing offline saved-batch QA summary');
 assert.ok(Number(match[1])>=2,'All previously saved batches must remain checked');
});
