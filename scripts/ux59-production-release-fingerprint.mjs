/**
 * UX59.8: read-only, exact asset fingerprint check for the user-facing domain.
 * Run only after the release is deployed AND its public alias is assigned.
 * Never supplies credentials, calls write APIs, or updates production state.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

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
  assert.match(mime,path.endsWith('.css')?/text\\/css/i:path.endsWith('.js')?/javascript|text\\/plain/i:/text\\/html/i,path+' wrong MIME');
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length>0&&bytes.length<=2_000_000,path+' size invalid');
  results.push(assertSameAsset(path,await loader(path),bytes));
 }
 return results;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const results=await checkProduction();
 console.log(JSON.stringify({result:'PASS_EXACT_PRODUCTION_ASSETS',assets:results}));
}
