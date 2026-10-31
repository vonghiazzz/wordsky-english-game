/*
 * UX43E2A - pure, fail-closed review preflight for trusted internal records.
 * NOT a review submission API, identity provider, approval or activation route.
 * Production, PostgreSQL, user progress and consent are never touched here.
 */
import {createHash} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const REVISION=/^[A-Za-z0-9._-]{1,64}$/;
const ABSOLUTE=/T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/i;
export const RECALL_REVIEW_POLICY='ux43e2a-independent-blind-v1';
const fail=()=>{throw Error('UX43E2A invalid trusted review snapshot')};
const uuid=x=>typeof x==='string'&&UUID.test(x)?x.toLowerCase():fail();
const clean=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&
 !/[\u0000-\u001f\u007f]/u.test(x)&&x.trim()?x.normalize('NFKC').trim().replace(/\s+/gu,' '):fail();
const canonicalCue=x=>clean(x,180).toLocaleLowerCase('vi');
const isList=(x,max)=>Array.isArray(x)&&x.length<=max||fail();
const add=(set,key)=>set.add(key);

/** Fingerprint the EXACT ordered answer set and catalog interpretation.
 * Do not use this as proof of bilingual meaning or trusted reviewer identity.
 */
export function fingerprintRecallDraft(draft,word){
 if(!draft||!word||typeof draft!=='object'||typeof word!=='object'||
  Array.isArray(draft)||Array.isArray(word))fail();
 const draftId=uuid(draft.id),wordId=uuid(draft.word_id);
 if(wordId!==uuid(word.id)||!REVISION.test(draft.answer_revision)||
  !Array.isArray(draft.accepted_english)||
  draft.accepted_english.length<1||draft.accepted_english.length>8)fail();
 const answers=draft.accepted_english.map(x=>clean(x,100));
 const compare=x=>x.toLocaleLowerCase('en');
 if(new Set(answers.map(compare)).size!==answers.length||
  !answers.map(compare).includes(compare(clean(word.english,100))))fail();
 const snapshot=[RECALL_REVIEW_POLICY,draftId,wordId,
  clean(word.english,100),clean(draft.prompt_vi,180),
  draft.answer_revision,answers];
 return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

/** Evaluates *persisted server-trusted* reviewer roster and blind receipts.
 * Input must never be assembled from browser claims or reviewer-supplied IDs.
 * This function is not wired into an API, database mutation or pilot route.
 */
export function assessRecallReviewGate({draft,word,roster,receipts,activePrompts=[]}={}){
 isList(roster,25);isList(receipts,25);isList(activePrompts,5000);
 const blocked=new Set();
 const digest=fingerprintRecallDraft(draft,word);
 const draftId=uuid(draft.id),wordId=uuid(draft.word_id);
 if(draft.curator!=='owner'||draft.approved!==false||draft.active!==false||
  word.enabled!==true||word.topic_enabled!==true)
  add(blocked,'draft_not_reviewable');
 const people=new Map(),authSubjects=new Map(),reviewerIds=new Set();
 for(const reviewer of roster){
  if(!reviewer||typeof reviewer!=='object'||Array.isArray(reviewer))fail();
  const id=uuid(reviewer.id);
  const person=clean(reviewer.person_key,256);
  const subject=clean(reviewer.auth_subject,256);
  if(reviewerIds.has(id)||people.has(person)||authSubjects.has(subject))
   add(blocked,'duplicate_reviewer_identity');
  reviewerIds.add(id);people.set(person,id);authSubjects.set(subject,id);
 }
 const byId=new Map(roster.map(x=>[uuid(x.id),x]));
 const distinctPeople=new Set(),distinctSubjects=new Set();
 const seenReviewers=new Set(),seenReceipts=new Set();
 let approved=0,rejected=0;
 for(const receipt of receipts){
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))fail();
  const id=uuid(receipt.id),reviewerId=uuid(receipt.reviewer_id);
  if(seenReceipts.has(id)||seenReviewers.has(reviewerId))
   add(blocked,'duplicate_initial_receipt');
  seenReceipts.add(id);seenReviewers.add(reviewerId);
  if(uuid(receipt.prompt_id)!==draftId||
   receipt.answer_revision!==draft.answer_revision||
   !SHA.test(String(receipt.snapshot_sha256||''))||
   receipt.snapshot_sha256!==digest)
   add(blocked,'snapshot_mismatch');
  if(receipt.phase!=='blind-initial'||receipt.peer_decision_visible!==false||
   typeof receipt.reviewed_at!=='string'||!ABSOLUTE.test(receipt.reviewed_at)||
   !Number.isFinite(Date.parse(receipt.reviewed_at)))
   add(blocked,'unverified_blinding');
  if(receipt.decision==='approve')approved++;
  else if(receipt.decision==='reject')rejected++;
  else add(blocked,'invalid_decision');
  const reviewer=byId.get(reviewerId);
  if(!reviewer||reviewer.active!==true||
   reviewer.identity_verified!==true||reviewer.bilingual_verified!==true||
   reviewer.person_key==='owner'||reviewer.auth_subject==='owner'||
   reviewer.is_curator===true)
   add(blocked,'unverified_or_self_reviewer');
  else{
   distinctPeople.add(reviewer.person_key);
   distinctSubjects.add(reviewer.auth_subject);
  }
 }
 if(receipts.length!==2||seenReviewers.size!==2||
  distinctPeople.size!==2||distinctSubjects.size!==2)
  add(blocked,'two_independent_reviews_required');
 if(rejected>0)add(blocked,'rejection_requires_new_revision_or_adjudication');
 if(approved>0&&rejected>0)add(blocked,'reviewer_disagreement');
 for(const record of activePrompts){
  if(!record||typeof record!=='object'||Array.isArray(record))fail();
  if(record.active!==true)continue;
  if(record.approved!==true)add(blocked,'unapproved_active_prompt');
  const activeWord=uuid(record.word_id);
  if(activeWord===wordId)add(blocked,'active_word_collision');
  if(activeWord!==wordId&&canonicalCue(record.prompt_vi)===canonicalCue(draft.prompt_vi))
   add(blocked,'ambiguous_shared_cue');
 }
 const reasons=[...blocked].sort();
 return Object.freeze({
  policy:RECALL_REVIEW_POLICY,
  scope:'trusted-offline-preflight-only',
  initial_receipts:receipts.length,
  approval_votes:approved,
  rejection_votes:rejected,
  review_gate_preconditions_met:reasons.length===0,
  blocked_by:reasons,
  human_semantic_review_required:true,
  immutable_database_receipts_verified:false,
  independently_authenticated_reviewer_service_available:false,
  authorized_to_activate_prompts:false
 });
}
