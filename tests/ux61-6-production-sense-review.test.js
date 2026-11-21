/* UX61.6 human-curation-only signoff gate. No DB, network or account data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPendingEditorialRecall} from '../public/ux61-pending-recall.js';

const review=JSON.parse(readFileSync(
 new URL('../docs/ux61-6-production-sense-review.json',import.meta.url),'utf8'));
const expected=[
 ['five','4b406577-b4d7-43a5-903e-55e734dca399'],
 ['year','81bf2f1f-a7ab-49f7-ac0e-088ea7bee93d'],
 ['assess','850c23ad-1d31-4d64-ab9e-7b05744e10f6'],
 ['evaluate','b7fb767d-b77c-4911-b45b-c4588747c2bc'],
 ['significant','ad2b5bf6-dcd1-4232-bfd2-a3765a467ae5'],
 ['substantial','91001117-6921-488d-a052-34dbc248e838'],
];

test('UX61.6 editorial file is exactly six current PUBLIC production cards, with documented provenance',()=>{
 assert.equal(review.schema,'wordsky-ux61-6-production-sense-review-v1');
 assert.equal(review.scope,'offline-human-review-proposal');
 assert.equal(review.production_public_card_count,2099);
 assert.equal(review.as_of_date,'2026-11-21');
 assert.deepEqual(review.cards.map(c=>[c.english,c.word_id]),expected);
 assert.equal(new Set(review.cards.map(c=>c.word_id)).size,6);
 for(const c of review.cards){
  assert.ok(c.topic&&c.meaning&&c.example&&c.translation&&c.part_of_speech);
  assert.equal(c.source_url,'https://dictionary.cambridge.org/dictionary/english/'+c.english);
  assert.ok(c.reason.length>50);
  assert.equal(c.review_status,'PENDING_HUMAN_REVIEW');
  assert.equal(c.graded_recall_allowed,false);
  assert.equal(c.reviewed_by,null);
  assert.equal(c.approved_at,null);
  assert.equal(c.preserve_word_id,true);
  assert.equal(c.preserve_cefr,true);
  assert.equal(c.preserve_srs_history,true);
  assert.equal(isPendingEditorialRecall({source:'shared',id:c.word_id,topic:c.topic,
   english:c.english,meaning:c.meaning}),true,
   c.english+' must remain held until human signoff');
  assert.equal(isPendingEditorialRecall({source:'personal',id:c.word_id,topic:c.topic,
   english:c.english,meaning:c.meaning}),false);
 }
});

test('UX61.6 only number and time-unit candidates are distinguishable proposals, not approvals',()=>{
 assert.deepEqual(review.cards.filter(c=>c.candidate_quiz_cue!==null).map(c=>c.english),
  ['five','year']);
 for(const c of review.cards.slice(0,2)){
  assert.equal(c.decision,'PROPOSE_CONTEXTUAL_CUE');
  assert.ok(c.candidate_quiz_cue.length>10);
 }
 for(const c of review.cards.slice(2)){
  assert.equal(c.candidate_quiz_cue,null,
   'Overlapping meanings cannot be resolved by inventing mutually exclusive hints');
  assert.equal(c.decision,'HOLD_OR_NON_GRADED_CONTEXT');
 }
});

test('UX61.6 do not auto-approve or change CEFR, production data or SRS history',()=>{
 const gate=review.release_gate;
 for(const k of ['auto_apply_allowed','graded_recall_unblock_allowed',
  'db_mutation_allowed','cefr_bulk_approval_allowed','srs_history_mutation_allowed']){
  assert.equal(gate[k],false,k);
 }
 for(const k of ['human_sense_pos_signoff_required','live_public_uuid_recheck_required',
  'db_backup_and_rollback_required','exact_head_e2e_and_preview_required']){
  assert.equal(gate[k],true,k);
 }
 assert.equal(review.approval_fields.approver,null);
 assert.equal(review.approval_fields.review_date,null);
 assert.deepEqual(review.approval_fields.approved_card_ids,[]);
 assert.equal(review.unaffected_reference.english,'habitat');
 assert.equal(review.unaffected_reference.topics.length,2);
});
