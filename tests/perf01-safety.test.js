import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePerfEnvironment} from '../scripts/perf-01/preflight.mjs';
import {analyzePerfSummary} from '../scripts/perf-01/report.mjs';

const local=()=>({
  PERF_PROFILE:'smoke',
  PERF_TARGET:'http://127.0.0.1:3000',
  PERF_LOCAL_DB_ACK:'I_VERIFIED_ISOLATED_LOCAL_POSTGRES',
  DATABASE_URL:'postgresql://bench:bench@127.0.0.1:5432/wordsky_perf_fixture'
});
const fixture=()=>({metrics:{
  http_reqs:{values:{count:120,rate:5}},
  http_req_failed:{values:{rate:0}},
  http_req_duration:{values:{'p(95)':250,'p(99)':570}},
  checks:{values:{rate:1}}
}});
test('PERF-01 preflight accepts explicitly isolated localhost + bounded profiles',()=>{
 const s=validatePerfEnvironment(local());
 assert.equal(s.target,'http://127.0.0.1:3000');
 assert.equal(s.max_virtual_users,1);
 assert.equal(s.rps_cap_per_generator,2);
 assert.equal(s.production_write_operations,0);
 const stage=validatePerfEnvironment({...local(),PERF_PROFILE:'step50'});
 assert.equal(stage.max_virtual_users,50);
 assert.equal(stage.rps_cap_per_generator,25);
 assert.equal(validatePerfEnvironment({...local(),PERF_PROFILE:'baseline'}).max_virtual_users,10);
});
test('PERF-01 refuses unsafe targets, preview/production DBs or missing opt-in',()=>{
 const bad=[
  {PERF_TARGET:'https://wordsky-english-game.vercel.app'},
  {PERF_TARGET:'https://wordsky-english-game-example.vercel.app'},
  {PERF_TARGET:'http://localhost:3001'},
  {PERF_TARGET:'http://127.0.0.1:3000/api/learning/vocabulary'},
  {PERF_TARGET:'http://127.0.0.1:3000@evil.example'},
  {PERF_TARGET:'http://127.0.0.1:3000/?load=1'},
  {DATABASE_URL:'postgresql://postgres:xyz@db.ilyhbhoqswsioxxpuvcb.supabase.co:5432/postgres'},
  {DATABASE_URL:'postgresql://postgres:xyz@db.zbdnvvvdjxmdurucfjpe.supabase.co:5432/postgres'},
  {DATABASE_URL:'postgresql://bench:bench@db.example.com:5432/postgres'},
  {DATABASE_URL:'https://localhost:5432/notpostgres'},
  {PERF_PROFILE:'ten-thousand'},
  {PERF_PROFILE:'10000'},
  {PERF_LOCAL_DB_ACK:'yes'},
  {PERF_LOCAL_DB_ACK:''},
  {VERCEL_ENV:'production'},
  {VERCEL_ENV:'preview'}
 ];
 for(const change of bad)assert.throws(
  ()=>validatePerfEnvironment({...local(),...change}),undefined,
  'Unsafe config accepted: '+Object.keys(change).join(','));
 assert.throws(()=>validatePerfEnvironment({}),/acknowledgement/);
});
test('PERF-01 k6 profile is hard local-only and has no mutation endpoints',()=>{
 const source=readFileSync(new URL('../scripts/perf-01/k6-readonly.js',import.meta.url),'utf8');
 for(const literal of [
  "PERF_LOCAL_DB_ACK!=='I_VERIFIED_ISOLATED_LOCAL_POSTGRES'",
  "'http://127.0.0.1:3000','http://localhost:3000'",
  "rps:selectedProfile.rps",
  "if(__VU>selectedProfile.maxVus)fail(",
  "summaryTrendStats:['avg','min','med','max','p(90)','p(95)','p(99)']",
  "http_req_failed",
  "http_req_duration",
  "p(95)<1000",
  "p(99)<2500",
  "abortOnFail:true",
  "gracefulRampDown:'5s'",
  "discardResponseBodies:true",
  "sleep(2+Math.random()*2)",
  "/api/learning/vocabulary",
  "/api/topics"
 ])assert.ok(source.includes(literal),'Missing: '+literal);
 assert.doesNotMatch(source,/http\.(?:post|put|patch|del|delete)\s*\(/i);
 assert.doesNotMatch(source,/\/api\/(?:auth|rooms|admin|learning\/srs)/);
 assert.doesNotMatch(source,/\b(__ENV\.PERF_REMOTE|PERF_ALLOW_PRODUCTION|PERF_OVERRIDE_PRODUCTION)\b/);
 assert.match(source,/maxVus:50,rps:25/);
});
test('PERF-01 local summary report labels success without claiming 10k capacity',()=>{
 const report=analyzePerfSummary(fixture());
 assert.equal(report.result,'PASS_LOCAL_BASELINE');
 assert.equal(report.requests,120);
 assert.equal(report.requests_per_second,5);
 assert.equal(report.proves_10000_concurrent_users,false);
 assert.equal(report.authorized_to_load_test_production,false);
});
test('PERF-01 budget fails when p95, p99 or error-rate degrades',()=>{
 for(const mutate of [
  s=>{s.metrics.http_req_failed.values.rate=0.02},
  s=>{s.metrics.http_req_duration.values['p(95)']=1300},
  s=>{s.metrics.http_req_duration.values['p(99)']=2800},
  s=>{s.metrics.checks.values.rate=0.9},
  s=>{s.metrics.http_reqs.values.count=0}
 ]){const r=fixture();mutate(r);assert.equal(analyzePerfSummary(r).result,'FAIL_LOCAL_BASELINE')}
 assert.throws(()=>analyzePerfSummary({metrics:{}}),/Missing k6 metric/);
});
