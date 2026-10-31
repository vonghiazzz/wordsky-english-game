/*
 * UX43D - OFFLINE ONLY: audit quality of curated recall prompts and the
 * descriptive readiness of UX43C evidence. No SQL, API, SRS or user writes.
 *
 * Static lexical audits CANNOT certify bilingual semantic equivalence.
 * Existing typed attempts CANNOT estimate causal SRS v2 effectiveness:
 * there is no randomized policy assignment, full exposure history,
 * independently defined long-horizon retention outcome or censoring log.
 */
import {
 prepareTypedRecallTrial,normalizeTypedEnglish,
 RECALL_CONSENT,RECALL_KIND
} from './ux43b-recall-evidence.js';

export const UX43D_AUDIT_VERSION='ux43d-offline-readiness-v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ABSOLUTE=/T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
const REVIEW_UUID='00000000-0000-4000-8000-000000000042';
const DAY=86400000;
const MAX_ROWS=50000;
const REASONS=[
 'missing_or_disabled_word',
 'untrusted_curator',
 'catalog_answer_missing',
 'invalid_prompt_or_variants',
 'duplicate_active_word',
 'ambiguous_shared_cue'
];

function bounded(rows,label){
 if(!Array.isArray(rows)||rows.length>MAX_ROWS)
  throw Error('UX43D invalid or oversized '+label);
}
function uuid(value,label){
 if(typeof value!=='string'||!UUID.test(value))
  throw Error('UX43D invalid '+label);
 return value.toLowerCase();
}
function utc(value,label){
 if(typeof value!=='string'||!ABSOLUTE.test(value)||
  !Number.isFinite(Date.parse(value)))
  throw Error('UX43D '+label+' requires an explicit timezone');
 return new Date(value).toISOString();
}
function canonicalVi(value){
 if(typeof value!=='string')return null;
 const normalized=value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
 return normalized||null;
}
function addIssue(issues,id,reason){issues.get(id).add(reason);}
function addTo(map,key,id){
 if(!key)return;
 if(!map.has(key))map.set(key,[]);
 map.get(key).push(id);
}

/**
 * Input: a deliberately obtained trusted COPY of the shared vocabulary
 * and manually curated prompt candidates, NOT raw browser input.
 *
 * Output: aggregate counters only. Findings must be interpreted by a
 * human bilingual curator; no row is automatically approved or written.
 */
export function auditCuratedPromptCatalog({vocabulary,prompts}={}){
 bounded(vocabulary,'vocabulary');
 bounded(prompts,'curated prompts');
 const words=new Map();
 let enabledWords=0;
 for(const row of vocabulary){
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('UX43D bad vocabulary row');
  const id=uuid(row.id,'catalog word ID');
  if(words.has(id))throw Error('UX43D duplicate catalog word');
  if(typeof row.english!=='string'||!row.english.trim()||
    typeof row.enabled!=='boolean'||typeof row.topic_enabled!=='boolean')
   throw Error('UX43D invalid catalog fields');
  words.set(id,row);
  if(row.enabled&&row.topic_enabled)enabledWords++;
 }
 const usedPromptIds=new Set(),active=new Map(),issues=new Map();
 const wordGroups=new Map(),cueGroups=new Map();
 let inactiveOrUnapproved=0;
 for(const row of prompts){
  if(!row||typeof row!=='object'||Array.isArray(row))
   throw Error('UX43D bad prompt row');
  const id=uuid(row.id,'prompt ID');
  const wordId=uuid(row.word_id,'prompt word ID');
  if(usedPromptIds.has(id))throw Error('UX43D duplicate prompt ID');
  usedPromptIds.add(id);
  if(typeof row.approved!=='boolean'||typeof row.active!=='boolean')
   throw Error('UX43D missing prompt review status');
  if(!row.active||!row.approved){inactiveOrUnapproved++;continue;}
  active.set(id,row);issues.set(id,new Set());
  const catalog=words.get(wordId);
  if(!catalog||!catalog.enabled||!catalog.topic_enabled)
   addIssue(issues,id,'missing_or_disabled_word');
  if(row.curator!=='owner')
   addIssue(issues,id,'untrusted_curator');
  if(catalog){
   try{
    const english=normalizeTypedEnglish(catalog.english);
    if(!Array.isArray(row.accepted_english)||
       !row.accepted_english.some(v=>normalizeTypedEnglish(v)===english))
     addIssue(issues,id,'catalog_answer_missing');
   }catch{addIssue(issues,id,'catalog_answer_missing');}
  }
  try{
   prepareTypedRecallTrial({
    trial_id:id,account_id:REVIEW_UUID,source:'shared',word_id:wordId,
    prompt_vi:row.prompt_vi,accepted_english:row.accepted_english,
    answer_revision:row.answer_revision,
    prompt_curation_approved:true,answer_hidden:true,
    issued_at:'2026-10-31T00:00:00Z',
    expires_at:'2026-10-31T00:04:00Z',
    research_consent:false
   });
  }catch{addIssue(issues,id,'invalid_prompt_or_variants');}
  addTo(wordGroups,wordId,id);
  addTo(cueGroups,canonicalVi(row.prompt_vi),id);
 }
 for(const group of wordGroups.values()){
  if(group.length>1)for(const id of group)addIssue(issues,id,'duplicate_active_word');
 }
 for(const group of cueGroups.values()){
  const uniqueWords=new Set(group.map(id=>active.get(id).word_id.toLowerCase()));
  if(uniqueWords.size>1)
   for(const id of group)addIssue(issues,id,'ambiguous_shared_cue');
 }
 const blockedBy=Object.fromEntries(REASONS.map(reason=>[reason,0]));
 let eligiblePrompts=0,blockedPrompts=0;
 const eligibleWords=new Set();
 for(const [id,flags] of issues){
  if(flags.size===0){eligiblePrompts++;eligibleWords.add(active.get(id).word_id.toLowerCase());}
  else{
   blockedPrompts++;
   for(const reason of flags)blockedBy[reason]++;
  }
 }
 if(eligiblePrompts+blockedPrompts+inactiveOrUnapproved!==prompts.length)
  throw Error('UX43D curation counter invariant');
 return Object.freeze({
  version:UX43D_AUDIT_VERSION,
  scope:'offline-shared-card-lexical-quality-only',
  population:{
   catalog_words:vocabulary.length,enabled_words:enabledWords,
   reviewed_prompt_records:prompts.length,
   active_approved_records:active.size,
   inactive_or_unapproved_records:inactiveOrUnapproved,
   lexically_eligible_records:eligiblePrompts,
   lexically_blocked_records:blockedPrompts,
   lexically_eligible_distinct_words:eligibleWords.size,
   enabled_words_without_eligible_prompt:enabledWords-eligibleWords.size
  },
  blocked_by_reason:blockedBy,
  human_semantic_review_required:true,
  verified_bilingual_meaning_equivalence:false,
  authorized_to_activate_prompts:false,
  conclusion:'lexical QA only; never auto-approve or activate curated prompts'
 });
}

/**
 * Validate the ACTUAL persisted UX43C evidence row shape (not the richer
 * offline UX43B prototype shape). These are first-attempt trial receipts,
 * not objectively independently measured long-horizon retention.
 */
export function auditUx43cEvidenceReadiness({events,as_of,min_public_accounts=5}={}){
 bounded(events,'evidence rows');
 const at=utc(as_of,'as_of');
 if(!Number.isSafeInteger(min_public_accounts)||min_public_accounts<5)
  throw Error('UX43D minimum cohort privacy threshold must be >=5');
 const uniqueTrials=new Set(),uniqueRequests=new Set();
 const users=new Set(),words=new Set(),groups=new Map();
 const outcomes={correct:0,incorrect:0},latencies={
  'under-1s':0,'1-5s':0,'5-15s':0,'15-60s':0,'60s-plus':0
 };
 for(const row of events){
  if(!row||typeof row!=='object'||Array.isArray(row)||
   row.prompt_kind!==RECALL_KIND||row.consent_version!==RECALL_CONSENT||
   !['correct','incorrect'].includes(row.result)||
   !Object.hasOwn(latencies,row.response_latency)||
   typeof row.answer_revision!=='string'||
   !/^[A-Za-z0-9._-]{1,64}$/.test(row.answer_revision))
   throw Error('UX43D invalid / unconsented evidence record');
  // Raw answer or prompt text is not part of the minimal data contract.
  for(const secret of ['response','typed_answer','prompt_vi','accepted_english','password_hash']){
   if(Object.hasOwn(row,secret))throw Error('UX43D raw private data in evidence');
  }
  const trial=uuid(row.trial_id,'trial ID');
  const owner=uuid(row.user_id,'user ID');
  const word=uuid(row.word_id,'word ID');
  const request=uuid(row.request_id,'request ID');
  const timestamp=utc(row.observed_at,'observed_at');
  if(Date.parse(timestamp)>Date.parse(at))
   throw Error('UX43D event exceeds snapshot');
  if(uniqueTrials.has(trial)||uniqueRequests.has(JSON.stringify([owner,request])))
   throw Error('UX43D duplicate trial or request');
  uniqueTrials.add(trial);
  uniqueRequests.add(JSON.stringify([owner,request]));
  users.add(owner);words.add(word);
  const cardKey=JSON.stringify([owner,word]);
  if(!groups.has(cardKey))groups.set(cardKey,[]);
  groups.get(cardKey).push(timestamp);
  outcomes[row.result]++;
  latencies[row.response_latency]++;
 }
 let firstObservations=0,repeatObservations=0,repeatGapAtLeast7d=0;
 for(const timestamps of groups.values()){
  timestamps.sort();
  firstObservations++;
  for(let i=1;i<timestamps.length;i++){
   repeatObservations++;
   if(Date.parse(timestamps[i])-Date.parse(timestamps[i-1])>=7*DAY)
    repeatGapAtLeast7d++;
  }
 }
 if(firstObservations+repeatObservations!==events.length)
  throw Error('UX43D evidence counter invariant');
 return Object.freeze({
  version:UX43D_AUDIT_VERSION,
  cohort:'persisted-consented-ux43c-typed-trial-receipts-only',
  as_of:at,
  observations:{
   total:events.length,accounts:users.size,words:words.size,
   unique_account_word_pairs:groups.size,
   first_account_word_observations:firstObservations,
   repeat_account_word_observations:repeatObservations,
   repeats_separated_by_at_least_7d:repeatGapAtLeast7d,
   outcomes,latency_buckets:latencies
  },
  privacy:{
   minimum_accounts_for_public_aggregate:min_public_accounts,
   small_cohort_do_not_publish:users.size<min_public_accounts
  },
  missing_required_evaluation_evidence:[
   'complete-interval-exposure-history',
   'randomized-or-identified-policy-assignment',
   'pre-registered-delayed-retention-outcome',
   'censoring-and-external-practice-record',
   'independent-holdout-and-calibration-protocol'
  ],
  valid_to_estimate_long_term_retention:false,
  valid_to_compare_srs_v2_effectiveness:false,
  conclusion:'descriptive trial outcomes only; not retention or causal SRS comparison'
 });
}
