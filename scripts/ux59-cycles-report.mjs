// Deterministic illustrative UX59 M2 scenarios, no network or database.
import {compareSrsCycles} from '../lib/ux59-srs-cycles.js';
const scenarios=[
 {id:'always-remember-30d',days:30,forgetAfterDays:null},
 {id:'always-remember-90d',days:90,forgetAfterDays:null},
 {id:'threshold-2d-30d',days:30,forgetAfterDays:2},
 {id:'threshold-7d-90d',days:90,forgetAfterDays:7}
];
export function makeCycleReport(){
 return {schema:'ux59-m2-multicycle-report-v1',
  dataset:'four synthetic scenarios; no learner records',
  policy_comparison:'UX24 fixed interval vs UX59 candidate 12h post repeated needs',
  caveat:'Decision outcomes are invented by the simulator; review workload is not real measured retention or efficacy.',
  scenarios:scenarios.map(({id,...config})=>{
   const result=compareSrsCycles(config);
   return {id,window_days:result.window_days,assumption:result.assumption,
    baseline:{total_reviews:result.baseline.total_reviews,marked_need_review:result.baseline.marked_need_review,
      next_due_at:result.baseline.next_due_at},
    candidate:{total_reviews:result.candidate.total_reviews,marked_need_review:result.candidate.marked_need_review,
      next_due_at:result.candidate.next_due_at},delta:result.delta};
  })};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)
 process.stdout.write(JSON.stringify(makeCycleReport(),null,2)+'\n');
