import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {releaseReceipt,verifyProductionReceipt} from '../scripts/ux59-production-release-receipt.mjs';
const SHA='a'.repeat(40),HASH='f'.repeat(64);
const identity={commit_sha:SHA,git_ref:'main',environment:'production'};
const assets=['/progress.html','/ux24-srs-panel.js','/ux24-srs-panel.css'].map(path=>({path,sha256:HASH}));
test('UX59.12 records deterministic successful release metadata and three assets',()=>{
 const r=releaseReceipt({expectedSha:SHA,identity,assets,checkedAt:'2026-11-25T08:00:00Z'});
 assert.equal(r.result,'PASS');
 assert.equal(r.expected_commit_sha,SHA);
 assert.equal(r.observed_commit_sha,SHA);
 assert.equal(r.assets.length,3);
 assert.equal(r.checked_at,'2026-11-25T08:00:00.000Z');
 assert.equal(r.production_origin,'https://wordsky-english-game.vercel.app');
});
test('UX59.12 prevents receipt from mismatched SHA, wrong ref or incomplete assets',()=>{
 const p={expectedSha:SHA,identity,assets,checkedAt:'2026-11-25T08:00:00Z'};
 assert.throws(()=>releaseReceipt({...p,identity:{...identity,commit_sha:'b'.repeat(40)}}));
 assert.throws(()=>releaseReceipt({...p,identity:{...identity,git_ref:'preview'}}));
 assert.throws(()=>releaseReceipt({...p,assets:assets.slice(0,2)}));
 assert.throws(()=>releaseReceipt({...p,assets:assets.map(x=>({...x,sha256:'invalid'}))}));
 assert.throws(()=>releaseReceipt({...p,expectedSha:'bad'}));
});
test('UX59.12 verifies assets and live SHA before recording evidence',async()=>{
 const calls=[];
 const r=await verifyProductionReceipt(SHA,{
  assetChecker:async()=>{calls.push('assets');return assets},
  commitChecker:async sha=>{calls.push('sha:'+sha);return identity},
  now:()=>new Date('2026-11-25T08:00:00Z')
 });
 assert.deepEqual(calls,['assets','sha:'+SHA]);
 assert.equal(r.kind,'wordsky-production-release-receipt');
});
test('UX59.12 only uploads receipts after successful attestation and keeps CI read-only',()=>{
 const y=readFileSync(new URL('../.github/workflows/ux59-production-release-fingerprint.yml',import.meta.url),'utf8');
 assert.match(y,/name: Record verified production release evidence/);
 assert.match(y,/name: Upload release evidence for rollback review/);
 assert.match(y,/if: success\(\)/);
 assert.match(y,/retention-days: 30/);
 assert.match(y,/EXPECTED_RELEASE_SHA: \$\{\{ github.sha \}\}/);
 assert.match(y,/permissions:\n  contents: read/);
 assert.doesNotMatch(y,/VERCEL_TOKEN|vercel promote|assign_alias|vercel deploy/);
});
