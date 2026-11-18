/* UX53B phase 1 — proposed verb-sense review, not training approval.
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
const approvals=Object.freeze({}); // UX53B release gate: no approved sense labels yet.

export function getVerbCefrSenseReview(v1,meaning){
 const proposedMeaning=Object.hasOwn(proposed,v1)?proposed[v1]:null;
 const source=getVerbCefrEvidence(v1);
 if(!proposedMeaning||proposedMeaning!==meaning||!source.level)
  return {status:'unreviewed',level:null,source_id:null};
 const approved=Object.hasOwn(approvals,v1)&&approvals[v1]===meaning;
 return {status:approved?'approved':'proposed',
  level:source.level,source_id:source.source_id};
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
