/* UX61.8 public catalog -> pending-review packet read-only preflight.
 * GET only, no passwords/cookies/Production DB or SRS writes.
 */
import {readFileSync} from 'node:fs';
import {validatePendingEditorialPacket} from '../lib/ux61-8-editorial-preflight.js';

export async function verifyProductionEditorialEvidence({
 fetchImpl=fetch,
 url='https://wordsky-english-game.vercel.app/api/learning/vocabulary',
 packet=JSON.parse(readFileSync(new URL('../docs/ux61-8-editorial-evidence.json',import.meta.url),'utf8'))
}={}){
 if(url!=='https://wordsky-english-game.vercel.app/api/learning/vocabulary')
  throw Error('UX61.8 refuses non-production catalog targets');
 const response=await fetchImpl(url,{
  method:'GET',redirect:'manual',signal:AbortSignal.timeout(25000),
  headers:{accept:'application/json'}
 });
 if(response.status!==200||!/application\/json/i.test(response.headers.get('content-type')||''))
  throw Error('UX61.8 production catalog HTTP/content-type mismatch');
 const payload=await response.json();
 if(!payload||!Array.isArray(payload.words))
  throw Error('UX61.8 production catalog payload missing');
 return validatePendingEditorialPacket(packet,payload.words);
}

if(process.argv.includes('--live')){
 try{
  const result=await verifyProductionEditorialEvidence();
  console.log(JSON.stringify({
   result:'PASS_UX61_8_PENDING_EDITORIAL_EVIDENCE',
   cards:result.matched_cards,collision_groups:result.collision_groups,
   catalog_words:result.public_words,
   catalog_total_changed:result.source_word_count_changed,
   snapshot_sha256:result.exact_card_snapshot_sha256,
   authorized_to_activate_prompts:false,
   authorized_to_grade_srs:false,
   note:'GET-only public catalog comparison; no human semantic approval claimed'
  }));
 }catch(error){
  console.error('FAIL_UX61_8_PENDING_EDITORIAL_EVIDENCE: '+error.message);
  process.exitCode=1;
 }
}
