/* UX53B phase 2 — explicit source-backed sense approval, no UI rollout.
 * Oxford 3000/5000 levels describe English verb headword/POS; Vietnamese gloss
 * sense eligibility is independently reviewed and explicitly approved later.
 * Fail closed: only 'approved' exact-meaning records can enter CEFR quizzes.
 */
import {getVerbCefrEvidence} from './verb-cefr-evidence.js';

export const VERB_CEFR_LEVELS=Object.freeze(['A1','A2','B1','B2','C1']);
export const VERB_CEFR_REVIEW_STATUS=Object.freeze({
 PROPOSED:'proposed', APPROVED:'approved', REJECTED:'rejected'
});
// Source-matched headword and intended Vietnamese cue to review. None approved.
const proposed=Object.freeze({
 'be':'thì, là, ở',
 'begin':'bắt đầu',
 'buy':'mua',
 'come':'đến',
 'do':'làm',
 'drink':'uống',
 'eat':'ăn',
 'find':'tìm thấy',
 'get':'nhận, lấy',
 'give':'đưa, cho',
 'go':'đi',
 'have':'có',
 'know':'biết',
 'learn':'học',
 'make':'làm, tạo ra',
 'read':'đọc',
 'see':'nhìn thấy',
 'speak':'nói, phát biểu',
 'take':'lấy, mang',
 'write':'viết'
});
// Only senses explicitly verified against a learner dictionary may be approved.
// Cambridge Learner's Dictionary marks the payment/purchase sense of buy as A1.
// An Oxford headword grade alone never grants approval to an additional sense.
const approvals=Object.freeze({
 'buy':Object.freeze({
  meaning:'mua',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/us/dictionary/learner-english/buy',
  sense_source_id:'cambridge_learner_buy_purchase_A1'
 }),
 'eat':Object.freeze({
  meaning:'ăn',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/dictionary/learner-english/eat',
  sense_source_id:'cambridge_learner_eat_swallow_A1'
 }),
 'go':Object.freeze({
  meaning:'đi',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/dictionary/learner-english/go',
  sense_source_id:'cambridge_learner_go_move_A1'
 }),
 'read':Object.freeze({
  meaning:'đọc',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/dictionary/learner-english/read',
  sense_source_id:'cambridge_learner_read_words_A1'
 }),
 'write':Object.freeze({
  meaning:'viết',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/us/dictionary/learner-english/write',
  sense_source_id:'cambridge_learner_write_words_A1'
 }),
 'come':Object.freeze({
  meaning:'đến',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/dictionary/learner-english/come',
  sense_source_id:'cambridge_learner_come_move_towards_A1'
 }),
 'know':Object.freeze({
  meaning:'biết',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/dictionary/learner-english/know',
  sense_source_id:'cambridge_learner_know_information_A1'
 }),
 'see':Object.freeze({
  meaning:'nhìn thấy',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/dictionary/learner-english/see',
  sense_source_id:'cambridge_learner_see_eyes_A1'
 }),
 'find':Object.freeze({
  meaning:'tìm thấy',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/us/dictionary/learner-english/find',
  sense_source_id:'cambridge_learner_find_discover_searching_A1'
 }),
 'learn':Object.freeze({
  meaning:'học',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/us/dictionary/learner-english/learn',
  sense_source_id:'cambridge_learner_learn_get_skill_A1'
 }),
 'drink':Object.freeze({
  meaning:'uống',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/us/dictionary/learner-english/drink',
  sense_source_id:'cambridge_learner_drink_liquid_A1'
 }),
 'have':Object.freeze({
  meaning:'có',level:'A1',
  sense_source_url:'https://dictionary.cambridge.org/us/dictionary/learner-english/have',
  sense_source_id:'cambridge_learner_have_own_A1'
 })
});

export function getVerbCefrSenseReview(v1,meaning){
 const proposedMeaning=Object.hasOwn(proposed,v1)?proposed[v1]:null;
 const source=getVerbCefrEvidence(v1);
 if(!proposedMeaning||proposedMeaning!==meaning||!source.level)
  return {status:'unreviewed',level:null,source_id:null};
 const record=Object.hasOwn(approvals,v1)?approvals[v1]:null;
 const approved=!!record&&record.meaning===meaning&&record.level===source.level&&!!record.sense_source_url;
 return {status:approved?'approved':'proposed',
  level:source.level,source_id:source.source_id,
  ...(approved?{sense_source_id:record.sense_source_id,sense_source_url:record.sense_source_url}:{})};
}
export function getApprovedVerbCefrLevel(v1,meaning){
 const review=getVerbCefrSenseReview(v1,meaning);
 return review.status==='approved'?review.level:null;
}
export function listProposedVerbCefrSenses(){
 return Object.entries(proposed).map(([v1,meaning])=>({
  v1,meaning,...getVerbCefrSenseReview(v1,meaning)
 }));
}
