/* UX61.9 review exports — no writes to WordSky or user accounts.
 * To make reviewer packets:  node scripts/ux61-9-blind-review.mjs --generate ./review-local
 * To compare filled forms: node scripts/ux61-9-blind-review.mjs --compare A.json B.json
 * The report can NEVER approve or activate SRS, including when both agree.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 createBlindReviewTemplate,compareBlindReviewForms
} from '../lib/ux61-9-blind-review.js';
import {verifyProductionEditorialEvidence} from './ux61-8-review-production.mjs';

const packet=JSON.parse(readFileSync(
 new URL('../docs/ux61-8-editorial-evidence.json',import.meta.url),'utf8'));
function loadJson(path){
 const s=readFileSync(resolve(path),'utf8');
 if(s.length>50000)throw Error('Oversized or untrusted reviewer form');
 return JSON.parse(s);
}
async function main(args){
 if(args.length===2&&args[0]==='--generate'){
  await verifyProductionEditorialEvidence(); // Independent live public GET preflight first.
  const out=resolve(args[1]);
  mkdirSync(out,{recursive:true,mode:0o700});
  for(const code of ['REVIEWER_A','REVIEWER_B']){
   const target=join(out,'ux61-9-'+code+'.json');
   writeFileSync(target,JSON.stringify(createBlindReviewTemplate(packet,code),null,2)+'\n',
    {flag:'wx',mode:0o600}); // No silent overwrite of prior review forms.
  }
  console.log(JSON.stringify({
   outcome:'BLIND_FORMS_CREATED',dir:out,cards:packet.cards.length,
   form_labels_are_not_verified_people:true,
   requires_independent_human_semantic_review:true,
   authorized_to_grade_srs:false
  }));
  return;
 }
 if(args.length===3&&args[0]==='--compare'){
  const a=loadJson(args[1]),b=loadJson(args[2]);
  const report=compareBlindReviewForms(packet,a,b);
  console.log(JSON.stringify(report,null,2));
  return;
 }
 throw Error('Usage: --generate <local-directory> OR --compare <reviewer-A.json> <reviewer-B.json>');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main(process.argv.slice(2)).catch(e=>{
  console.error('UX61.9 BLOCKED: '+e.message);
  process.exitCode=1;
 });
}
