/*
 * UX43E2B1 - OFFLINE ONLY. Trusted reviewer identity + tamper-evident
 * blind-initial review receipt contract. NO API, login, DB, approval,
 * activation or player enrollment is implemented here.
 *
 * A verifier adapter MUST validate an external IdP's signature, issuer,
 * audience, expiry, authentication method and person binding BEFORE
 * producing the principal passed to this module. A caller-supplied object
 * (or a second WordSky account) is NEVER proof of a second human.
 */
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {fingerprintRecallDraft,assessRecallReviewGate} from './ux43e2-review-gate.js';

export const REVIEWER_PROOF_VERSION='ux43e2b1-blind-receipt-v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const REVISION=/^[A-Za-z0-9._-]{1,64}$/;
const RECEIPT_FIELDS=[
 'proof_version','id','prompt_id','reviewer_id','answer_revision',
 'snapshot_sha256','phase','peer_decision_visible','decision','reviewed_at',
 'identity_subject_fingerprint','person_fingerprint'
];
const fail=reason=>{throw Error('UX43E2B1 blocked: '+reason)};
const uuid=x=>typeof x==='string'&&UUID.test(x)?x.toLowerCase():fail('invalid UUID');
const nonempty=(x,max=256)=>typeof x==='string'&&x.length>0&&x.length<=max&&
 x.trim()===x&&!/[\u0000-\u001f\u007f]/u.test(x)?x:fail('invalid identity claim');
function keyBytes(key){
 if(!(key instanceof Uint8Array)||key.byteLength<32)fail('dedicated receipt signing key required');
 return key;
}
function hmac(key,domain,value){
 return createHmac('sha256',keyBytes(key)).update(REVIEWER_PROOF_VERSION+'\n'+domain+'\n'+value,'utf8').digest('hex');
}
const signature=(key,receipt)=>hmac(key,'receipt',JSON.stringify(RECEIPT_FIELDS.map(k=>receipt[k])));
function absoluteInstant(value){
 if(typeof value!=='string'||!(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/).test(value)||
  !Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('invalid server timestamp');
 return value;
}
function receiptShape(receipt){
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
  Object.keys(receipt).sort().join('|')!==[...RECEIPT_FIELDS,'signature'].sort().join('|'))
  fail('unexpected receipt fields');
 if(receipt.proof_version!==REVIEWER_PROOF_VERSION||
  receipt.phase!=='blind-initial'||receipt.peer_decision_visible!==false||
  !['approve','reject'].includes(receipt.decision)||
  typeof receipt.answer_revision!=='string'||!REVISION.test(receipt.answer_revision)||
  !SHA.test(String(receipt.snapshot_sha256))||
  !SHA.test(String(receipt.identity_subject_fingerprint))||
  !SHA.test(String(receipt.person_fingerprint))||
  !SHA.test(String(receipt.signature)))fail('invalid receipt');
 for(const f of ['id','prompt_id','reviewer_id'])uuid(receipt[f]);
 absoluteInstant(receipt.reviewed_at);
}
function issuerUrl(issuer){
 const s=nonempty(issuer,512);
 let parsed;
 try{parsed=new URL(s)}catch{fail('invalid issuer URL')}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||
  parsed.search||parsed.hash||parsed.origin==='null')fail('untrusted identity issuer');
 return s;
}

/** Accept only the result of a server-side independent identity verifier.
 * verified_person_key must be a stable unique-person binding established
 * outside WordSky; separate login subjects are NOT sufficient.
 */
export function assertVerifiedReviewerIdentity(principal,roster,{
 expectedIssuer,expectedAudience,now=new Date()
}={}){
 if(!principal||!roster||typeof principal!=='object'||typeof roster!=='object'||
  Array.isArray(principal)||Array.isArray(roster)||
  !(now instanceof Date)||!Number.isFinite(now.getTime()))
  fail('missing trusted reviewer context');
 const issuer=issuerUrl(expectedIssuer);
 const audience=nonempty(expectedAudience,256);
 const id=uuid(roster.id);
 const subject=nonempty(principal.subject);
 const person=nonempty(principal.verified_person_key);
 if(principal.trust_source!=='server-verified-idp'||
  principal.authenticated!==true||
  principal.identity_verified!==true||
  principal.mfa_verified!==true||
  principal.issuer!==issuer||roster.issuer!==issuer||
  principal.audience!==audience||
  roster.auth_subject!==subject||roster.person_key!==person||
  roster.active!==true||roster.identity_verified!==true||
  roster.bilingual_verified!==true||roster.is_curator===true||
  roster.role!=='reviewer'||subject==='owner'||person==='owner')
  fail('identity, independence, MFA or bilingual eligibility unverified');
 const at=principal.auth_time;
 const nowSec=Math.floor(now.getTime()/1000);
 if(!Number.isSafeInteger(at)||at>nowSec+30||at<nowSec-900)
  fail('fresh reviewer MFA required');
 return Object.freeze({id,issuer,subject,person_key:person});
}

/** For a not-yet-wired backend only. An explicitly injected verifier reads
 * an opaque session, then roster from trusted storage. No browser identity
 * field, review visibility flag, or approval field is accepted.
 */
export async function prepareBlindSignedReview({
 opaqueSession,input,draft,word,verifyExternalSession,
 loadTrustedRoster,confirmNoPeerDisclosure,expectedIssuer,expectedAudience,
 signingKey,clock=()=>new Date()
}={}){
 keyBytes(signingKey);
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).length!==1||!Object.hasOwn(input,'decision')||
  !['approve','reject'].includes(input.decision))
  fail('only an initial review decision is accepted');
 if(typeof verifyExternalSession!=='function'||typeof loadTrustedRoster!=='function'||
  typeof confirmNoPeerDisclosure!=='function'||typeof clock!=='function')
  fail('trusted backend adapters required');
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail('trusted clock required');
 if(!draft||draft.curator!=='owner'||draft.approved!==false||
  draft.active!==false||!word||word.enabled!==true||word.topic_enabled!==true)
  fail('draft is not reviewable');
 const principal=await verifyExternalSession(opaqueSession);
 if(!principal)fail('external reviewer authentication required');
 const roster=await loadTrustedRoster({issuer:principal.issuer,subject:principal.subject});
 const actor=assertVerifiedReviewerIdentity(principal,roster,{
  expectedIssuer,expectedAudience,now
 });
 const promptId=uuid(draft.id);
 if(await confirmNoPeerDisclosure({reviewerId:actor.id,promptId})!==true)
  fail('blind initial decision cannot be established');
 const receipt={
  proof_version:REVIEWER_PROOF_VERSION,
  id:randomUUID(),prompt_id:promptId,reviewer_id:actor.id,
  answer_revision:draft.answer_revision,
  snapshot_sha256:fingerprintRecallDraft(draft,word),
  phase:'blind-initial',peer_decision_visible:false,
  decision:input.decision,reviewed_at:now.toISOString(),
  identity_subject_fingerprint:hmac(signingKey,'subject',actor.issuer+'\0'+actor.subject),
  person_fingerprint:hmac(signingKey,'person',actor.issuer+'\0'+actor.person_key)
 };
 return Object.freeze({...receipt,signature:signature(signingKey,receipt)});
}

/** Verifies integrity only. It cannot prove DB immutability, IDP claims,
 * human semantic correctness or that peer decisions were actually hidden.
 */
export function verifyBlindSignedReview(receipt,signingKey){
 receiptShape(receipt);
 const expected=Buffer.from(signature(signingKey,receipt),'hex');
 const actual=Buffer.from(receipt.signature,'hex');
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))
  fail('receipt integrity check failed');
 return Object.freeze({...receipt});
}

/** Combine signed receipts with UX43E2A; ALWAYS deny activation.
 * Caller must supply an externally verified, server-owned roster.
 */
export function assessSignedBlindReviews({draft,word,roster,receipts,
 activePrompts=[],signingKey}={}){
 if(!Array.isArray(roster)||!Array.isArray(receipts)||receipts.length>25)
  fail('invalid trusted review snapshot');
 const people=new Map();
 for(const r of roster){
  if(!r||typeof r!=='object'||Array.isArray(r))fail('invalid reviewer roster');
  people.set(uuid(r.id),r);
 }
 const checked=receipts.map(r=>{
  const verified=verifyBlindSignedReview(r,signingKey);
  const member=people.get(verified.reviewer_id);
  if(!member||member.issuer===undefined||
   verified.identity_subject_fingerprint!==hmac(signingKey,'subject',nonempty(member.issuer)+'\0'+nonempty(member.auth_subject))||
   verified.person_fingerprint!==hmac(signingKey,'person',nonempty(member.issuer)+'\0'+nonempty(member.person_key)))
   fail('receipt not bound to trusted reviewer roster');
  return verified;
 });
 const preflight=assessRecallReviewGate({draft,word,roster,receipts:checked,activePrompts});
 return Object.freeze({...preflight,
  signed_receipt_integrity_verified:true,
  immutable_database_receipts_verified:false,
  independently_authenticated_reviewer_service_available:false,
  authorized_to_activate_prompts:false
 });
}
