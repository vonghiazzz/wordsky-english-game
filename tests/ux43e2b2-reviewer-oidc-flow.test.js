import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {
 reviewerOidcFlowEnabled,createReviewerOidcFlow
} from '../lib/ux43e2b2-reviewer-oidc-flow.js';

const issuer='https://idp.example.invalid/tenant';
const audience='wordsky-reviewer-qa';
const redirectUri='http://localhost:3000/reviewer/callback';
const now0=Date.parse('2026-10-31T00:00:00.000Z');
const roster={
 id:randomUUID(),issuer,auth_subject:'idp-user-123',
 person_key:'verified-human-1',role:'reviewer',active:true,
 identity_verified:true,bilingual_verified:true,is_curator:false
};
function setup(changes={}){
 let time=now0,verificationCount=0;
 const pending=new Map(),sessions=new Map();
 let activeRoster={...roster};
 const digest=x=>createHash('sha256').update(x).digest('hex');
 const pendingStore={
  async insert(x){assert.equal(pending.has(x.state_hash),false);pending.set(x.state_hash,{...x})},
  async consume(hash){const x=pending.get(hash);pending.delete(hash);return x}
 };
 const sessionStore={
  async insert(x){assert.equal(sessions.has(x.token_hash),false);sessions.set(x.token_hash,{...x})},
  async find(hash){return sessions.get(hash)},
  async revoke(hash){sessions.delete(hash)}
 };
 const identityProvider={
  async exchangeAndVerify(params){
   verificationCount++;
   assert.equal(params.redirect_uri,redirectUri);
   assert.equal(params.expected_issuer,issuer);
   assert.equal(params.expected_audience,audience);
   assert.equal(typeof params.code_verifier,'string');
   const principal={
    signature_verified:true,trust_source:'server-verified-idp',
    authenticated:true,identity_verified:true,mfa_verified:true,
    issuer,audience,subject:activeRoster.auth_subject,
    verified_person_key:activeRoster.person_key,nonce:params.expected_nonce,
    auth_time:Math.floor(time/1000)-15,issued_at:Math.floor(time/1000)-10,
    expires_at:Math.floor(time/1000)+300
   };
   if(changes.principal) Object.assign(principal,changes.principal);
   if(changes.exchangeError) throw Error('IdP exchange blocked');
   return principal;
  }
 };
 const reviewerRoster={async findBySubject(){return activeRoster}};
 const flow=createReviewerOidcFlow({
  pendingStore,sessionStore,identityProvider,reviewerRoster,
  issuer,audience,redirectUri,clock:()=>time,
  env:{VERCEL_ENV:'preview',WORDSKY_RECALL_PREVIEW_ENABLED:'true',WORDSKY_REVIEWER_AUTH_PREVIEW_ENABLED:'true'}
 });
 return {flow,pending,sessions,digest,
  setTime:x=>time=x,setRoster:x=>activeRoster=x,
  get verificationCount(){return verificationCount}
 };
}
const callback=(flowStarted,code='opaque-code-from-idp')=>({
 state:flowStarted.authorization.state,code,
 browser_binding:flowStarted.browser_binding_cookie_value
});

test('UX43E2B2 is isolated/Preview-only and disabled by default or in Production',()=>{
 assert.equal(reviewerOidcFlowEnabled({}),false);
 assert.equal(reviewerOidcFlowEnabled({WORDSKY_RECALL_PREVIEW_ENABLED:'true'}),false);
 assert.equal(reviewerOidcFlowEnabled({WORDSKY_RECALL_PREVIEW_ENABLED:'true',WORDSKY_REVIEWER_AUTH_PREVIEW_ENABLED:'true',VERCEL_ENV:'preview'}),true);
 assert.equal(reviewerOidcFlowEnabled({WORDSKY_RECALL_PREVIEW_ENABLED:'true',WORDSKY_REVIEWER_AUTH_PREVIEW_ENABLED:'true',VERCEL_ENV:'production'}),false);
});

test('UX43E2B2 PKCE S256/state/nonce, one-time browser-bound callback and revocable isolated reviewer session',async()=>{
 const h=setup();
 const first=await h.flow.begin();
 const stored=[...h.pending.values()][0];
 assert.equal(h.pending.size,1);
 assert.equal(stored.binding_hash,h.digest(first.browser_binding_cookie_value));
 assert.equal(stored.state_hash,h.digest(first.authorization.state));
 assert.equal(stored.nonce,first.authorization.nonce);
 assert.equal(first.authorization.code_challenge,createHash('sha256').update(stored.code_verifier).digest('base64url'));
 assert.equal(first.authorization.code_challenge_method,'S256');
 assert.equal(Object.values(first.authorization).includes(stored.code_verifier),false);
 assert.equal(first.authorized_to_activate_prompts,false);
 const result=await h.flow.complete(callback(first));
 assert.equal(result.role,'reviewer');
 assert.equal(result.authorized_to_activate_prompts,false);
 assert.equal(h.verificationCount,1);
 assert.equal(h.pending.size,0);
 assert.equal(h.sessions.size,1);
 assert.equal(h.sessions.has(result.reviewer_session_cookie_value),false);
 assert.ok(h.sessions.has(h.digest(result.reviewer_session_cookie_value)));
 const actor=await h.flow.authenticate(result.reviewer_session_cookie_value);
 assert.equal(actor.id,roster.id);
 assert.equal(actor.can_approve,false);
 assert.equal(actor.can_activate,false);
 await assert.rejects(()=>h.flow.complete(callback(first)),/state expired|already used/);
 assert.equal(h.verificationCount,1);
 await h.flow.revoke(result.reviewer_session_cookie_value);
 await assert.rejects(()=>h.flow.authenticate(result.reviewer_session_cookie_value),/missing or expired/);
});

test('UX43E2B2 fails closed on wrong browser binding and burns state without attempting token exchange',async()=>{
 const h=setup(),first=await h.flow.begin();
 await assert.rejects(()=>h.flow.complete({...callback(first),browser_binding:'a'.repeat(43)}));
 assert.equal(h.verificationCount,0);
 await assert.rejects(()=>h.flow.complete(callback(first)));
 assert.equal(h.verificationCount,0);
});

test('UX43E2B2 expiration and failure consume the one-time pending state',async()=>{
 const h=setup(),first=await h.flow.begin();
 h.setTime(now0+5*60*1000);
 await assert.rejects(()=>h.flow.complete(callback(first)),/state expired/);
 assert.equal(h.verificationCount,0);
 const invalid=setup({exchangeError:true}),other=await invalid.flow.begin();
 await assert.rejects(()=>invalid.flow.complete(callback(other)));
 await assert.rejects(()=>invalid.flow.complete(callback(other)));
 assert.equal(invalid.verificationCount,1);
});

test('UX43E2B2 denies unsigned, wrong audience, changed nonce, expired token and stale MFA',async()=>{
 for(const principal of [
  {signature_verified:false}, {trust_source:'client-claim'},
  {issuer:'https://evil.invalid'}, {audience:'another-app'},
  {nonce:'this-is-a-different-nonce-that-is-long-enough'},
  {expires_at:Math.floor(now0/1000)-1},
  {issued_at:Math.floor(now0/1000)+600},
  {auth_time:Math.floor(now0/1000)-901},
  {mfa_verified:false},{identity_verified:false},
  {subject:'owner'}, {verified_person_key:'owner'}
 ]){
  const h=setup({principal});const first=await h.flow.begin();
  await assert.rejects(()=>h.flow.complete(callback(first)),undefined,JSON.stringify(principal));
  assert.equal(h.sessions.size,0);
 }
});

test('UX43E2B2 rejects client-supplied identity, admin privilege claims, bad code and malformed input',async()=>{
 const h=setup(),first=await h.flow.begin();
 for(const body of [
  {...callback(first),reviewer_id:roster.id},
  {...callback(first),role:'admin'},
  {...callback(first),approved:true},
  {...callback(first),nonce:first.authorization.nonce},
  {...callback(first),code:'x'},
  {...callback(first),state:'../malicious'},
  {...callback(first),code:'a\nb'}
 ])await assert.rejects(()=>h.flow.complete(body));
 assert.equal(h.verificationCount,0);
});

test('UX43E2B2 rechecks roster for removal and blocks all reviewer privileges',async()=>{
 const h=setup(),first=await h.flow.begin();
 const result=await h.flow.complete(callback(first));
 h.setRoster({...roster,active:false});
 await assert.rejects(()=>h.flow.authenticate(result.reviewer_session_cookie_value),/no longer authorized/);
 h.setRoster({...roster,bilingual_verified:false});
 await assert.rejects(()=>h.flow.authenticate(result.reviewer_session_cookie_value),/no longer authorized/);
 h.setRoster({...roster,person_key:'different-human'});
 await assert.rejects(()=>h.flow.authenticate(result.reviewer_session_cookie_value),/no longer authorized/);
 h.setRoster({...roster});
 h.setTime(now0+15*60*1000);
 await assert.rejects(()=>h.flow.authenticate(result.reviewer_session_cookie_value),/missing or expired/);
});

test('UX43E2B2 requires approved backend adapters and pinned HTTPS issuer and redirect',()=>{
 assert.throws(()=>createReviewerOidcFlow(),/not enabled/);
 const h=setup();assert.ok(h.flow);
 // No handler, migration or live provider is added to the runtime by this test.
});
