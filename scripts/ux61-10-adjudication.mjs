/* UX61.10: compare independent reviewer forms after a GET-only source check.
 * No accounts, reviewer identity credentials, SRS writes or approval actions.
 * Usage:
 * node scripts/ux61-10-adjudication.mjs reviewer-A.json reviewer-B.json
 * node scripts/ux61-10-adjudication.mjs reviewer-A.json reviewer-B.json --output output.md
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareAdjudicationReport,renderVietnameseAdjudicationMarkdown}
 from '../lib/ux61-10-adjudication.js';
import {verifyProductionEditorialEvidence}
 from './ux61-8-review-production.mjs';
import {editorialSnapshotHash} from '../lib/ux61-9-blind-review.js';

const packet=JSON.parse(readFileSync(
 new URL('../docs/ux61-8-editorial-evidence.json',import.meta.url),'utf8'
));
function loadBoundedJson(path){
 const content=readFileSync(resolve(path),'utf8');
 if(content.length>50000)throw Error('Review form too large');
 return JSON.parse(content);
}
export async function buildLiveAdjudicationReport(a,b,fetchImpl=fetch){
 // A valid form alone cannot prove live catalog freshness.
 const current=await verifyProductionEditorialEvidence({fetchImpl,packet});
 if(current.matched_cards!==6||current.pending_human_review!==6)
  throw Error('All six public words must remain unapproved and held');
 const result=prepareAdjudicationReport(packet,a,b);
 if(result.source_snapshot_sha256!==editorialSnapshotHash(packet))
  throw Error('Review snapshot mismatch');
 if(result.ready_for_released_scored_recall!==false||
  result.authorized_to_grade_srs!==false)
  throw Error('Offline adjudication cannot approve production scoring');
 return result;
}
async function main(args){
 if(args.length!==2&&args.length!==4)
  throw Error('Usage: reviewer-A.json reviewer-B.json [--output report.md]');
 if(args.length===4&&args[2]!=='--output')
  throw Error('Unsupported command or output flag');
 const a=loadBoundedJson(args[0]),b=loadBoundedJson(args[1]);
 const report=await buildLiveAdjudicationReport(a,b);
 const markdown=renderVietnameseAdjudicationMarkdown(report);
 if(args.length===4){
  const output=resolve(args[3]);
  const inputs=[resolve(args[0]),resolve(args[1])];
  if(inputs.includes(output))throw Error('Report output may not overwrite input forms');
  writeFileSync(output,markdown,{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
   outcome:'PENDING_HUMAN_ADJUDICATION_REPORT_WRITTEN',
   output,reviewed_A:report.reviewed_by_A,reviewed_B:report.reviewed_by_B,
   human_approved:false,authorized_to_grade_srs:false
  }));
 }else process.stdout.write(markdown);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main(process.argv.slice(2)).catch(e=>{
  console.error('UX61.10 BLOCKED: '+e.message);
  process.exitCode=1;
 });
}
