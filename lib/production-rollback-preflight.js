// UX59.13: pure, non-mutating preflight for a HUMAN-APPROVED production rollback.
// A receipt is evidence of an earlier release, not proof that DB schemas remain compatible.
import assert from 'node:assert/strict';

const SHA=/^[a-f0-9]{40}$/;
const DEPLOY=/^dpl_[A-Za-z0-9]+$/;
export function inspectRollback({current,candidate,receipt,databaseCompatibilityConfirmed=false}={}){
 const blockers=[];
 const warnings=[];
 if(!current||current.state!=='READY'||current.target!=='production'||!DEPLOY.test(String(current.id||''))||
    !SHA.test(String(current.sha||''))||current.ref!=='main')blockers.push('CURRENT_PRODUCTION_UNVERIFIED');
 if(!candidate||candidate.state!=='READY'||candidate.target!=='production'||!DEPLOY.test(String(candidate.id||''))||
    !SHA.test(String(candidate.sha||''))||candidate.ref!=='main')blockers.push('CANDIDATE_NOT_REVIEWED_PRODUCTION');
 if(current?.id&&candidate?.id&&current.id===candidate.id)blockers.push('SAME_DEPLOYMENT');
 if(current?.sha&&candidate?.sha&&current.sha===candidate.sha)blockers.push('SAME_COMMIT');
 if(!Number.isSafeInteger(current?.created)||!Number.isSafeInteger(candidate?.created)||
    candidate.created>=current.created)blockers.push('CANDIDATE_NOT_OLDER');
 if(!receipt||receipt.kind!=='wordsky-production-release-receipt'||receipt.schema_version!==1||
    receipt.result!=='PASS'||receipt.production_origin!=='https://wordsky-english-game.vercel.app'||
    receipt.expected_commit_sha!==candidate?.sha||receipt.observed_commit_sha!==candidate?.sha||
    receipt.git_ref!=='main'||receipt.environment!=='production'||
    !Array.isArray(receipt.assets)||receipt.assets.length!==3)blockers.push('VALID_RELEASE_RECEIPT_REQUIRED');
 if(!databaseCompatibilityConfirmed)blockers.push('DATABASE_COMPATIBILITY_UNCONFIRMED');
 warnings.push('A prior successful release receipt does not guarantee a safe rollback after schema or data changes');
 warnings.push('Rollback requires separate approval and a controlled alias/promotion operation, then public GET smoke and commit attestation');
 const result=blockers.length?'BLOCKED':'ELIGIBLE_FOR_HUMAN_REVIEW';
 return {schema_version:1,mode:'dry_run_only',result,blockers,warnings,
  current_deployment_id:current?.id||null,current_sha:current?.sha||null,
  candidate_deployment_id:candidate?.id||null,candidate_sha:candidate?.sha||null,
  performs_rollback:false};
}
export function printRollbackReport(report){
 assert.equal(report.mode,'dry_run_only');
 return JSON.stringify(report,null,2);
}
