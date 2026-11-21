/* UX61.9 two-form independent editorial handoff is OFFLINE, never approval.
 * Tests use synthetic completed forms only; none are real human decisions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 BLIND_REVIEW_SCHEMA,editorialSnapshotHash,createBlindReviewTemplate,
 inspectBlindReviewForm,compareBlindReviewForms
} from '../lib/ux61-9-blind-review.js';
const packet=JSON.parse(readFileSync(
 new URL('../docs/ux61-8-editorial-evidence.json',import.meta.url),'utf8'));
const make=(code)=>createBlindReviewTemplate(packet,code);
const fakeCompleted=(code)=>{
 const p=make(code);
 for(let i=0;i<6;i++){
  const c=p.cards[i];
  c.decision='suitable_for_adjudication';
  c.proposed_prompt_vi='Câu tình huống tiếng Việt '+(i+1)+' để người duyệt kiểm tra';
  c.accepted_english=[c.english];
  c.reasoning='Synthetic unit test only: human semantic review never happened.';
  c.reviewed_source_url=c.source_url;
 }
 return p;
};
test('UX61.9 produces two independent empty forms with identical immutable source evidence',()=>{
 const a=make('REVIEWER_A'),b=make('REVIEWER_B');
 assert.equal(a.schema,BLIND_REVIEW_SCHEMA);
 assert.equal(b.schema,a.schema);
 assert.equal(a.source_snapshot_sha256,editorialSnapshotHash(packet));
 assert.equal(b.source_snapshot_sha256,a.source_snapshot_sha256);
 assert.deepEqual(a.cards.map(c=>c.word_id),packet.cards.map(c=>c.word_id));
 assert.ok(a.cards.every(c=>c.decision===null&&c.proposed_prompt_vi===null&&
  c.accepted_english===null&&c.reasoning===null));
 assert.equal(Object.hasOwn(a,'reviewed_by'),false,'No fabricated identity');
 assert.equal(Object.hasOwn(a,'approved'),false);
 assert.equal(inspectBlindReviewForm(a,packet,'REVIEWER_A').completed_cards,0);
 assert.equal(inspectBlindReviewForm(b,packet,'REVIEWER_B').completed_cards,0);
 assert.throws(()=>make('REVIEWER_C'),/Unknown/);
});

test('UX61.9 even two identical synthetic completed forms never authorize grading',()=>{
 const a=fakeCompleted('REVIEWER_A'),b=fakeCompleted('REVIEWER_B');
 const report=compareBlindReviewForms(packet,a,b);
 assert.equal(report.forms_complete,true);
 assert.equal(report.compared_cards,6);
 assert.deepEqual(report.results.map(r=>r.status),Array(6).fill('drafts_agree_but_unverified'));
 assert.equal(report.requires_human_adjudication,true);
 assert.equal(report.draft_disagreement_found,false);
 assert.equal(report.independent_people_verified,false);
 assert.equal(report.semantic_accuracy_verified,false);
 assert.equal(report.signed_immutable_receipts_verified,false);
 assert.equal(report.authorized_to_approve,false);
 assert.equal(report.authorized_to_activate_prompts,false);
 assert.equal(report.authorized_to_grade_srs,false);
 assert.equal(report.authorized_to_modify_production,false);
});

test('UX61.9 detects disagreements and shared cue/accepted-answer collisions',()=>{
 const a=fakeCompleted('REVIEWER_A'),b=fakeCompleted('REVIEWER_B');
 b.cards[2].accepted_english=['assess','evaluate'];
 b.cards[2].proposed_prompt_vi='Một ngữ cảnh khác cho câu trả lời';
 b.cards[3].accepted_english=['evaluate','assess'];
 a.cards[0].proposed_prompt_vi=a.cards[1].proposed_prompt_vi;
 const result=compareBlindReviewForms(packet,a,b);
 assert.equal(result.draft_disagreement_found,true);
 assert.ok(result.results.some(r=>r.status==='prompt_or_answer_disagreement'));
 assert.ok(result.collisions.some(c=>c.reason==='same_prompt_different_target'));
 assert.ok(result.collisions.some(c=>c.reason==='overlapping_accepted_answers'));
 assert.equal(result.authorized_to_grade_srs,false);
});

test('UX61.9 rejects tampered sources, forged identity, premature activation and malformed review',()=>{
 const variants=[
  p=>{p.scope='approved-production'},
  p=>{p.source_snapshot_sha256='0'.repeat(64)},
  p=>{p.review_code='REVIEWER_B'},
  p=>{p.cards[0].example='Tampered source'},
  p=>{p.cards[0].english='seven'},
  p=>{p.cards[0].word_id='00000000-0000-4000-8000-000000000099'},
  p=>{p.cards[0].decision='approved'},
  p=>{p.cards[0].decision=null;p.cards[0].accepted_english=['five']},
  p=>{p.identity_verified=true},
  p=>{p.cards.push(p.cards[0])},
  p=>{p.cards[0].proposed_prompt_vi='Ngữ cảnh mới'},
 ];
 for(const edit of variants){
  const a=make('REVIEWER_A');edit(a);
  assert.throws(()=>inspectBlindReviewForm(a,packet,'REVIEWER_A'));
 }
 const a=fakeCompleted('REVIEWER_A'),b=fakeCompleted('REVIEWER_B');
 const mistakes=[
  x=>{x.cards[0].proposed_prompt_vi='Trả lời là five'},
  x=>{x.cards[2].accepted_english=['evaluate']},
  x=>{x.cards[2].accepted_english=['assess','ASSESS']},
  x=>{x.cards[2].reviewed_source_url='https://example.invalid/'},
  x=>{x.cards[4].decision='needs_revision'},
  x=>{x.cards[3].reasoning=''},
  x=>{x.cards[0].proposed_prompt_vi=null},
 ];
 for(const edit of mistakes){
  const copy=structuredClone(a);edit(copy);
  assert.throws(()=>compareBlindReviewForms(packet,copy,b));
 }
 assert.throws(()=>compareBlindReviewForms(packet,b,a),'Swapped forms cannot pass');
});

test('UX61.9 incomplete or revision-request forms stay blocked, never receive grades',()=>{
 const a=make('REVIEWER_A'),b=make('REVIEWER_B');
 b.cards[0].decision='needs_revision';
 b.cards[0].reasoning='The current cue overlaps another word.';
 b.cards[0].reviewed_source_url=b.cards[0].source_url;
 const result=compareBlindReviewForms(packet,a,b);
 assert.equal(result.forms_complete,false);
 assert.equal(result.results[0].status,'awaiting_both_reviews');
 assert.equal(result.authorized_to_activate_prompts,false);
 assert.equal(result.authorized_to_grade_srs,false);
});
