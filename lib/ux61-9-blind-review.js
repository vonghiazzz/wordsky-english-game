/* UX61.9 - BLIND REVIEW HANDOFF, NOT AN IDENTITY OR APPROVAL SERVICE.
 * This module never authenticates humans or authorizes production changes.
 * Two self-labelled forms are independent inputs, NOT proof of distinct people.
 * No DB, network, game scoring, CEFR or SRS writes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const BLIND_REVIEW_SCHEMA='ux61-9-blind-offline-v1';
const CODES=['REVIEWER_A','REVIEWER_B'];
const EXPECTED=['five','year','assess','evaluate','significant','substantial'];
const immutableFields=['word_id','english','topic','meaning','example','translation','source_url'];
const decisionValues=['suitable_for_adjudication','needs_revision'];
const norm=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
function keys(row,allowed,label){
 assert.ok(row&&typeof row==='object'&&!Array.isArray(row),label+' must be an object');
 assert.deepEqual(Object.keys(row).sort(),allowed.slice().sort(),label+' shape mismatch');
}
function snap(card){
 return {
  word_id:card.word_id,english:card.english,topic:card.topic,
  meaning:card.existing_meaning,example:card.original_example,
  translation:card.original_translation,source_url:card.source_url
 };
}
export function editorialSnapshotHash(packet){
 assert.equal(packet?.schema,'wordsky-ux61-8-editorial-evidence-v1');
 assert.equal(packet?.decision_status,'PENDING_HUMAN_REVIEW');
 assert.ok(Array.isArray(packet.cards)&&packet.cards.length===6);
 assert.deepEqual(packet.cards.map(c=>c.english),EXPECTED);
 assert.equal(packet.release_gate?.allow_graded_srs_activation,false);
 assert.equal(packet.release_gate?.allow_auto_apply,false);
 for(const card of packet.cards){
  assert.equal(card.review?.status,'PENDING_HUMAN_REVIEW');
  assert.equal(card.review?.reviewed_by,null);
  assert.equal(card.review?.approved_prompt_vi,null);
  assert.equal(card.review?.accepted_english,null);
  assert.equal(card.review?.reviewed_at,null);
  assert.deepEqual(card.review?.independent_receipts,[]);
 }
 return createHash('sha256').update(JSON.stringify(
  [BLIND_REVIEW_SCHEMA,packet.source.url,packet.cards.map(snap)]
 )).digest('hex');
}
export function createBlindReviewTemplate(packet,reviewCode){
 assert.ok(CODES.includes(reviewCode),'Unknown form label');
 const digest=editorialSnapshotHash(packet);
 return {
  schema:BLIND_REVIEW_SCHEMA,scope:'offline-unverified-review-form',
  review_code:reviewCode,source_snapshot_sha256:digest,
  instructions:'Review the WordSky source and bilingual dictionary independently. Do not view the other form. Form labels do not verify real-person identity or approve SRS.',
  cards:packet.cards.map(card=>({
   ...snap(card),decision:null,proposed_prompt_vi:null,
   accepted_english:null,reasoning:null,reviewed_source_url:null
  }))
 };
}
function clean(value,max=500){
 assert.ok(typeof value==='string'&&value.trim()===value&&
  value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value),
  'Invalid review text');
 return value;
}
const outputKeys=[
 ...immutableFields,'decision','proposed_prompt_vi','accepted_english',
 'reasoning','reviewed_source_url'
];
export function inspectBlindReviewForm(form,packet,expectedCode){
 const baseline=createBlindReviewTemplate(packet,expectedCode);
 keys(form,Object.keys(baseline),'form');
 assert.equal(form.schema,BLIND_REVIEW_SCHEMA);
 assert.equal(form.scope,'offline-unverified-review-form');
 assert.equal(form.review_code,expectedCode);
 assert.equal(form.source_snapshot_sha256,baseline.source_snapshot_sha256,
  'Source revision changed after review handoff');
 assert.equal(form.instructions,baseline.instructions);
 assert.ok(Array.isArray(form.cards)&&form.cards.length===6);
 let completed=0;const normalized=[];
 for(let i=0;i<6;i++){
  const actual=form.cards[i],ref=baseline.cards[i];
  keys(actual,outputKeys,'card');
  for(const field of immutableFields)assert.equal(actual[field],ref[field],
   'Immutable source changed: '+ref.english+'/'+field);
  const {decision,proposed_prompt_vi,accepted_english,reasoning,reviewed_source_url}=actual;
  assert.ok(decision===null||decisionValues.includes(decision));
  if(decision===null){
   for(const v of [proposed_prompt_vi,accepted_english,reasoning,reviewed_source_url])
    assert.equal(v,null,'Incomplete card cannot include unreviewed values');
  }else{
   const reason=clean(reasoning,1200);
   const source=clean(reviewed_source_url,512);
   assert.equal(source,ref.source_url,'Only the supplied academic reference is permitted in this form');
   if(decision==='suitable_for_adjudication'){
    const prompt=clean(proposed_prompt_vi,180);
    assert.ok(!new RegExp('(^|[^a-z])'+ref.english+'([^a-z]|$)','i').test(prompt),
     'Prompt discloses the target English answer');
    assert.ok(Array.isArray(accepted_english)&&accepted_english.length>=1&&
     accepted_english.length<=8,'Expected 1-8 answer variants');
    const answers=accepted_english.map(x=>clean(x,100));
    assert.equal(new Set(answers.map(norm)).size,answers.length,'Duplicate answer variants');
    assert.ok(answers.some(x=>norm(x)===norm(ref.english)),
     'Reference English word must be accepted');
    normalized.push({english:ref.english,decision,prompt:norm(prompt),
     answers:answers.map(norm).sort(),reason,source});
   }else{
    assert.equal(proposed_prompt_vi,null,'Revision request must not smuggle a graded prompt');
    assert.equal(accepted_english,null,'Revision request must not smuggle answer keys');
    normalized.push({english:ref.english,decision,prompt:null,answers:[],reason,source});
   }
   completed++;
  }
 }
 return Object.freeze({
  code:expectedCode,completed_cards:completed,
  pending_cards:6-completed,all_cards_complete:completed===6,
  source_snapshot_sha256:baseline.source_snapshot_sha256,
  entries:normalized,
  identity_verified:false,approval_granted:false,
  authorized_to_grade_srs:false,authorized_to_change_production:false
 });
}
export function compareBlindReviewForms(packet,a,b){
 const left=inspectBlindReviewForm(a,packet,'REVIEWER_A');
 const right=inspectBlindReviewForm(b,packet,'REVIEWER_B');
 const byA=new Map(left.entries.map(v=>[v.english,v]));
 const byB=new Map(right.entries.map(v=>[v.english,v]));
 const results=[];
 for(const english of EXPECTED){
  const aRow=byA.get(english),bRow=byB.get(english);
  let status='awaiting_both_reviews';
  if(aRow&&bRow){
   if(aRow.decision!==bRow.decision)status='decision_disagreement';
   else if(aRow.decision==='needs_revision')status='both_need_revision';
   else if(aRow.prompt!==bRow.prompt||
    JSON.stringify(aRow.answers)!==JSON.stringify(bRow.answers))
    status='prompt_or_answer_disagreement';
   else status='drafts_agree_but_unverified';
  }
  results.push({english,status});
 }
 const conflict=[];
 // A shared Vietnamese question cannot be graded as two different single
 // answers unless a separate adjudicator resolves every accepted variant.
 const pairs=[['five','year'],['assess','evaluate'],['significant','substantial']];
 for(const [x,y] of pairs){
  for(const [label,items] of [['REVIEWER_A',byA],['REVIEWER_B',byB]]){
   const aRow=items.get(x),bRow=items.get(y);
   if(aRow?.decision!=='suitable_for_adjudication'||
    bRow?.decision!=='suitable_for_adjudication')continue;
   if(aRow.prompt===bRow.prompt)
    conflict.push({review_code:label,pair:[x,y],reason:'same_prompt_different_target'});
   const intersection=aRow.answers.filter(v=>bRow.answers.includes(v));
   if(intersection.length)conflict.push({
    review_code:label,pair:[x,y],reason:'overlapping_accepted_answers'
   });
  }
 }
 return Object.freeze({
  schema:BLIND_REVIEW_SCHEMA,scope:'offline-comparison-not-independent-person-proof',
  source_snapshot_sha256:editorialSnapshotHash(packet),
  forms_complete:left.all_cards_complete&&right.all_cards_complete,
  compared_cards:results.length,results,collisions:conflict,
  requires_human_adjudication:true, // Even identical drafts require independently verified people and expert signoff.
  draft_disagreement_found:results.some(v=>v.status!=='drafts_agree_but_unverified')||conflict.length>0,
  independent_people_verified:false,
  semantic_accuracy_verified:false,
  signed_immutable_receipts_verified:false,
  authorized_to_approve:false,authorized_to_activate_prompts:false,
  authorized_to_grade_srs:false,authorized_to_modify_production:false
 });
}
