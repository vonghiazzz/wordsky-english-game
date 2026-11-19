// UX59 M6 - synthetic TRUSTED-SNAPSHOT contract; not an authentication layer.
// A caller may NOT accept this shape from a browser. No database or SRS imports.
import {RECALL_CONSENT,RECALL_PROTOCOL,RECALL_KIND} from './ux43b-recall-evidence.js';

const ABS=/T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/i;
const stamp=(s,label)=>{
 if(typeof s!=='string'||!ABS.test(s)||!Number.isFinite(Date.parse(s)))
  throw Error('Invalid timezone-aware '+label);
 return Date.parse(s);
};
const name=(s,label)=>{if(typeof s!=='string'||s.length<1||s.length>100||
 /[\u0000-\u001f\u007f]/u.test(s))throw Error('Invalid '+label);return s};
const statuses=['not-consented','not-curated','revision-mismatch','answer-exposed',
 'assisted','repeat','trial-outside-window','observation-outside-window'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function reconcileDelayedRecallEvidence(assignments,evidence,{windowHours=24}={}){
 if(!Array.isArray(assignments)||!Array.isArray(evidence)||
 assignments.length>10000||evidence.length>10000||
 !Number.isInteger(windowHours)||windowHours<1||windowHours>168)
  throw Error('Invalid reconciliation bounds');
 const roster=new Map();
 for(const a of assignments){
  if(!a||typeof a!=='object'||Array.isArray(a))throw Error('Invalid assignment');
  name(a.trial_id,'trial_id');name(a.account_id,'account_id');
  name(a.word_id,'word_id');name(a.answer_revision,'answer_revision');
  const assigned=stamp(a.assigned_at,'assigned_at'),due=stamp(a.due_at,'due_at');
  if(assigned>due||typeof a.independent!=='boolean'||a.independent!==true)
   throw Error('Assignment must be independently scheduled in advance');
  if(roster.has(a.trial_id))throw Error('Duplicate assigned trial');
  roster.set(a.trial_id,{a,due});
 }
 const seen=new Map();
 for(const e of evidence){
  if(!e||typeof e!=='object'||Array.isArray(e))throw Error('Invalid evidence');
  name(e.trial_id,'trial_id');
  if(!roster.has(e.trial_id))throw Error('Orphan evidence trial');
  if(seen.has(e.trial_id)){
   if(!same(seen.get(e.trial_id),e))throw Error('Conflicting evidence replay');
   continue;
  }
  seen.set(e.trial_id,e);
 }
 const excluded=Object.fromEntries(statuses.map(k=>[k,0]));
 let missing=0,correct=0,incorrect=0;
 for(const [trial,{a,due}] of roster){
  const e=seen.get(trial);
  if(!e){missing++;continue}
  // A provenance mismatch is a data-integrity failure, not an eligible
  // grade or an exclusion that can mask cross-account contamination.
  if(e.account_id!==a.account_id||e.word_id!==a.word_id)
   throw Error('Actor or word provenance mismatch');
  if(e.protocol!==RECALL_PROTOCOL||e.prompt_kind!==RECALL_KIND)
   throw Error('Recall protocol mismatch');
  const issued=stamp(e.issued_at,'issued_at'),observed=stamp(e.observed_at,'observed_at');
  if(observed<issued)throw Error('Observation predates issuance');
  if(!['correct','incorrect'].includes(e.result)||typeof e.answer_hidden!=='boolean'||
    typeof e.hints_used!=='boolean'||typeof e.curated!=='boolean'||
    !Number.isSafeInteger(e.attempt_index)||e.attempt_index<1)
   throw Error('Unverified grading provenance');
  const cause=e.consent_version!==RECALL_CONSENT?'not-consented':
   e.curated!==true?'not-curated':
   e.answer_revision!==a.answer_revision?'revision-mismatch':
   e.answer_hidden!==true?'answer-exposed':
   e.hints_used?'assisted':
   e.attempt_index!==1?'repeat':
   (issued<due||issued>due+windowHours*3600000)?'trial-outside-window':
   (observed<due||observed>due+windowHours*3600000)?'observation-outside-window':null;
  if(cause)excluded[cause]++;
  else if(e.result==='correct')correct++;
  else incorrect++;
 }
 const scheduled=roster.size,eligible=correct+incorrect;
 const excluded_total=Object.values(excluded).reduce((a,b)=>a+b,0);
 if(scheduled!==eligible+excluded_total+missing)throw Error('Reconciliation invariant violated');
 return {schema:'ux59-m6-provenance-reconciliation-v1',
  scope:'synthetic trusted-fixture contract; no real provenance established',
  scheduled,eligible_attempts:eligible,correct,incorrect,missing,
  excluded,excluded_total,duplicate_replays:evidence.length-seen.size,
  eligible_accuracy:eligible?correct/eligible:null,
  eligible_coverage:scheduled?eligible/scheduled:null};
}
