/*
 * UX43E2B2 - isolated, provider-neutral reviewer OIDC flow contract.
 * No HTTP route, IdP SDK, database store, reviewer invitation, prompt
 * approval or activation. Nothing here creates WordSky ws_auth cookies.
 *
 * Only a server-selected, audited OIDC SDK adapter may implement
 * identityProvider.exchangeAndVerify(). Never pass in browser claims.
 */
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {assertVerifiedReviewerIdentity} from './ux43e2b-reviewer-proof.js';

const fail=(message,status=403)=>Object.assign(new Error('UX43E2B2 '+message),{status});
const TOKEN=/^[A-Za-z0-9_-]{20,256}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const byteToken=()=>randomBytes(32).toString('base64url');
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const sha64=x=>createHash('sha256').update(x,'utf8').digest('base64url');
const equalsHash=(actual,expected)=>{
 if(typeof actual!=='string'||typeof expected!=='string'||
   !/^[a-f0-9]{64}$/.test(actual)||!/^[a-f0-9]{64}$/.test(expected))return false;
 return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'));
};
const isToken=x=>typeof x==='string'&&TOKEN.test(x);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&Object.keys(value).every(k=>keys.includes(k));
const validTime=x=>Number.isSafeInteger(x)&&x>=0;

export function reviewerOidcFlowEnabled(env=process.env){
 return env.VERCEL_ENV!=='production'&&
  env.WORDSKY_RECALL_PREVIEW_ENABLED==='true'&&
  env.WORDSKY_REVIEWER_AUTH_PREVIEW_ENABLED==='true';
}

export function createReviewerOidcFlow({
 pendingStore,sessionStore,identityProvider,reviewerRoster,
 issuer,audience,redirectUri,clock=()=>Date.now(),env=process.env
}={}){
 if(!reviewerOidcFlowEnabled(env))throw fail('reviewer auth feature is not enabled',404);
 if(!pendingStore||typeof pendingStore.insert!=='function'||
  typeof pendingStore.consume!=='function'||
  !sessionStore||typeof sessionStore.insert!=='function'||
  typeof sessionStore.find!=='function'||typeof sessionStore.revoke!=='function'||
  !identityProvider||typeof identityProvider.exchangeAndVerify!=='function'||
  !reviewerRoster||typeof reviewerRoster.findBySubject!=='function'||
  typeof clock!=='function'||typeof issuer!=='string'||
  typeof audience!=='string'||typeof redirectUri!=='string')
  throw fail('requires trusted server adapters',503);
 let parsedIssuer,parsedRedirect;
 try {parsedIssuer=new URL(issuer);parsedRedirect=new URL(redirectUri)}catch{
  throw fail('invalid pinned IdP configuration',503);
 }
 if(parsedIssuer.protocol!=='https:'||parsedIssuer.origin==='null'||
    parsedIssuer.username||parsedIssuer.password||parsedIssuer.search||parsedIssuer.hash||
    !audience.trim()||audience.length>256||
    parsedRedirect.username||parsedRedirect.password||parsedRedirect.hash||
    !(['https:','http:'].includes(parsedRedirect.protocol))||
    (parsedRedirect.protocol==='http:'&&!['localhost','127.0.0.1'].includes(parsedRedirect.hostname)))
  throw fail('insecure pinned IdP configuration',503);
 const now=()=>{
  const n=clock();
  if(!validTime(n))throw fail('trusted clock required',503);
  return n;
 };
 const strictPrincipal=async(principal,nonce,at)=>{
  // signature_verified and the claims MUST be set exclusively by a vetted
  // SDK after cryptographic JWT validation, including nbf, exp, aud, iss.
  if(!principal||principal.signature_verified!==true||
   principal.trust_source!=='server-verified-idp'||
   principal.issuer!==issuer||principal.audience!==audience||
   !isToken(principal.nonce)||sha(principal.nonce)!==sha(nonce)||
   !validTime(principal.expires_at)||principal.expires_at<=Math.floor(at/1000)||
   !validTime(principal.issued_at)||principal.issued_at>Math.floor(at/1000)+30||
   principal.expires_at<=principal.issued_at)
   throw fail('unverified OIDC token');
  const roster=await reviewerRoster.findBySubject({issuer,subject:principal.subject});
  const actor=assertVerifiedReviewerIdentity(principal,roster,{
   expectedIssuer:issuer,expectedAudience:audience,now:new Date(at)
  });
  return actor;
 };

 async function begin(){
  const state=byteToken(),nonce=byteToken(),verifier=byteToken()+byteToken();
  const browserBinding=byteToken();
  const started=now();
  const saved={
   state_hash:sha(state),binding_hash:sha(browserBinding),
   nonce,code_verifier:verifier,created_at:started,expires_at:started+5*60_000
  };
  await pendingStore.insert(saved);
  return Object.freeze({
   authorization:{state,nonce,code_challenge:sha64(verifier),code_challenge_method:'S256'},
   // Future HTTP controller MUST set this as a Secure/HttpOnly/SameSite=Lax
   // host-only OIDC flow cookie. Never expose it in URL or JavaScript.
   browser_binding_cookie_value:browserBinding,
   authorized_to_activate_prompts:false
  });
 }
 async function complete(input){
  if(!exact(input,['state','code','browser_binding'])||
   !isToken(input.state)||!isToken(input.browser_binding)||
   typeof input.code!=='string'||input.code.length<8||input.code.length>2048||
   /[\u0000-\u001f\u007f]/u.test(input.code))
   throw fail('invalid OIDC callback');
  // Consume must perform a single atomic read+delete; a failed attempt
  // deliberately burns this one-time state. No replacement by SELECT.
  const pending=await pendingStore.consume(sha(input.state));
  const at=now();
  if(!pending||!equalsHash(pending.binding_hash,sha(input.browser_binding))||
   !validTime(pending.expires_at)||pending.expires_at<=at||
   !isToken(pending.nonce)||!isToken(pending.code_verifier)||
   typeof pending.created_at!=='number'||pending.created_at>at)
   throw fail('OIDC state expired, mismatched or already used');
  const principal=await identityProvider.exchangeAndVerify({
   code:input.code,code_verifier:pending.code_verifier,
   expected_nonce:pending.nonce,expected_issuer:issuer,
   expected_audience:audience,redirect_uri:redirectUri
  });
  const actor=await strictPrincipal(principal,pending.nonce,at);
  const opaque=byteToken(),issued=now();
  await sessionStore.insert({
   token_hash:sha(opaque),reviewer_id:actor.id,issuer,
   subject:actor.subject,person_key:actor.person_key,
   issued_at:issued,expires_at:issued+15*60_000
  });
  return Object.freeze({
   // Future HTTP controller MUST return this only in a Secure/HttpOnly/
   // SameSite=Strict cookie, never as JSON, localStorage or URL.
   reviewer_session_cookie_value:opaque,
   role:'reviewer',expires_at:issued+15*60_000,
   authorized_to_activate_prompts:false
  });
 }
 async function authenticate(opaque){
  if(!isToken(opaque))throw fail('invalid reviewer session',401);
  const session=await sessionStore.find(sha(opaque));
  const at=now();
  if(!session||!validTime(session.expires_at)||session.expires_at<=at||
   !UUID.test(String(session.reviewer_id||''))||
   session.issuer!==issuer||typeof session.subject!=='string'||
   typeof session.person_key!=='string')
   throw fail('reviewer session missing or expired',401);
  // Fresh roster revalidation immediately revokes removed or downgraded
  // reviewers, independently of any existing session cookie.
  const roster=await reviewerRoster.findBySubject({issuer,subject:session.subject});
  if(!roster||roster.id!==session.reviewer_id||
   roster.person_key!==session.person_key||roster.auth_subject!==session.subject||
   roster.issuer!==issuer||roster.role!=='reviewer'||
   roster.active!==true||roster.identity_verified!==true||
   roster.bilingual_verified!==true||roster.is_curator===true)
   throw fail('reviewer is no longer authorized',401);
  return Object.freeze({id:roster.id,role:'reviewer',can_approve:false,can_activate:false});
 }
 async function revoke(opaque){
  if(!isToken(opaque))throw fail('invalid reviewer session',401);
  await sessionStore.revoke(sha(opaque));
  return Object.freeze({revoked:true,authorized_to_activate_prompts:false});
 }
 return Object.freeze({begin,complete,authenticate,revoke});
}
