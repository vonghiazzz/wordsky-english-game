import test from 'node:test';
import assert from 'node:assert/strict';
import {paths,sha256,assertSameAsset,checkProduction} from '../scripts/ux59-production-release-fingerprint.mjs';

test('UX59.8 fingerprint detects stale production even when files are valid',()=>{
 const a=Buffer.from('export const version = 1;');
 const b=Buffer.from('export const version = 2;');
 assert.equal(assertSameAsset('/ux24-srs-panel.js',a,Buffer.from(a)).sha256,sha256(a));
 assert.throws(()=>assertSameAsset('/ux24-srs-panel.js',a,b),/fingerprint mismatch/);
 assert.throws(()=>assertSameAsset('/api/health',a,a),/Unapproved/);
});

test('UX59.8 exact asset GET check uses no account writes and all 3 public files',async()=>{
 const seen=[];
 const data=new Map(paths.map((path,i)=>[path,Buffer.from('source '+i)]));
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname;seen.push({path,options});
  return {
   status:200,
   headers:{get:()=>path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':'text/html'},
   arrayBuffer:async()=>data.get(path)
  };
 };
 const reports=await checkProduction({fetcher,loader:async path=>data.get(path)});
 assert.equal(reports.length,3);
 assert.deepEqual(seen.map(x=>x.path),paths);
 for(const x of seen){
  assert.equal(x.options.method,'GET');
  assert.equal(x.options.redirect,'manual');
  assert.equal(x.options.headers['Cache-Control'],'no-store');
 }
});

test('UX59.8 expected asset mismatch fails even if HTTP is 200',async()=>{
 const fetcher=async(url)=>({
  status:200,
  headers:{get:()=>url.endsWith('.css')?'text/css':url.endsWith('.js')?'text/javascript':'text/html'},
  arrayBuffer:async()=>Buffer.from('old deployment')
 });
 await assert.rejects(checkProduction({fetcher,loader:async()=>Buffer.from('new deployment')}),/fingerprint mismatch/);
});

test('UX59.8 refuses non-production targets and non-success responses',async()=>{
 await assert.rejects(checkProduction({origin:'https://example.com'}),/Unexpected target origin/);
 await assert.rejects(checkProduction({fetcher:async()=>({status:404})}),/unexpected HTTP status/);
});
