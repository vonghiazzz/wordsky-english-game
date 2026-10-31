/*
 * UX43B - OFFLINE ONLY typed recall research prototype.
 * Distinct from subjective UX24 'remembered' and automatic UX27 mistakes.
 * No DB/API/SRS writes. No browser request can supply trusted answers.
 *
 * WeakMap hides answer keys from the serializable public challenge, but is
 * NOT a serverless/persistent challenge ledger. Backend integration is NOT
 * authorized until an atomic, consent-scoped DB design is approved.
 */
export const RECALL_PROTOCOL='ux43b-typed-en-v1';
export const RECALL_CONSENT='ux43b-opt-in-v1';
export const RECALL_KIND='vi-to-en-typed';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ABSOLUTE=/T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
const PRIVATE=new WeakMap();
const TTL=300000;
function absolute(value,label){
 if(typeof value!=='string'||!ABSOLUTE.test(value)||!Number.isFinite(Date.parse(value)))
  throw Error('UX43B '+label+' must have a timezone');
 return new Date(value).toISOString();
}
function uuid(value,label){
 if(typeof value!=='string'||!UUID.test(value))throw Error('UX43B invalid '+label);
 return value.toLowerCase();
}
function safeText(value,label,max){
 if(typeof value!=='string'||!value.trim()||value.length>max||
    /[\u0000-\u001f\u007f]/u.test(value))
  throw Error('UX43B invalid '+label);
 return value.trim();
}
export function normalizeTypedEnglish(value){
 if(typeof value!=='string'||value.length>160||
    /[\u0000-\u001f\u007f]/u.test(value))
  throw Error('UX43B invalid typed answer');
 return value.normalize('NFKC')
  .replace(/[\u2018\u2019]/gu,"'")
  .replace(/\s+/gu,' ')
  .trim()
  .toLowerCase();
}
function acceptedKeys(values){
 if(!Array.isArray(values)||values.length<1||values.length>8)
  throw Error('UX43B expected 1-8 curated variants');
 const keys=new Set();
 for(const value of values){
  const normalized=normalizeTypedEnglish(safeText(value,'curated answer',80));
  if(!/^[a-z0-9][a-z0-9 '-]*[a-z0-9]$/u.test(normalized)&&
     !/^[a-z0-9]$/u.test(normalized))
   throw Error('UX43B unsupported answer requires manual curation');
  if(keys.has(normalized))throw Error('UX43B duplicate curated answer');
  keys.add(normalized);
 }
 return keys;
}
function leaksAnswer(prompt,keys){
 const text=prompt.normalize('NFKC').toLowerCase()
  .replace(/[\u2018\u2019]/gu,"'");
 for(const accepted of keys){
  // Accepted keys contain only letters, digits, apostrophe, hyphen or space:
  // no regex metacharacters; match whole tokens/phrases only.
  const expression=new RegExp('(^|[^\\p{L}\\p{N}])'+accepted+
   '(?=$|[^\\p{L}\\p{N}])','iu');
  if(expression.test(text))return true;
 }
 return false;
}

/* Must be prepared exclusively from a trusted, curated SERVER catalog.
 * Returns a public DTO with NO accepted answers, user ID or word ID.
 */
export function prepareTypedRecallTrial({
 trial_id,account_id,source,word_id,prompt_vi,accepted_english,
 answer_revision,issued_at,expires_at,
 prompt_curation_approved,answer_hidden,research_consent=false,
 consent_version
}){
 const trialId=uuid(trial_id,'trial_id');
 const owner=uuid(account_id,'account_id');
 const word=uuid(word_id,'word_id');
 if(!['shared','personal'].includes(source))throw Error('UX43B invalid source');
 const prompt=safeText(prompt_vi,'prompt_vi',180);
 const revision=safeText(answer_revision,'answer_revision',64);
 if(!/^[a-zA-Z0-9._-]+$/.test(revision))
  throw Error('UX43B invalid answer revision');
 const keys=acceptedKeys(accepted_english);
 if(prompt_curation_approved!==true||answer_hidden!==true||
    leaksAnswer(prompt,keys))
  throw Error('UX43B prompt is ambiguous, uncurated or reveals answer');
 if(typeof research_consent!=='boolean'||
    (research_consent&&consent_version!==RECALL_CONSENT)||
    (!research_consent&&consent_version!==undefined))
  throw Error('UX43B explicit opt-in consent required for evidence');
 const issued=absolute(issued_at,'issued_at');
 const expiry=absolute(expires_at,'expires_at');
 const lifetime=Date.parse(expiry)-Date.parse(issued);
 if(lifetime<=0||lifetime>TTL)throw Error('UX43B invalid lifetime');
 const publicTrial=Object.freeze({
  trial_id:trialId,prompt_kind:RECALL_KIND,prompt_vi:prompt,expires_at:expiry
 });
 PRIVATE.set(publicTrial,Object.freeze({
  account_id:owner,source,word_id:word,answer_revision:revision,
  keys,issued_at:issued,expires_at:expiry,consent:research_consent
 }));
 return publicTrial;
}
function bucket(ms){
 if(ms<1000)return 'under-1s';
 if(ms<5000)return '1-5s';
 if(ms<15000)return '5-15s';
 if(ms<60000)return '15-60s';
 return '60s-plus';
}

/* Provenance below MUST be server-confirmed by an eventual DB ledger,
 * never accepted from the client. UX43B has no HTTP handler or DB ledger.
 */
export function gradeTypedRecallTrial(trial,{
 trial_id,response,server_submitted_at,server_attempt_index,
 server_hints_used,server_answer_revealed
}={}){
 const secret=PRIVATE.get(trial);
 if(!secret)throw Error('UX43B cannot grade untrusted/serialized trial');
 if(uuid(trial_id,'trial_id')!==trial.trial_id)
  throw Error('UX43B trial identity mismatch');
 if(!Number.isSafeInteger(server_attempt_index)||server_attempt_index<1||
    typeof server_hints_used!=='boolean'||typeof server_answer_revealed!=='boolean')
  throw Error('UX43B server-verified provenance required');
 const submitted=absolute(server_submitted_at,'server_submitted_at');
 const t=Date.parse(submitted),start=Date.parse(secret.issued_at);
 if(t<start)throw Error('UX43B submission predates issuance');
 const normalized=normalizeTypedEnglish(response);
 const correct=normalized!==''&&secret.keys.has(normalized);
 let exclusion=null;
 if(!secret.consent)exclusion='no-consent';
 else if(t>Date.parse(secret.expires_at))exclusion='expired';
 else if(server_attempt_index!==1)exclusion='repeat';
 else if(server_hints_used||server_answer_revealed)exclusion='assisted-or-exposed';
 else if(!normalized)exclusion='blank';
 if(exclusion)return {feedback:{correct},evidence:null,exclusion};
 const evidence=Object.freeze({
  protocol:RECALL_PROTOCOL,
  trial_id:trial.trial_id,
  account_id:secret.account_id,
  source:secret.source,
  word_id:secret.word_id,
  answer_revision:secret.answer_revision,
  prompt_kind:RECALL_KIND,
  first_attempt:true,unassisted:true,
  result:correct?'correct':'incorrect',
  response_latency:bucket(t-start),
  observed_at:submitted,
  consent_version:RECALL_CONSENT
 });
 // Never include typed response, accepted list, prompt or password.
 return {feedback:{correct},evidence,exclusion:null};
}

/* Aggregate-only; cohort is objective typed-trial correctness, NOT a
 * validated long-term retention curve or causal policy improvement.
 * Duplicate records fail closed rather than silently double counting.
 */
export function aggregateTypedRecallEvidence(events,{as_of}={}){
 const at=absolute(as_of,'as_of');
 if(!Array.isArray(events)||events.length>50000)
  throw Error('UX43B invalid or oversized cohort');
 const unique=new Set(),latencies=['under-1s','1-5s','5-15s','15-60s','60s-plus'];
 const report={
  protocol:RECALL_PROTOCOL,cohort:'consented-unassisted-first-typed-attempts',
  as_of:at,
  total_graded_events:0,outcomes:{correct:0,incorrect:0},
  source:{shared:0,personal:0},
  latency:Object.fromEntries(latencies.map(k=>[k,0])),
  conclusion:'descriptive-only; not long-term retention or causal SRS superiority'
 };
 for(const row of events){
  if(!row||typeof row!=='object'||Array.isArray(row)||
     row.protocol!==RECALL_PROTOCOL||
     !['correct','incorrect'].includes(row.result)||
     !['shared','personal'].includes(row.source)||
     !latencies.includes(row.response_latency)||
     row.prompt_kind!==RECALL_KIND||row.first_attempt!==true||
     row.unassisted!==true||row.consent_version!==RECALL_CONSENT||
     typeof row.answer_revision!=='string'||!row.answer_revision)
   throw Error('UX43B rejected unverified evidence');
  const key=uuid(row.account_id,'account_id')+':'+uuid(row.trial_id,'trial_id');
  uuid(row.word_id,'word_id');
  if(Date.parse(absolute(row.observed_at,'observed_at'))>Date.parse(at))
   throw Error('UX43B event is after snapshot time');
  if(unique.has(key))throw Error('UX43B duplicate challenge evidence');
  unique.add(key);
  report.total_graded_events++;
  report.outcomes[row.result]++;
  report.source[row.source]++;
  report.latency[row.response_latency]++;
 }
 return report;
}
