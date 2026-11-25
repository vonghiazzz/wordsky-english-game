import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyRelease,inspectRelease,releaseSummary} from '../scripts/ux59-release-diagnostics.mjs';
const A='a'.repeat(40),B='b'.repeat(40);
const identity=sha=>({commit_sha:sha,git_ref:'main',environment:'production'});
test('UX59.11 classifies match, stale SHA, unavailable API and malformed SHA',()=>{
 assert.equal(classifyRelease(A,{http_status:200,identity:identity(A)}).status,'MATCH');
 assert.equal(classifyRelease(A,{http_status:200,identity:identity(B)}).status,'SHA_MISMATCH');
 assert.equal(classifyRelease(A,{http_status:503,identity:null}).status,'HTTP_UNAVAILABLE');
 assert.equal(classifyRelease('invalid',{http_status:200,identity:identity(A)}).status,'INVALID_EXPECTED_SHA');
 assert.equal(classifyRelease(A,{http_status:200,identity:{...identity(A),git_ref:'feature/test'}}).status,'SHA_MISMATCH');
});
test('UX59.11 diagnostic uses only GET and no credentials or writes',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});return {status:200,json:async()=>identity(A)}
 };
 const report=await inspectRelease(A,{fetcher});
 assert.equal(report.status,'MATCH');
 assert.equal(report.observed_sha,A);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://wordsky-english-game.vercel.app/api/release');
 assert.equal(calls[0].opts.method,'GET');
 assert.equal(calls[0].opts.redirect,'manual');
 assert.equal(calls[0].opts.headers['Cache-Control'],'no-store');
 assert.match(releaseSummary(report),/Expected main SHA/);
});
test('UX59.11 network errors remain actionable and do not leak secrets',async()=>{
 const report=await inspectRelease(A,{fetcher:async()=>{throw Error('network error with sensitive info')}});
 assert.equal(report.status,'HTTP_UNAVAILABLE');
 assert.equal(report.observed_sha,'unavailable');
 assert.doesNotMatch(releaseSummary(report),/sensitive info/);
});
test('UX59.11 workflow always reports exact SHA without deploy privileges',()=>{
 const w=readFileSync(new URL('../.github/workflows/ux59-production-release-fingerprint.yml',import.meta.url),'utf8');
 assert.match(w,/name: Summarize production commit and diagnose stale alias/);
 assert.match(w,/if: always\(\)/);
 assert.match(w,/EXPECTED_RELEASE_SHA: \$\{\{ github.sha \}\}/);
 assert.match(w,/run: node scripts\/ux59-release-diagnostics\.mjs/);
 assert.match(w,/permissions:\n  contents: read/);
 assert.doesNotMatch(w,/VERCEL_TOKEN|assign_alias|vercel deploy/);
});
