/**
 * UX59.8: read-only, exact asset fingerprint check for the user-facing domain.
 * Run only after the release is deployed AND its public alias is assigned.
 * Never supplies credentials, calls write APIs, or updates production state.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {expectedReleaseIdentity} from '../lib/release-attestation.js';

export const paths=Object.freeze([
 '/progress.html','/ux24-srs-panel.js','/ux24-srs-panel.css'
]);
export function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
export function assertSameAsset(path,local,remote){
 assert.ok(paths.includes(path),'Unapproved production asset');
 const actual=sha256(remote),expected=sha256(local);
 assert.equal(actual,expected,path+' production fingerprint mismatch (stale alias or incomplete deploy)');
 return {path,sha256:actual};
}
export async function checkProduction({
 origin='https://wordsky-english-game.vercel.app',
 fetcher=fetch,
 loader=path=>readFile(new URL('../public'+path,import.meta.url))
}={}){
 assert.equal(origin,'https://wordsky-english-game.vercel.app','Unexpected target origin');
 const results=[];
 for(const path of paths){
  const response=await fetcher(origin+path,{
   method:'GET',redirect:'manual',cache:'no-store',
   headers:{'Cache-Control':'no-store'},
   signal:AbortSignal.timeout(15000)
  });
  assert.equal(response.status,200,path+' unexpected HTTP status');
  const mime=response.headers.get('content-type')||'';
  const mimeOk=path.endsWith('.css')?mime.includes('text/css'):
   path.endsWith('.js')?(mime.includes('javascript')||mime.includes('text/plain')):
   mime.includes('text/html');
  assert.ok(mimeOk,path+' wrong MIME '+mime);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length>0&&bytes.length<=2_000_000,path+' size invalid');
  results.push(assertSameAsset(path,await loader(path),bytes));
 }
 return results;
}
// UX59.10: assets alone cannot prove a commit when their bytes are unchanged.
export async function verifyReleaseCommit(expectedSha,{
 origin='https://wordsky-english-game.vercel.app',fetcher=fetch
}={}){
 assert.equal(origin,'https://wordsky-english-game.vercel.app','Unexpected target origin');
 const response=await fetcher(origin+'/api/release',{
  method:'GET',redirect:'manual',cache:'no-store',
  headers:{'Cache-Control':'no-store',accept:'application/json'},
  signal:AbortSignal.timeout(15000)
 });
 assert.equal(response.status,200,'Public release identity unavailable');
 const type=response.headers.get('content-type')||'';
 assert.match(type,/application\/json/i,'Release identity must be JSON');
 const payload=await response.json();
 expectedReleaseIdentity(payload,expectedSha);
 return payload;
}

if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const results=await checkProduction();
 const expected=process.env.EXPECTED_RELEASE_SHA;
 const identity=expected?await verifyReleaseCommit(expected):null;
 console.log(JSON.stringify({result:'PASS_EXACT_PRODUCTION_ASSETS',assets:results,release:identity}));
}
