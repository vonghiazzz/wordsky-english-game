// UX59 M3: evidence gate for a potential SRS scheduling release.
// This gate is deliberately conservative: synthetic workloads never
// establish validated learner recall or safety on their own.
import {makeReport} from '../scripts/ux59-offline-report.mjs';
import {makeCycleReport} from '../scripts/ux59-cycles-report.mjs';

export function assessUx59Research({observedRecall=null,approvedPreviewGate=false}={}){
 const fixed=makeReport();
 const cycles=makeCycleReport();
 // A summary-only metric without blinded evaluation, sample size or
 // design cannot pass this gate; no observed-recall evidence is bundled.
 const hasVerifiedRecall=observedRecall?.kind==='validated-human-recall-study'&&
  observedRecall?.approved===true&&
  Number.isSafeInteger(observedRecall?.sample_size)&&observedRecall.sample_size>=1&&
  observedRecall?.reviewed_protocol===true;
 const blockers=[];
 if(fixed.totals.later>0)blockers.push('Fixed-history replay shows later due dates under candidate');
 if(!hasVerifiedRecall)blockers.push('No validated human recall outcome evidence');
 if(!approvedPreviewGate)blockers.push('UX58 authenticated Preview/release gate not verified');
 blockers.push('Synthetic policy-dependent timelines are not measured retention');
 return {
  schema:'ux59-m3-evidence-gate-v1',
  recommendation:'HOLD_NO_RUNTIME_CHANGE',
  simulation:{fixed_scenarios:fixed.totals.cards,
   earlier:fixed.totals.earlier,later:fixed.totals.later,
   unchanged:fixed.totals.unchanged,cycle_scenarios:cycles.scenarios.length},
  blockers,
  note:'Decision is intentionally non-promotable; a future rollout requires a separate independently reviewed evidence protocol.'
 };
}
