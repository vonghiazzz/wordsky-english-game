// UX59.11: read-only diagnostic report for releases that remain stale after CI polling.
import {appendFile} from 'node:fs/promises';
import {expectedReleaseIdentity} from '../lib/release-attestation.js';

const PROD='https://wordsky-english-game.vercel.app';
export function classifyRelease(expected,actual){
 if(!/^[0-9a-f]{40}$/.test(String(expected||'')))return {status:'INVALID_EXPECTED_SHA',action:'Inspect CI checkout and GITHUB_SHA'};
 if(actual?.http_status!==200)return {status:'HTTP_UNAVAILABLE',action:'Verify Vercel READY, release endpoint and domain alias'};
 try{expectedReleaseIdentity(actual.identity,expected);return {status:'MATCH',action:'Release identity matches main commit'}}
 catch{return {status:'SHA_MISMATCH',action:'Verify production deployment SHA; explicitly map public alias to reviewed READY deployment'}}
}
export async function inspectRelease(expected,{fetcher=fetch}={}){
 let actual;
 try{
  const res=await fetcher(PROD+'/api/release',{
   method:'GET',redirect:'manual',cache:'no-store',
   headers:{accept:'application/json','Cache-Control':'no-store'},
   signal:AbortSignal.timeout(15000)
  });
  const identity=res.status===200?await res.json():null;
  actual={http_status:res.status,identity};
 }catch{actual={http_status:null,identity:null}}
 return {...classifyRelease(expected,actual),expected_sha:expected,
  observed_sha:actual.identity?.commit_sha||'unavailable',
  observed_ref:actual.identity?.git_ref||'unavailable',
  observed_environment:actual.identity?.environment||'unavailable',
  http_status:actual.http_status};
}
export function releaseSummary(report){
 return ['### WordSky production release audit',
  '| Check | Value |','|---|---|',
  '| Status | '+report.status+' |',
  '| Expected main SHA | '+report.expected_sha+' |',
  '| Public-domain SHA | '+report.observed_sha+' |',
  '| Git ref | '+report.observed_ref+' |',
  '| Environment | '+report.observed_environment+' |',
  '| Release endpoint HTTP | '+(report.http_status??'unavailable')+' |',
  '| Next action | '+report.action+' |',''].join('\n');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const r=await inspectRelease(process.env.EXPECTED_RELEASE_SHA);
 const text=releaseSummary(r);
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,text);
 console.log(text);
 if(r.status!=='MATCH')console.log('::warning::Production release audit: '+r.status+' — '+r.action);
}
