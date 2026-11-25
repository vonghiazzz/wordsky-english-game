// UX59.12: immutable read-only production release evidence for human-controlled promotion.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {checkProduction,verifyReleaseCommit} from './ux59-production-release-fingerprint.mjs';

const shaPattern=/^[0-9a-f]{40}$/;
export function releaseReceipt({expectedSha,identity,assets,checkedAt}){
 assert.match(String(expectedSha),shaPattern,'Expected release commit must be a full SHA');
 assert.equal(identity?.commit_sha,expectedSha,'Production commit differs from reviewed main');
 assert.equal(identity.git_ref,'main');
 assert.equal(identity.environment,'production');
 assert.ok(Array.isArray(assets)&&assets.length===3,'Require three complete asset checks');
 assert.deepEqual(assets.map(x=>x.path),[
  '/progress.html','/ux24-srs-panel.js','/ux24-srs-panel.css'
 ]);
 for(const asset of assets)assert.match(String(asset.sha256),/^[a-f0-9]{64}$/);
 const date=new Date(checkedAt);
 assert.ok(Number.isFinite(date.getTime()),'Invalid check timestamp');
 return {
  schema_version:1,kind:'wordsky-production-release-receipt',
  result:'PASS',production_origin:'https://wordsky-english-game.vercel.app',
  expected_commit_sha:expectedSha,observed_commit_sha:identity.commit_sha,
  git_ref:identity.git_ref,environment:identity.environment,
  checked_at:date.toISOString(),assets
 };
}
export async function verifyProductionReceipt(expectedSha,{assetChecker=checkProduction,commitChecker=verifyReleaseCommit,now=()=>new Date()}={}){
 // Both checks are read-only. No DB, deploy, promotion, alias or account actions.
 const assets=await assetChecker();
 const identity=await commitChecker(expectedSha);
 return releaseReceipt({expectedSha,identity,assets,checkedAt:now()});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const expectedSha=process.env.EXPECTED_RELEASE_SHA;
 const receipt=await verifyProductionReceipt(expectedSha);
 const output=process.env.RELEASE_RECEIPT_PATH||'release-receipt.json';
 await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'w',mode:0o600});
 console.log('Verified production receipt for '+receipt.expected_commit_sha);
}
