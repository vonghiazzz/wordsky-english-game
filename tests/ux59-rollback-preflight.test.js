import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRollback,printRollbackReport} from '../lib/production-rollback-preflight.js';
import {reviewRollback} from '../scripts/ux59-rollback-preflight.mjs';
const a='a'.repeat(40),b='b'.repeat(40);
const current={id:'dpl_NEW123',sha:a,state:'READY',target:'production',ref:'main',created:200};
const candidate={id:'dpl_OLD123',sha:b,state:'READY',target:'production',ref:'main',created:100};
const receipt={schema_version:1,kind:'wordsky-production-release-receipt',
 result:'PASS',production_origin:'https://wordsky-english-game.vercel.app',
 expected_commit_sha:b,observed_commit_sha:b,git_ref:'main',environment:'production',
 assets:[{path:'/progress.html'},{path:'/ux24-srs-panel.js'},{path:'/ux24-srs-panel.css'}]};
const good=()=>({current,candidate,receipt,databaseCompatibilityConfirmed:true});
test('UX59.13 reviewed old production requires explicit DB compatibility before human review',()=>{
 const passed=inspectRollback(good());
 assert.equal(passed.result,'ELIGIBLE_FOR_HUMAN_REVIEW');
 assert.equal(passed.performs_rollback,false);
 assert.equal(passed.mode,'dry_run_only');
 assert.equal(passed.blockers.length,0);
 assert.match(printRollbackReport(passed),/dry_run_only/);
});
test('UX59.13 stale or preview deployments never become rollback candidates',()=>{
 for(const value of [
  {...candidate,target:null},
  {...candidate,state:'BUILDING'},
  {...candidate,ref:'feature/test'},
  {...candidate,created:300},
  {...candidate,id:current.id},
  {...candidate,sha:current.sha},
  {...candidate,id:'malformed'},
 ]){
  assert.equal(inspectRollback({...good(),candidate:value}).result,'BLOCKED');
 }
 assert.equal(inspectRollback({...good(),current:{...current,target:null}}).result,'BLOCKED');
});
test('UX59.13 rejects missing forged or unrelated release evidence',()=>{
 for(const value of [
  null,{...receipt,result:'FAIL'},{...receipt,expected_commit_sha:a},
  {...receipt,observed_commit_sha:a},{...receipt,git_ref:'preview'},
  {...receipt,environment:'preview'},{...receipt,assets:[]}
 ]){
  const r=inspectRollback({...good(),receipt:value});
  assert.equal(r.result,'BLOCKED');
  assert.ok(r.blockers.includes('VALID_RELEASE_RECEIPT_REQUIRED'));
 }
});
test('UX59.13 fails closed on unknown DB compatibility, even with valid receipt',()=>{
 const r=inspectRollback({...good(),databaseCompatibilityConfirmed:false});
 assert.equal(r.result,'BLOCKED');
 assert.ok(r.blockers.includes('DATABASE_COMPATIBILITY_UNCONFIRMED'));
 assert.equal(inspectRollback({}).result,'BLOCKED');
});
test('UX59.13 offline reviewer does not run rollback, network calls or credentials',async()=>{
 const r=await reviewRollback({...good(),databaseCompatibilityConfirmed:false});
 assert.equal(r.result,'BLOCKED');
 assert.equal(r.performs_rollback,false);
 assert.deepEqual(r.blockers,['DATABASE_COMPATIBILITY_UNCONFIRMED']);
});
