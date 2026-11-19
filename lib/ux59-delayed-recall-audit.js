// UX59 M5: pure aggregate-only audit of independent delayed-recall assessments.
// Research fixture input only. No database, account, SRS or production imports.
const ABS=/T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/i;
const REASONS=['no-consent','unapproved-prompt','not-independent','answer-exposed','assisted','repeat','outside-window'];
function time(s,label){
 if(typeof s!=='string'||!ABS.test(s)||!Number.isFinite(Date.parse(s)))
  throw Error('Invalid timezone-aware '+label);
 return Date.parse(s);
}
function verify(row,windowHours){
 if(!row||typeof row!=='object'||Array.isArray(row)||
   typeof row.trial_id!=='string'||!row.trial_id.trim()||row.trial_id.length>100)
  throw Error('Invalid assessment identity');
 const due=time(row.due_at,'due_at');
 if(typeof row.consent!=='boolean'||typeof row.curated!=='boolean'||
  typeof row.independent!=='boolean'||typeof row.answer_hidden!=='boolean'||
  typeof row.hints_used!=='boolean'||!Number.isSafeInteger(row.attempt_index)||
  row.attempt_index<0)throw Error('Missing server-confirmed assessment flags');
 if(row.observed_at===null){
  if(row.result!==null||row.attempt_index!==0)throw Error('Missing assessment must have no result or attempt');
  return {missing:true};
 }
 const observed=time(row.observed_at,'observed_at');
 if(!['correct','incorrect'].includes(row.result)||row.attempt_index===0)
  throw Error('Invalid observed assessment result');
 const excluded= !row.consent?'no-consent':
  !row.curated?'unapproved-prompt':
  !row.independent?'not-independent':
  !row.answer_hidden?'answer-exposed':
  row.hints_used?'assisted':
  row.attempt_index!==1?'repeat':
  (observed<due||observed>due+windowHours*3600000)?'outside-window':null;
 return {missing:false,excluded};
}
// A complete scheduled roster is required, including non-responses.
// Deduplicate identical retransmissions but reject conflicting duplicates.
export function auditDelayedRecallAssessments(rows,{windowHours=24}={}){
 if(!Array.isArray(rows)||rows.length>10000||
  !Number.isSafeInteger(windowHours)||windowHours<1||windowHours>168)
  throw Error('Invalid assessment audit bounds');
 const seen=new Map();
 for(const row of rows){
  const verdict=verify(row,windowHours);
  const fingerprint=JSON.stringify([
   row.due_at,row.observed_at,row.result,row.consent,row.curated,row.independent,
   row.answer_hidden,row.hints_used,row.attempt_index
  ]);
  if(seen.has(row.trial_id)){
   if(seen.get(row.trial_id).fingerprint!==fingerprint)
    throw Error('Conflicting duplicate assessment event');
   continue;
  }
  seen.set(row.trial_id,{verdict,fingerprint,result:row.result});
 }
 const excluded=Object.fromEntries(REASONS.map(k=>[k,0]));
 let missing=0,correct=0,incorrect=0;
 for(const {verdict,result} of seen.values()){
  if(verdict.missing){missing++;continue}
  if(verdict.excluded){excluded[verdict.excluded]++;continue}
  if(result==='correct')correct++;
  else incorrect++;
 }
 const scheduled=seen.size,eligible=correct+incorrect;
 const excludedTotal=Object.values(excluded).reduce((a,b)=>a+b,0);
 if(scheduled!==missing+eligible+excludedTotal)throw Error('Audit count mismatch');
 return {schema:'ux59-m5-delayed-recall-audit-v1',
  scope:'synthetic-roster-only; not real study outcome',
  scheduled,eligible_attempts:eligible,correct,incorrect,missing,excluded,
  excluded_total:excludedTotal,duplicate_replays:rows.length-scheduled,
  eligible_accuracy:eligible?correct/eligible:null,
  completion_coverage:scheduled?(eligible+excludedTotal)/scheduled:null,
  eligible_coverage:scheduled?eligible/scheduled:null};
}
