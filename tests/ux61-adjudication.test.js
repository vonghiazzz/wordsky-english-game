/* UX61.10: only synthetic reviewer submissions; no actual human signoff.
 * Source validation, conflict reporting, and output remain fail-closed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBlindReviewTemplate} from '../lib/ux61-9-blind-review.js';
import {
 prepareAdjudicationReport,renderVietnameseAdjudicationMarkdown
} from '../lib/ux61-10-adjudication.js';
import {buildLiveAdjudicationReport}
 from '../scripts/ux61-10-adjudication.mjs';

const packet=JSON.parse(readFileSync(
 new URL('../docs/ux61-8-editorial-evidence.json',import.meta.url),'utf8'));
const template=code=>createBlindReviewTemplate(packet,code);
const catalog=()=>packet.cards.map(c=>({
 word_id:c.word_id,english:c.english,topic:c.topic,
 meaning:c.existing_meaning,example:c.original_example,
 translation:c.original_translation
}));
function fakeGet(words=catalog(),status=200){
 return async url=>{
  assert.equal(url,'https://wordsky-english-game.vercel.app/api/learning/vocabulary');
  return new Response(JSON.stringify({scope:'catalog',words}),{
   status,headers:{'content-type':'application/json'}
  });
 };
}
function filled(code){
 const form=template(code);
 form.cards.forEach((card,i)=>{
  card.decision='suitable_for_adjudication';
  card.proposed_prompt_vi='Ngữ cảnh tiếng Việt mẫu số '+(i+1)+' cần chuyên gia kiểm duyệt';
  card.accepted_english=[card.english];
  card.reasoning='SYNTHETIC TEST ONLY: no independent human actually reviewed this.';
  card.reviewed_source_url=card.source_url;
 });
 return form;
}

test('UX61.10 blank independent reviewer packets produce six pending rows and no approval',()=>{
 const a=template('REVIEWER_A'),b=template('REVIEWER_B');
 const report=prepareAdjudicationReport(packet,a,b);
 assert.equal(report.scope,'offline-pending-adjudication-only');
 assert.equal(report.reviewed_by_A,0);
 assert.equal(report.reviewed_by_B,0);
 assert.equal(report.compared_cards,6);
 assert.equal(report.status_counts.awaiting_both_reviews,6);
 assert.equal(report.conflicts.length,0);
 assert.equal(report.all_six_forms_complete,false);
 assert.ok(report.cards.every(c=>c.review_A==='not_submitted'&&
  c.review_B==='not_submitted'&&c.can_resume_graded_srs===false));
 assert.ok(report.cards.every(c=>c.blockers.includes('independent_human_identity_unverified')));
 for(const key of ['human_identities_verified','semantic_approval_verified',
  'reviewer_independence_verified','signed_receipts_verified',
  'authorized_to_grade_srs','authorized_to_apply_vocabulary',
  'authorized_to_change_cefr','ready_for_released_scored_recall'])
  assert.equal(report[key],false,key+' must always remain false');
 const md=renderVietnameseAdjudicationMarkdown(report);
 assert.match(md,/CHƯA PHÊ DUYỆT/);
 assert.match(md,/A đã điền 0\/6 thẻ; B đã điền 0\/6/);
 for(const word of ['five','year','assess','evaluate','significant','substantial'])
  assert.ok(md.includes('| '+word+' |'));
 assert.match(md,/0 thẻ được kích hoạt/);
});

test('UX61.10 even identical synthetic filled forms are not verified human decisions',()=>{
 const report=prepareAdjudicationReport(packet,filled('REVIEWER_A'),filled('REVIEWER_B'));
 assert.equal(report.all_six_forms_complete,true);
 assert.equal(report.reviewed_by_A,6);
 assert.equal(report.reviewed_by_B,6);
 assert.equal(report.status_counts.drafts_agree_but_unverified,6);
 assert.equal(report.authorized_to_grade_srs,false);
 assert.ok(report.cards.every(c=>c.blockers.includes('signed_approval_missing')));
 assert.equal(report.cards.filter(c=>c.can_resume_graded_srs).length,0);
 const md=renderVietnameseAdjudicationMarkdown(report);
 assert.match(md,/chưa xác minh người duyệt/);
 assert.match(md,/0 thẻ được kích hoạt/);
});

test('UX61.10 flags disagreement, overlapping answers and incomplete reviewer data',()=>{
 const a=filled('REVIEWER_A'),b=filled('REVIEWER_B');
 b.cards[0].decision='needs_revision';
 b.cards[0].proposed_prompt_vi=null;
 b.cards[0].accepted_english=null;
 b.cards[1].proposed_prompt_vi=a.cards[1].proposed_prompt_vi;
 b.cards[2].accepted_english=['assess','evaluate'];
 b.cards[3].accepted_english=['evaluate','assess'];
 a.cards[4].proposed_prompt_vi=a.cards[5].proposed_prompt_vi;
 const report=prepareAdjudicationReport(packet,a,b);
 assert.equal(report.status_counts.decision_disagreement,1);
 assert.equal(report.status_counts.prompt_or_answer_disagreement,3);
 assert.ok(report.conflicts.some(c=>c.reason==='overlapping_accepted_answers'));
 assert.ok(report.conflicts.some(c=>c.reason==='same_prompt_different_target'));
 assert.ok(report.cards[0].blockers.includes('decision_disagreement'));
 assert.equal(report.ready_for_released_scored_recall,false);
 const partial=template('REVIEWER_B');
 const awaiting=prepareAdjudicationReport(packet,a,partial);
 assert.equal(awaiting.status_counts.awaiting_both_reviews,6);
 assert.equal(awaiting.reviewed_by_B,0);
});

test('UX61.10 rejects changed reviewer packet sources and forged approval claims',()=>{
 const a=template('REVIEWER_A'),b=template('REVIEWER_B');
 const attacks=[
  p=>{p.review_code='REVIEWER_A'},
  p=>{p.cards[0].word_id='00000000-0000-4000-8000-000000000099'},
  p=>{p.source_snapshot_sha256='0'.repeat(64)},
  p=>{p.cards[0].approved=true},
 ];
 for(const attack of attacks){
  const changed=structuredClone(b);
  attack(changed);
  assert.throws(()=>prepareAdjudicationReport(packet,a,changed));
 }
 const r=prepareAdjudicationReport(packet,a,b);
 assert.throws(()=>renderVietnameseAdjudicationMarkdown({
  ...r,authorized_to_grade_srs:true
 }));
});

test('UX61.10 online check rejects drifting or unavailable production source',async()=>{
 const a=template('REVIEWER_A'),b=template('REVIEWER_B');
 const valid=await buildLiveAdjudicationReport(a,b,fakeGet());
 assert.equal(valid.reviewed_by_A,0);
 assert.equal(valid.authorized_to_grade_srs,false);
 const changed=catalog();
 changed[0].meaning='edited meaning';
 await assert.rejects(buildLiveAdjudicationReport(a,b,fakeGet(changed)),/drift/);
 await assert.rejects(buildLiveAdjudicationReport(a,b,fakeGet(catalog(),500)),
  /HTTP\/content-type mismatch/);
});
