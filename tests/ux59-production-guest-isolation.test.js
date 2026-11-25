import test from 'node:test';
import assert from 'node:assert/strict';
import {assertGuestIsolation,protectedPaths,publicOrigin} from '../scripts/ux59-production-guest-isolation.mjs';

function guestFetch({authenticated=false,exposed=false}={}){
 const seen=[];
 const fetcher=async(url,opts)=>{
  seen.push({url,opts});
  const path=url.slice(publicOrigin.length);
  return {status:path==='/api/auth/me'?200:exposed?200:401,
   headers:{get:()=> 'application/json; charset=utf-8'},
   json:async()=>path==='/api/auth/me'?{actor:authenticated?{id:'private'}:null}:exposed?{words:[{english:'private'}]}:{error:'Not authenticated'}};
 };
 return {seen,fetcher};
}
test('UX59.14 guest QA only makes no-cookie GETs to fixed production domain',async()=>{
 const {seen,fetcher}=guestFetch();
 const result=await assertGuestIsolation({fetcher});
 assert.equal(result.result,'PASS_PRODUCTION_GUEST_ISOLATION');
 assert.equal(result.protected_routes.length,protectedPaths.length);
 for(const call of seen){
  assert.ok(call.url.startsWith(publicOrigin+'/api/'));
  assert.equal(call.opts.method,'GET');
  assert.equal(call.opts.redirect,'manual');
  assert.deepEqual(Object.keys(call.opts.headers).sort(),['Cache-Control','accept']);
  assert.equal(call.opts.headers['Cache-Control'],'no-store');
 }
});
test('UX59.14 refuses authenticated guest requests and leaked SRS',async()=>{
 await assert.rejects(assertGuestIsolation({fetcher:guestFetch({authenticated:true}).fetcher}),/unexpectedly authenticated/);
 await assert.rejects(assertGuestIsolation({fetcher:guestFetch({exposed:true}).fetcher}),/exposed private data/);
});
test('UX59.14 prohibits any non-approved origin',async()=>{
 await assert.rejects(assertGuestIsolation({origin:'https://example.org',fetcher:guestFetch().fetcher}),/Production origin must be fixed/);
});
test('UX59.14 production guest QA rejects redirects and non-JSON responses',async()=>{
 await assert.rejects(assertGuestIsolation({fetcher:async()=>({status:302})}),/unexpected status/);
 await assert.rejects(assertGuestIsolation({fetcher:async()=>({status:200,headers:{get:()=> 'text/html'}})}),/must be JSON/);
});
