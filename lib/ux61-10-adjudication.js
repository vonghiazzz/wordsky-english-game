/* UX61.10: safe offline adjudication handoff, never a publication/approval system.
 * Reviewer names in forms are labels, not identity. No SRS or CEFR mutation.
 */
import assert from 'node:assert/strict';
import {
  compareBlindReviewForms, editorialSnapshotHash, inspectBlindReviewForm
} from './ux61-9-blind-review.js';

const PAIRS=Object.freeze([
  ['five','year'],
  ['assess','evaluate'],
  ['significant','substantial']
]);
const STATUS_LABELS=Object.freeze({
 awaiting_both_reviews:'Thiếu đánh giá từ A hoặc B',
 decision_disagreement:'Hai bên bất đồng quyết định',
 prompt_or_answer_disagreement:'Hai bên khác câu hỏi hoặc đáp án',
 both_need_revision:'Hai bên đều yêu cầu sửa',
 drafts_agree_but_unverified:'Hai bản nháp thống nhất; chưa xác minh người duyệt'
});
const ACTIONS=Object.freeze([
 'Xác thực danh tính và tính độc lập của hai người đánh giá qua quy trình đáng tin cậy',
 'Đối chiếu bằng chứng ngữ nghĩa, xử lý mọi bất đồng và đáp án đồng nghĩa chồng lấn',
 'Thu thập biên nhận kiểm duyệt có nguồn gốc xác minh được và phê duyệt riêng',
 'Đối chiếu lại UUID/nguồn production, kiểm thử SRS và triển khai bằng PR riêng'
]);
const freezeRows=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));

export function prepareAdjudicationReport(packet,formA,formB){
 const overview=compareBlindReviewForms(packet,formA,formB);
 const a=inspectBlindReviewForm(formA,packet,'REVIEWER_A');
 const b=inspectBlindReviewForm(formB,packet,'REVIEWER_B');
 const aMap=new Map(a.entries.map(e=>[e.english,e]));
 const bMap=new Map(b.entries.map(e=>[e.english,e]));
 assert.equal(overview.source_snapshot_sha256,editorialSnapshotHash(packet));
 assert.equal(overview.compared_cards,6);
 const cards=packet.cards.map((source,index)=>{
  const outcome=overview.results[index];
  assert.equal(source.english,outcome.english);
  const aa=aMap.get(source.english),bb=bMap.get(source.english);
  const pair=PAIRS.find(p=>p.includes(source.english));
  const flags=overview.collisions.filter(c=>c.pair.includes(source.english))
   .map(c=>c.review_code+':'+c.reason);
  const blockers=[
   ...(aa?[]:['missing_review_A']),
   ...(bb?[]:['missing_review_B']),
   ...(outcome.status==='drafts_agree_but_unverified'?[]:[outcome.status]),
   ...flags,
   'independent_human_identity_unverified',
   'semantic_adjudication_unverified',
   'signed_approval_missing'
  ];
  return Object.freeze({
   word_id:source.word_id,english:source.english,
   shared_vietnamese_cue:source.existing_meaning,
   paired_with:pair.find(w=>w!==source.english),
   review_A:aa?.decision??'not_submitted',
   review_B:bb?.decision??'not_submitted',
   comparison_status:outcome.status,blockers:Object.freeze([...new Set(blockers)]),
   proposed_answers_are_approved:false,can_resume_graded_srs:false
  });
 });
 const statuses=Object.fromEntries(Object.keys(STATUS_LABELS).map(key=>[
  key,cards.filter(c=>c.comparison_status===key).length
 ]));
 return Object.freeze({
  schema:'wordsky-ux61-10-adjudication-handoff-v1',
  scope:'offline-pending-adjudication-only',
  source_snapshot_sha256:overview.source_snapshot_sha256,
  compared_cards:6,reviewed_by_A:a.completed_cards,reviewed_by_B:b.completed_cards,
  all_six_forms_complete:overview.forms_complete,
  status_counts:Object.freeze(statuses),
  conflicts:freezeRows(overview.collisions.map(c=>({
   pair:Object.freeze([...c.pair]),review_code:c.review_code,reason:c.reason
  }))),
  cards:freezeRows(cards),
  required_actions:ACTIONS,
  human_identities_verified:false,semantic_approval_verified:false,
  reviewer_independence_verified:false,
  signed_receipts_verified:false,authorized_to_grade_srs:false,
  authorized_to_apply_vocabulary:false,authorized_to_change_cefr:false,
  ready_for_released_scored_recall:false
 });
}
export function renderVietnameseAdjudicationMarkdown(report){
 assert.equal(report?.schema,'wordsky-ux61-10-adjudication-handoff-v1');
 assert.equal(report.authorized_to_grade_srs,false);
 const out=[
  '# UX61.10 — Biên bản đối chiếu (CHƯA PHÊ DUYỆT)',
  '',
  '**Mục đích:** Tổng hợp phiếu đánh giá để người kiểm duyệt xem xét. Không phải biên bản xác minh danh tính, phê duyệt hay quyết định phát hành.',
  '',
  'Dấu vết nguồn SHA-256: '+report.source_snapshot_sha256,
  '',
  'Tình trạng: A đã điền '+report.reviewed_by_A+'/6 thẻ; B đã điền '+report.reviewed_by_B+'/6 thẻ.',
  '',
  '| Từ tiếng Anh | Cặp dễ nhầm | Phiếu A | Phiếu B | Kết quả |',
  '| --- | --- | --- | --- | --- |'
 ];
 for(const row of report.cards){
  // Card names, paired words, decisions and status are selected from
  // fixed vocabulary / allowlisted enums, not free-text reviewer entries.
  const status=STATUS_LABELS[row.comparison_status];
  assert.ok(status,'Unrecognized review comparison status');
  out.push('| '+row.english+' | '+row.paired_with+' | '+row.review_A+
    ' | '+row.review_B+' | '+status+' |');
 }
 out.push('','## Rủi ro đối chiếu (không phải kết luận ngữ nghĩa)');
 if(report.conflicts.length===0)out.push('Chưa phát hiện xung đột giữa các câu hỏi và tập đáp án đã nhập; điều này không chứng minh hai người đánh giá độc lập hoặc nội dung đúng.');
 else for(const issue of report.conflicts)
  out.push('- '+issue.pair.join(' / ')+': '+issue.review_code+' — '+issue.reason);
 out.push('','## Điều kiện bắt buộc trước khi mở khóa SRS');
 for(const action of report.required_actions)out.push('- [ ] '+action);
 out.push('','**Kết luận:** 0 thẻ được kích hoạt bởi công cụ này. Giữ nguyên sáu chốt chặn chấm điểm SRS; không sửa dữ liệu người dùng, CEFR hoặc từ điển production.','');
 return out.join('\n');
}
