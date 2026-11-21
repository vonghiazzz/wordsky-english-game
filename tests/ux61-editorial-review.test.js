/* UX61.3: editorial proposals are never a production vocabulary approval.
 * Offline fixture only; no DB, network, progress/CEFR/SRS mutations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSharedCueCollisions} from '../scripts/audit-ux57-cues.mjs';

const ledger=JSON.parse(readFileSync(
 new URL('../docs/ux61-3-editorial-review.json',import.meta.url),'utf8'));
const expected=[
 'five@Numbers','year@Time & Dates','assess@School','evaluate@School',
 'significant@Adjectives','substantial@Adjectives',
 'habitat@Animals','habitat@Nature',
];

test('UX61.3 review ledger tracks eight distinct sense/topic candidates without real UUIDs',()=>{
 assert.equal(ledger.schema,'wordsky-ux61-3-editorial-review-v1');
 assert.equal(ledger.scope,'offline-proposal-only');
 assert.equal(ledger.decision_status,'PENDING_HUMAN_REVIEW');
 assert.deepEqual(ledger.cards.map(card=>card.key),expected);
 assert.equal(new Set(ledger.cards.map(card=>card.key)).size,8);
 for(const card of ledger.cards){
  assert.equal(card.key,card.english+'@'+card.topic);
  assert.equal(card.review_status,'PENDING_HUMAN_REVIEW');
  assert.equal(card.word_id,null);
  assert.equal(card.reviewed_by,null);
  assert.equal(card.approved_at,null);
  assert.ok(card.part_of_speech.length>0);
  assert.ok(card.sense_note.length>20);
  assert.ok(card.source_url.startsWith('https://dictionary.cambridge.org/dictionary/english/'));
  assert.equal(Object.hasOwn(card,'cefr_level'),false);
  assert.equal(Object.hasOwn(card,'approved'),false);
 }
});
test('UX61.3 keeps existing translated cues untouched and identifies the three collisions',()=>{
 const expectedCues=['năm','năm','đánh giá','đánh giá','đáng kể','đáng kể',
  'môi trường sống tự nhiên','môi trường sống'];
 assert.deepEqual(ledger.cards.map(c=>c.existing_vietnamese_cue),expectedCues);
 const fixture=ledger.cards.map((card,i)=>({id:'candidate-'+i,
  english:card.english,meaning:card.existing_vietnamese_cue,topic:card.topic}));
 const audit=auditSharedCueCollisions(fixture);
 assert.equal(audit.eligible_shared_words,8);
 assert.equal(audit.ambiguous_cue_groups,3);
 assert.equal(audit.affected_cards,6);
 assert.ok(audit.collisions.every(c=>!c.cards.some(x=>x.english==='habitat')));
});
test('UX61.3 distinguishes editorial proposal from permission to change learner data',()=>{
 const gate=ledger.release_gate;
 assert.equal(gate.allow_auto_apply,false);
 assert.equal(gate.allow_cefr_auto_approval,false);
 assert.equal(gate.allow_srs_history_change,false);
 assert.equal(gate.require_human_sense_pos_signoff,true);
 assert.equal(gate.require_live_uuid_recheck_and_rollback,true);
 assert.equal(gate.require_preview_browser_qa,true);
 for(const english of ['assess','evaluate']){
  assert.equal(ledger.cards.find(c=>c.english===english).candidate_quiz_cue,null,
   'Overlapping senses must not be arbitrarily split');
 }
 for(const card of ledger.cards){
  if(card.candidate_quiz_cue!==null)
   assert.ok(card.candidate_quiz_cue.length>5);
 }
 assert.equal(ledger.production_audit_reference.reported_collision_groups,3);
 assert.equal(ledger.production_audit_reference.reported_affected_cards,6);
});
