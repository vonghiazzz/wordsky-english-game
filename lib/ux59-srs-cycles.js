// UX59 M2 - deterministic hypothetical multi-cycle research. No DB/network.
import {computeSrsState} from './srs-schedule.js';
import {computeCandidateState} from './ux59-srs-offline.js';

const DAY=86400000;
const POLICIES=Object.freeze({baseline:computeSrsState,candidate:computeCandidateState});
const iso=value=>new Date(value).toISOString();
function fixedTime(value,label){
 if(typeof value!=='string'||!/(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(value)||!Number.isFinite(Date.parse(value)))
  throw Error(label+' must be timezone-aware');
 return Date.parse(value);
}

// Artificial learner. Review at the policy's due time, or 1h after
// an immediately due "need review" to prevent a zero-time loop.
// Two initial "need review" decisions form a fixed research cohort;
// subsequent decisions follow a hypothetical gap threshold.
export function simulateSrsCycles({policy='baseline',start='2026-01-01T00:00:00Z',
 days=90,forgetAfterDays=null,maxReviews=1000}={}){
 if(!Object.hasOwn(POLICIES,policy))throw Error('Unknown policy');
 const begin=fixedTime(start,'start');
 if(!Number.isInteger(days)||days<1||days>365||
   !Number.isInteger(maxReviews)||maxReviews<1||maxReviews>10000||
   (forgetAfterDays!==null&&(!Number.isFinite(forgetAfterDays)||forgetAfterDays<=0||forgetAfterDays>365)))
  throw Error('Invalid simulation bounds');
 const finish=begin+days*DAY,history=[],timings=[];
 let next=begin,reviewIndex=0;
 while(next<finish){
  if(reviewIndex>=maxReviews)throw Error('Simulation exceeded event safety bound');
  const previous=history.at(-1);
  const elapsed=previous?(next-Date.parse(previous.reviewed_at))/DAY:null;
  const remembered=reviewIndex<2?false:(forgetAfterDays===null||elapsed<=forgetAfterDays);
  const event={id:'sim-'+String(++reviewIndex).padStart(5,'0'),
    remembered,reviewed_at:iso(next)};
  history.push(event);
  const state=POLICIES[policy](history,{now:iso(next)});
  const due=Date.parse(state.due_at);
  if(!Number.isFinite(due))throw Error('No due date');
  const proposed=Math.max(due,next+3600000);
  timings.push({at:event.reviewed_at,remembered,due_at:state.due_at,
    interval_days:state.interval_days});
  if(proposed<=next)throw Error('Simulation clock did not advance');
  next=proposed;
 }
 const needs=history.filter(x=>!x.remembered).length;
 return {policy,scenario:forgetAfterDays===null?'always-remember-after-initial-needs':'hypothetical-gap-threshold',
  assumption_forget_after_days:forgetAfterDays,days,as_of:iso(finish),
  total_reviews:history.length,marked_remembered:history.length-needs,marked_need_review:needs,
  first_review_at:history[0]?.reviewed_at??null,last_review_at:history.at(-1)?.reviewed_at??null,
  next_due_at:history.length?POLICIES[policy](history,{now:iso(finish)}).due_at:null,
  timings};
}
export function compareSrsCycles({days=90,forgetAfterDays=null,...rest}={}){
 const baseline=simulateSrsCycles({...rest,days,forgetAfterDays,policy:'baseline'});
 const candidate=simulateSrsCycles({...rest,days,forgetAfterDays,policy:'candidate'});
 return {schema:'ux59-m2-synthetic-multicycle-v1',
  evidence:'hypothetical policy-dependent outcomes, not measured retention',
  assumption:forgetAfterDays===null?'two initial needs; always remembered thereafter':
   'two initial needs; remembered iff gap since prior review <= '+forgetAfterDays+' days',
  window_days:days,baseline,candidate,
  delta:{total_reviews:candidate.total_reviews-baseline.total_reviews,
    marked_need_review:candidate.marked_need_review-baseline.marked_need_review}};
}
