import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {
 assertVerifiedReviewerIdentity,prepareBlindSignedReview,
 verifyBlindSignedReview,assessSignedBlindReviews
} from '../lib/ux43e2b-reviewer-proof.js';

const NOW=new Date('2026-10-31T09:00:00.000Z');
const ISSUER='https://identity.example.invalid/reviewer';
const AUDIENCE='wordsky-reviewer-isolated';
const KEY=randomBytes(32),WRONG_KEY=randomBytes(32);
const word={id:randomUUID(),english:'walk',enabled:true,topic_enabled:true};
const draft={id:randomUUID(),word_id:word.id,prompt_vi:'Đi bộ',
 accepted_english:['walk','walk on foot'],answer_revision:'review-v1',
 curator:'owner',approved:false,active:false};
const roster=[1,2].map(i=>({
 id:randomUUID(),issuer:ISSUER,auth_subject:'qa-idp-subject-'+i,
 person_key:'verified-person-'+i,active:true,identity_verified:true,
 bilingual_verified:true,is_curator:false,role:'reviewer'
}));
const principal=(i,patch={})=>({
 trust_source:'server-verified-idp',authenticated:true,identity_verified:true,
 mfa_verified:true,issuer:ISSUER,audience:AUDIENCE,
 subject:roster[i].auth_subject,verified_person_key:roster[i].person_key,
 auth_time:Math.floor(NOW.getTime()/1000)-60,...patch
});
async function signed(i,options={}){
 const p=options.principal??principal(i);
 const r=options.roster??roster[i];
 return prepareBlindSignedReview({
  opaqueSession:'opaque-qa-only',input:options.input??{decision:'approve'},
  draft:options.draft??draft,word:options.word??word,
  verifyExternalSession:options.verifyExternalSession??(async()=>p),
  loadTrustedRoster:options.loadTrustedRoster??(async()=>r),
  confirmNoPeerDisclosure:options.confirmNoPeerDisclosure??(async()=>true),
  expectedIssuer:ISSUER,expectedAudience:AUDIENCE,
  signingKey:options.signingKey??KEY,clock:()=>NOW
 });
}

test('UX43E2B1 signs two genuinely distinct trusted synthetic identities, but does not activate',async()=>{
 const receipts=[await signed(0),await signed(1)];
 for(const receipt of receipts){
  assert.equal(verifyBlindSignedReview(receipt,KEY).signature,receipt.signature);
  assert.equal(receipt.phase,'blind-initial');
  assert.equal(receipt.peer_decision_visible,false);
  assert.equal('auth_subject' in receipt,false);
  assert.equal('person_key' in receipt,false);
  assert.equal('opaqueSession' in receipt,false);
  assert.equal('password' in receipt,false);
 }
 const report=assessSignedBlindReviews({draft,word,roster,receipts,signingKey:KEY});
 assert.equal(report.review_gate_preconditions_met,true);
 assert.equal(report.signed_receipt_integrity_verified,true);
 assert.equal(report.immutable_database_receipts_verified,false);
 assert.equal(report.independently_authenticated_reviewer_service_available,false);
 assert.equal(report.authorized_to_activate_prompts,false);
});
test('UX43E2B1 never treats owner, unverified credentials, missing MFA, or stale MFA as a reviewer',()=>{
 const base=principal(0);
 for(const patch of [
  {trust_source:'client-claim'},{authenticated:false},{identity_verified:false},
  {mfa_verified:false},{issuer:'https://fake.invalid'}, {audience:'wrong'},
  {subject:'fake-subject'}, {verified_person_key:'another-person'},
  {auth_time:base.auth_time-901},{auth_time:base.auth_time+1000}
 ])assert.throws(()=>assertVerifiedReviewerIdentity({...base,...patch},roster[0],{
  expectedIssuer:ISSUER,expectedAudience:AUDIENCE,now:NOW
 }));
 for(const patch of [
  {role:'player'},{role:'admin'},{active:false},{identity_verified:false},
  {bilingual_verified:false},{person_key:'owner'},{is_curator:true}
 ])assert.throws(()=>assertVerifiedReviewerIdentity(base,{...roster[0],...patch},{
  expectedIssuer:ISSUER,expectedAudience:AUDIENCE,now:NOW
 }));
});
test('UX43E2B1 refuses browser-injected identity, activation, prompt approval or vote metadata',async()=>{
 for(const patch of [
  {reviewer_id:roster[0].id},{approved:true},{active:true},
  {peer_decision_visible:false},{answer_revision:'spoofed'},{signature:'x'}
 ])await assert.rejects(()=>signed(0,{input:{decision:'approve',...patch}}));
 await assert.rejects(()=>signed(0,{input:{decision:'maybe'}}));
 await assert.rejects(()=>signed(0,{confirmNoPeerDisclosure:async()=>false}));
 await assert.rejects(()=>signed(0,{verifyExternalSession:async()=>null}));
 await assert.rejects(()=>signed(0,{signingKey:Buffer.alloc(8)}));
});
test('UX43E2B1 rejects modified/tampered signed receipts and a different key',async()=>{
 const original=await signed(0);
 for(const patch of [
  {decision:'reject'}, {answer_revision:'changed'},
  {peer_decision_visible:true},{reviewed_at:'2026-10-31T00:00:00.000Z'},
  {identity_subject_fingerprint:'0'.repeat(64)},
  {prompt_id:randomUUID()}, {signature:'a'.repeat(64)},
  {extra:'injected'}
 ])assert.throws(()=>verifyBlindSignedReview({...original,...patch},KEY));
 assert.throws(()=>verifyBlindSignedReview(original,WRONG_KEY));
});
test('UX43E2B1 binds receipts to trusted roster; two logins belonging to same person are not independent',async()=>{
 const receipts=[await signed(0),await signed(1)];
 assert.throws(()=>assessSignedBlindReviews({
  draft,word,roster:[roster[0],{...roster[1],auth_subject:'another-subject'}],
  receipts,signingKey:KEY
 }));
 const secondAlias={...roster[1],person_key:roster[0].person_key};
 const aliasedReceipt=await signed(1,{roster:secondAlias,
  principal:principal(1,{verified_person_key:roster[0].person_key})});
 const report=assessSignedBlindReviews({
  draft,word,roster:[roster[0],secondAlias],
  receipts:[receipts[0],aliasedReceipt],signingKey:KEY
 });
 assert.equal(report.review_gate_preconditions_met,false);
 assert.ok(report.blocked_by.includes('duplicate_reviewer_identity'));
 assert.equal(report.authorized_to_activate_prompts,false);
});
test('UX43E2B1 keeps first frozen prompt/revision and honors preflight cue collisions',async()=>{
 const receipts=[await signed(0),await signed(1)];
 const changed={...draft,prompt_vi:'Đi dạo'};
 const mismatch=assessSignedBlindReviews({draft:changed,word,roster,receipts,signingKey:KEY});
 assert.equal(mismatch.review_gate_preconditions_met,false);
 assert.ok(mismatch.blocked_by.includes('snapshot_mismatch'));
 const collision=assessSignedBlindReviews({draft,word,roster,receipts,signingKey:KEY,
  activePrompts:[{word_id:randomUUID(),prompt_vi:'ĐI  BỘ',approved:true,active:true}]
 });
 assert.equal(collision.review_gate_preconditions_met,false);
 assert.ok(collision.blocked_by.includes('ambiguous_shared_cue'));
});
test('UX43E2B1 verifier, roster and signing key are mandatory; no WordSky player fallback',async()=>{
 await assert.rejects(()=>prepareBlindSignedReview({
  input:{decision:'approve'},draft,word,signingKey:KEY
 }));
 await assert.rejects(()=>signed(0,{loadTrustedRoster:async()=>null}));
 assert.throws(()=>assertVerifiedReviewerIdentity(principal(0),roster[0],{
  expectedIssuer:'http://not-secure.invalid',expectedAudience:AUDIENCE,now:NOW
 }));
});
