import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditPublicRecallCues,RECALL_AUDIT_POLICY} from '../lib/qa-s1a-recall-cue-audit.js';
import {gradeRecall} from '../public/ux28-practice-core.js';

const card=(english,meaning,topic='Daily Life')=>({
 source:'shared',english,meaning,topic
});

test('QA-S1A detects identical Vietnamese cue with different English answers; does not change grading',()=>{
 const audit=auditPublicRecallCues([card('five','Năm'),card('year',' năm  ')]);
 assert.equal(audit.policy,RECALL_AUDIT_POLICY);
 assert.equal(audit.card_count,2);
 assert.equal(audit.cue_collision_count,1);
 assert.deepEqual(audit.cue_collisions[0],{
  cue:'năm',english:['five','year'],topics:['Daily Life']
 });
 assert.equal(audit.human_semantic_review_required,true);
 assert.equal(audit.accepted_answer_variants_created,false);
 assert.equal(audit.grading_or_srs_changed,false);
 // A lexical ambiguity audit is never an automatic synonym whitelist.
 assert.equal(gradeRecall('year','five').correct,false);
});

test('QA-S1A does not remove Vietnamese diacritics or confuse the same answer across topics',()=>{
 const audit=auditPublicRecallCues([
  card('table','Bàn','Furniture'),card('ban','Ban','Politics'),
  card('table',' BÀN ','Furniture'),card('year','Năm','Time')
 ]);
 assert.equal(audit.cue_collision_count,0);
 assert.equal(audit.distinct_cue_count,3);
 assert.equal(audit.multiple_meaning_count,0);
});

test('QA-S1A flags lexical English exposure as a candidate, not an established error',()=>{
 const audit=auditPublicRecallCues([
  card('wake','Thức dậy (wake up)'),card('sofa','Ghế sofa','Home'),
  card('internet','Mạng Internet','Technology'),
  card('work','Làm homework','School'),
  card('in','Trong một thứ','Grammar'),
  card('walk','Đi bộ')
 ]);
 assert.equal(audit.cue_contains_english_count,3);
 assert.deepEqual(audit.cue_contains_english_candidates.map(x=>x.english),
  ['wake','sofa','internet'].sort((a,b)=>{
   const aTopic={wake:'Daily Life',sofa:'Home',internet:'Technology'};
   return aTopic[a].localeCompare(aTopic[b],'vi');
  }));
 assert.equal(audit.candidate_flags_are_not_translation_errors,true);
});

test('QA-S1A notes polysemy and blank meanings for human review only',()=>{
 const audit=auditPublicRecallCues([
  card('bank','Ngân hàng','Money'),card('bank','Bờ sông','Nature'),
  card('eat','  ','Daily Life')
 ]);
 assert.equal(audit.multiple_meaning_count,1);
 assert.deepEqual(audit.multiple_meanings[0].meanings,['Bờ sông','Ngân hàng']);
 assert.equal(audit.missing_meaning_count,1);
 assert.deepEqual(audit.missing_meanings[0],{topic:'Daily Life',english:'eat'});
 assert.equal(audit.grading_or_srs_changed,false);
});

test('QA-S1A output remains deterministic when public catalog order changes',()=>{
 const cards=[
  card('year','năm','Time'),card('five','NĂM','Numbers'),
  card('wake','Thức dậy (wake up)'),card('table','Bàn','Furniture')
 ];
 const a=auditPublicRecallCues(cards);
 const b=auditPublicRecallCues([...cards].reverse());
 assert.deepEqual(a,b);
 assert.deepEqual(a.cue_collisions[0].topics,['Numbers','Time']);
});

test('QA-S1A rejects malformed, private, oversized, or control-character inputs',()=>{
 for(const x of [null,{},'list',Array(5001).fill(card('go','Đi'))])
  assert.throws(()=>auditPublicRecallCues(x),/public vocabulary input/);
 for(const x of [
  {...card('go','Đi'),source:'personal'},
  {...card('go','Đi'),english:''},
  {...card('go','Đi'),topic:''},
  {...card('go','Đi'),meaning:null},
  {...card('go','Đi'),meaning:'Đi\u0000'},
  {...card('go','Đi'),meaning:'z'.repeat(241)}
 ])assert.throws(()=>auditPublicRecallCues([x]),/public vocabulary input/);
});

test('QA-S1A public repository seed can be audited offline without account or SRS data',()=>{
 const seed=JSON.parse(readFileSync(new URL('../db/seed-vocabulary.json',import.meta.url),'utf8'));
 const cards=Object.entries(seed).flatMap(([topic,rows])=>rows.map(row=>({
  source:'shared',topic,english:row[0],meaning:row[2]
 })));
 const audit=auditPublicRecallCues(cards);
 assert.equal(audit.card_count,cards.length);
 assert.ok(audit.card_count>0);
 assert.equal(audit.scope,'public-shared-vocabulary-offline-only');
 assert.equal(audit.accepted_answer_variants_created,false);
 assert.equal(audit.grading_or_srs_changed,false);
});
