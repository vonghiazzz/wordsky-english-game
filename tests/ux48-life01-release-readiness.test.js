import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditLife01Candidate} from '../scripts/ux48-life01-public-catalog-preflight.mjs';

const batch=JSON.parse(readFileSync(new URL('../vocab/batches/LIFE-01.json',import.meta.url),'utf8'));
const topics={topics:[{title:'Daily Life',enabled:true},{title:'Home - Nhà cửa',enabled:true}]};
const catalog={scope:'catalog',words:[{english:'Hello',meaning:'Xin chào'}]};

test('LIFE-01 is fully authored but is NOT approved for My Learning Production',()=>{
 const r=auditLife01Candidate({batch,catalog,topics});
 assert.equal(r.candidate_count,100);
 assert.equal(r.potential_total_if_every_record_is_approved_and_published,101);
 assert.deepEqual(r.per_topic,{'Daily Life':75,'Home - Nhà cửa':25});
 assert.deepEqual(r.source_evidence,{headword_pos_label:51,exact_sense_label:19,contextual_inference:30});
 assert.deepEqual(r.collisions,[]);
 assert.deepEqual(r.problems,[]);
 assert.equal(r.independent_human_review_complete,false);
 assert.equal(r.approved_records,0);
 assert.equal(r.can_publish_to_production,false);
 assert.equal(r.mutations,0);
});

test('LIFE-01 refuses to call zero-collision report approval',()=>{
 const r=auditLife01Candidate({batch,catalog,topics});
 assert.equal(r.collisions.length,0);
 assert.equal(r.can_publish_to_production,false);
 assert.match(r.explanation,/independent bilingual review/i);
});

test('LIFE-01 detects English and Vietnamese cue duplicates against live catalog',()=>{
 const r=auditLife01Candidate({
  batch,catalog:{scope:'catalog',words:[
   {english:'alarm',meaning:'Không trùng'},
   {english:'Some other word',meaning:'Bữa ăn sáng'}
  ]},topics
 });
 assert.ok(r.collisions.some(x=>x.type==='live_english'&&x.word==='alarm'));
 assert.ok(r.collisions.some(x=>x.type==='live_vietnamese_cue'&&x.word==='breakfast'));
 assert.equal(r.can_publish_to_production,false);
});

test('LIFE-01 rejects missing/inactive topics and unreviewed candidate metadata',()=>{
 const altered=structuredClone(batch);
 altered.records[0].review_status='APPROVED';
 const r=auditLife01Candidate({batch:altered,catalog,topics:{
  topics:[{title:'Daily Life',enabled:true},{title:'Home - Nhà cửa',enabled:false}]
 }});
 assert.ok(r.problems.some(x=>x.issue==='invalid_candidate_review_state'));
 assert.ok(r.problems.some(x=>x.issue==='inactive_or_unknown_topic'));
 assert.equal(r.can_publish_to_production,false);
});

test('LIFE-01 detects duplicates inside an altered 100-word batch',()=>{
 const altered=structuredClone(batch);
 altered.records[1].english=altered.records[0].english;
 altered.records[2].meaning=altered.records[0].meaning;
 const r=auditLife01Candidate({batch:altered,catalog,topics});
 assert.ok(r.collisions.some(x=>x.type==='in_batch_english'));
 assert.ok(r.collisions.some(x=>x.type==='in_batch_vietnamese_cue'));
});

test('LIFE-01 rejects incomplete datasets rather than assuming a clean catalog',()=>{
 assert.throws(()=>auditLife01Candidate({batch:{...batch,records:batch.records.slice(0,99)},catalog,topics}),/exactly 100/);
 assert.throws(()=>auditLife01Candidate({batch,catalog:{scope:'catalog',words:[]},topics}),/missing or malformed/);
 assert.throws(()=>auditLife01Candidate({batch,catalog,topics:{topics:[]}}),/missing or malformed/);
});
