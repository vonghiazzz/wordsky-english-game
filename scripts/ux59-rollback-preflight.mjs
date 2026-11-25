// UX59.13: offline-only rollback review. No Vercel credentials, network or mutations.
import {readFile,writeFile} from 'node:fs/promises';
import {inspectRollback,printRollbackReport} from '../lib/production-rollback-preflight.js';

export async function reviewRollback(input,{writer=writeFile}={}){
 const report=inspectRollback(input);
 // Return the result even when blocked; the CLI exits nonzero to preserve the gate.
 if(process.env.ROLLBACK_PREFLIGHT_REPORT)
  await writer(process.env.ROLLBACK_PREFLIGHT_REPORT,printRollbackReport(report)+'\n');
 return report;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const file=process.argv[2];
 if(!file||process.argv.length!==3)throw Error('Usage: node scripts/ux59-rollback-preflight.mjs <offline-evidence.json>');
 const input=JSON.parse(await readFile(file,'utf8'));
 const report=await reviewRollback(input);
 console.log(printRollbackReport(report));
 if(report.result!=='ELIGIBLE_FOR_HUMAN_REVIEW')process.exitCode=1;
}
