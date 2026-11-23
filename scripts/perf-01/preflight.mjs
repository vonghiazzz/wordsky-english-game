/**
 * PERF-01 safety preflight. Zero requests / SQL / file modifications.
 * Local PostgreSQL only, and localhost HTTP only. No production, preview
 * database, public URL or shared staging may be load-tested via this script.
 *
 * Usage after configuring an ISOLATED LOCAL database:
 * node --env-file=.env scripts/perf-01/preflight.mjs
 */
import assert from 'node:assert/strict';

const LOOPBACK=new Set(['127.0.0.1','localhost','[::1]']);
const PROFILES=Object.freeze({
  smoke:{maxVus:1,maxRps:2},
  baseline:{maxVus:10,maxRps:10},
  step50:{maxVus:50,maxRps:25},
});

function getUrl(value,label){
  assert.ok(typeof value==='string'&&value.length>0,label+' is required');
  try{return new URL(value)}
  catch{throw new Error(label+' must be a valid absolute URL')}
}
export function validatePerfEnvironment(env={}){
  const profile=String(env.PERF_PROFILE||'smoke');
  assert.ok(Object.hasOwn(PROFILES,profile),'Unapproved load profile');
  assert.equal(env.PERF_LOCAL_DB_ACK,'I_VERIFIED_ISOLATED_LOCAL_POSTGRES',
    'Local DB isolation acknowledgement missing');
  assert.notEqual(env.VERCEL_ENV,'production','Production runtime is never a load target');
  assert.notEqual(env.VERCEL_ENV,'preview','Preview runtime is outside PERF-01 scope');
  const target=getUrl(env.PERF_TARGET||'http://127.0.0.1:3000','PERF_TARGET');
  assert.ok(target.protocol==='http:'&&LOOPBACK.has(target.hostname)&&
    target.port==='3000'&&target.pathname==='/'&&
    !target.search&&!target.hash&&!target.username&&!target.password,
    'PERF_TARGET must be exactly a local HTTP server on port 3000');
  const db=getUrl(env.DATABASE_URL,'DATABASE_URL');
  assert.ok(['postgres:','postgresql:'].includes(db.protocol)&&
    LOOPBACK.has(db.hostname)&&
    !db.searchParams.has('sslmode'),
    'PERF-01 must use an isolated LOCAL Postgres database URL, never Supabase or production');
  assert.ok(db.pathname.length>1,'Choose a dedicated local database name');
  return Object.freeze({
    target:target.origin,profile,database:'local-loopback-only',
    max_virtual_users:PROFILES[profile].maxVus,
    rps_cap_per_generator:PROFILES[profile].maxRps,
    production_write_operations:0
  });
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
  try{
    const report=validatePerfEnvironment(process.env);
    console.log(JSON.stringify({status:'PASS_LOCAL_ONLY',...report}));
  }catch(error){
    console.error('PERF01_PRECHECK_BLOCKED: '+error.message);
    process.exitCode=1;
  }
}
