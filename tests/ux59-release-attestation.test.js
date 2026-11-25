import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseIdentity,expectedReleaseIdentity} from '../lib/release-attestation.js';
import {verifyReleaseCommit} from '../scripts/ux59-production-release-fingerprint.mjs';
import {readFileSync} from 'node:fs';

const A='a'.repeat(40),B='b'.repeat(40);
test('UX59.10 only exposes a valid Vercel runtime commit and environment',()=>{
 assert.deepEqual(releaseIdentity({VERCEL_GIT_COMMIT_SHA:A,VERCEL_GIT_COMMIT_REF:'main',VERCEL_ENV:'production'}),{
  commit_sha:A,git_ref:'main',environment:'production'
 });
 assert.deepEqual(releaseIdentity({VERCEL_GIT_COMMIT_SHA:B,VERCEL_GIT_COMMIT_REF:'feature/qa',VERCEL_ENV:'preview'}),{
  commit_sha:B,git_ref:'feature/qa',environment:'preview'
 });
 for(const env of [{},{VERCEL_GIT_COMMIT_SHA:'short',VERCEL_GIT_COMMIT_REF:'main',VERCEL_ENV:'production'},
  {VERCEL_GIT_COMMIT_SHA:A,VERCEL_GIT_COMMIT_REF:'feature/qa',VERCEL_ENV:'production'},
  {VERCEL_GIT_COMMIT_SHA:A,VERCEL_GIT_COMMIT_REF:'main',VERCEL_ENV:'dev'}]){
  assert.equal(releaseIdentity(env),null);
 }
});
test('UX59.10 attest exact SHA; unchanged asset bytes cannot mask old commit',()=>{
 const valid={commit_sha:A,git_ref:'main',environment:'production'};
 assert.equal(expectedReleaseIdentity(valid,A),true);
 assert.throws(()=>expectedReleaseIdentity(valid,B),/mismatch/);
 assert.throws(()=>expectedReleaseIdentity({...valid,environment:'preview'},A),/mismatch/);
 assert.throws(()=>expectedReleaseIdentity({...valid,git_ref:'other'},A),/mismatch/);
 assert.throws(()=>expectedReleaseIdentity(valid,'short'),/Invalid expected/);
});
test('UX59.10 remote attestation makes only a cache-bypassed public GET',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  return {status:200,headers:{get:()=> 'application/json; charset=utf-8'},
   json:async()=>({commit_sha:A,git_ref:'main',environment:'production'})};
 };
 assert.equal((await verifyReleaseCommit(A,{fetcher})).commit_sha,A);
 assert.equal(calls[0].url,'https://wordsky-english-game.vercel.app/api/release');
 assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[0].options.redirect,'manual');
 assert.equal(calls[0].options.headers['Cache-Control'],'no-store');
 await assert.rejects(verifyReleaseCommit(B,{fetcher}),/mismatch/);
});
test('UX59.10 endpoint fails closed without Vercel system metadata',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/ux59-production-release-fingerprint.yml',import.meta.url),'utf8');
 assert.match(api,/key==='release'/);
 assert.match(api,/output\(res,503,\{error:'Release metadata unavailable'\}\)/);
 assert.match(workflow,/EXPECTED_RELEASE_SHA="\$\{GITHUB_SHA\}" node scripts\/ux59-production-release-fingerprint\.mjs/);
});
