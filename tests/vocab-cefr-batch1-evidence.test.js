import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const fixture=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const evidence=fixture('vocab/batch1-cefr-evidence.json');
const queue=fixture('vocab/cefr-review-all-topics.json');
const original=fixture('db/seed-vocabulary.json');
const drafts=fixture('vocab/cefr-provisional.json');
const norm=x=>String(x).normalize('NFKC').trim().toLocaleLowerCase('en');
const key=x=>x.topic+'\0'+norm(x.english);
const batch=queue.records.filter(x=>x.verification_scope==='source_lookup_only; no individual bilingual review or approval');
const evidenceByKey=new Map(evidence.records.map(x=>[key(x),x]));
const levels=['A1','A2','B1','B2','C1','C2'];

test('Batch 1 CEFR evidence has exactly 20 unique, sense-anchored, sourced proposed levels',()=>{
 assert.equal(evidence.policy,'academic-cefr-evidence-v1');
 assert.equal(evidence.source_checked_on,'2026-11-16');
 assert.equal(evidence.records.length,20);
 assert.equal(evidenceByKey.size,20);
 const counts={};
 for(const e of evidence.records){
  assert.ok(levels.includes(e.level),e.english);
  assert.ok(Object.hasOwn(original,e.topic),e.topic);
  assert.ok(original[e.topic].some(row=>norm(row[0])===norm(e.english)),e.english);
  assert.ok(e.part_of_speech&&e.evidence_note&&e.human_bilingual_review_required===true);
  assert.ok(['exact_sense_label','collocation_in_labeled_sense','contextual_inference'].includes(e.evidence_kind));
  const url=new URL(e.source_url);
  assert.equal(url.protocol,'https:');
  assert.ok(['dictionary.cambridge.org','www.cambridgeenglish.org',
   'www.oxfordlearnersdictionaries.com'].includes(url.hostname),e.source_url);
  assert.ok(url.pathname.length>5);
  if(e.evidence_kind==='contextual_inference'){
   assert.equal(e.source_cefr_level,null,'Do not claim a formal label for '+e.english);
   assert.ok(e.support_url,'Inferences require more than a dictionary definition');
   assert.equal(new URL(e.support_url).protocol,'https:');
  }else assert.equal(e.source_cefr_level,e.level);
  counts[e.evidence_kind]=(counts[e.evidence_kind]||0)+1;
 }
 assert.deepEqual(counts,{collocation_in_labeled_sense:3,exact_sense_label:14,contextual_inference:3});
});

test('All 20 Batch 1 words carry proposed level and provenance in the existing CEFR review queue',()=>{
 assert.equal(queue.records.length,397);
 assert.equal(batch.length,20);
 for(const r of batch){
  const e=evidenceByKey.get(key(r));
  assert.ok(e,'Batch record without evidence: '+r.english);
  assert.equal(r.review_status,'PROVISIONAL');
  assert.equal(r.level,e.level);
  assert.equal(r.part_of_speech,e.part_of_speech);
  assert.equal(r.source_url,e.source_url);
  assert.equal(r.cefr_evidence_kind,e.evidence_kind);
  assert.equal(r.cefr_source_label,e.source_cefr_level);
  assert.match(r.source_note,/Human bilingual reviewer still required/);
  assert.equal(r.reviewed_by,'');
  assert.equal(r.reviewed_at,'');
  assert.equal(r.source_url.startsWith('https://'),true);
  const originalCard=original[r.topic].find(c=>norm(c[0])===norm(r.english));
  assert.ok(originalCard);
  assert.deepEqual([r.english,r.ipa,r.meaning,r.example,r.translation],originalCard);
 }
 for(const e of evidence.records)
  assert.equal(batch.filter(r=>key(r)===key(e)).length,1,'Missing candidate '+e.english);
});

test('No automatic approval: old 260 seed words and 117 CEFR drafts remain unchanged',()=>{
 const old=queue.records.filter(r=>r.review_status==='UNREVIEWED');
 const provisional=queue.records.filter(r=>r.review_status==='PROVISIONAL');
 assert.equal(old.length,260);
 assert.equal(provisional.length,137);
 assert.equal(queue.records.filter(r=>r.review_status==='APPROVED').length,0);
 assert.ok(old.every(r=>r.level===null));
 assert.equal(drafts.records.length,117);
 const byKey=new Map(queue.records.map(r=>[key(r),r]));
 assert.equal(byKey.size,397);
 for(const candidate of drafts.records){
  const r=byKey.get(key(candidate));
  assert.ok(r,'Missing previous draft '+candidate.english);
  assert.equal(r.level,candidate.level);
  assert.equal(r.review_status,'PROVISIONAL');
 }
 for(const r of batch)assert.ok(!drafts.records.some(x=>key(x)===key(r)));
});

test('Three unlabeled source cases stay distinguishable from 17 dictionary-labeled cases',()=>{
 assert.deepEqual(
  evidence.records.filter(x=>x.evidence_kind==='contextual_inference').map(x=>[x.english,x.level]),
  [['noodles','A2'],['boarding pass','B1'],['charger','B2']]
 );
 const school=evidenceByKey.get('School - Trường học\0timetable');
 assert.equal(school.level,'A2');
 assert.match(school.evidence_note,/school-class schedule sense/);
 const computing=evidenceByKey.get('Technology - Công nghệ\0attachment');
 assert.equal(computing.level,'B2');
 assert.match(computing.evidence_note,/COMPUTING/);
 assert.ok(evidence.records.every(x=>x.human_bilingual_review_required));
});

test('Batch 1 CEFR research data produces zero APPROVED rows in the dry-run importer',()=>{
 const p=spawnSync(process.execPath,['scripts/import-cefr-approved.js',
  '--file=vocab/cefr-review-all-topics.json'],{cwd:new URL('..',import.meta.url),
  encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/"records": 397/);
 assert.match(p.stdout,/"approved": 0/);
 assert.match(p.stdout,/DRY RUN/);
});
