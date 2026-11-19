// UX59 M1 - research-only simulator. Do not import into production runtime.
import {computeSrsState,SRS_INTERVAL_DAYS} from './srs-schedule.js';
const DAY=86400000;
const instant=v=>{const t=Date.parse(v);if(!Number.isFinite(t))throw Error('Invalid time');return t};
const cmp=(a,b)=>a<b?-1:a>b?1:0;

// Candidate: after >=2 consecutive "need review" decisions, the next
// accepted remembered decision has a 12h interval instead of 24h.
// Subjective remembered flags are NOT validated recall or test accuracy.
export function computeCandidateState(history,{now=new Date()}={}){
 const baseline=computeSrsState(history,{now});
 if(!history.length)return {...baseline,policy:'ux59-offline-repeat-needs-v1'};
 const events=history.map(e=>({id:e.id,remembered:e.remembered,time:instant(e.reviewed_at)}))
  .sort((a,b)=>a.time-b.time||cmp(a.id,b.id));
 let streak=0,interval=0,due=null,needs=0;
 for(const e of events){
  if(!e.remembered){streak=0;interval=0;due=e.time;needs++;continue}
  if(streak>0&&e.time<due)continue; // preserve early-review due date
  streak++;
  interval=SRS_INTERVAL_DAYS[Math.min(streak,SRS_INTERVAL_DAYS.length)-1];
  if(streak===1&&needs>=2)interval=0.5;
  due=e.time+interval*DAY;needs=0;
 }
 return {...baseline,policy:'ux59-offline-repeat-needs-v1',
  consecutive_remembered:streak,interval_days:interval,
  due_at:new Date(due).toISOString(),status:due<=instant(now)?'due':'scheduled'};
}
export function compareOfflineSchedules(fixtures,{now=new Date()}={}){
 if(!Array.isArray(fixtures)||fixtures.length>10000)throw Error('Invalid fixtures');
 const seen=new Set(),rows=[],totals={cards:0,changed_due_at:0,earlier:0,later:0,unchanged:0,baseline_due:0,candidate_due:0};
 for(const row of fixtures){
  if(!row||typeof row.key!=='string'||!row.key||!Array.isArray(row.history)||seen.has(row.key))
   throw Error('Invalid or repeated fixture key');
  seen.add(row.key);
  const b=computeSrsState(row.history,{now}),c=computeCandidateState(row.history,{now});
  const delta=b.due_at?(instant(c.due_at)-instant(b.due_at))/DAY:0;
  totals.cards++;totals.baseline_due+=Number(b.status==='due');totals.candidate_due+=Number(c.status==='due');
  if(delta===0)totals.unchanged++;else{totals.changed_due_at++;totals[delta<0?'earlier':'later']++}
  rows.push({key:row.key,review_count:b.review_count,baseline_status:b.status,candidate_status:c.status,
   baseline_due_at:b.due_at,candidate_due_at:c.due_at,delta_days:delta});
 }
 return {schema:'ux59-offline-comparison-v1',baseline_policy:'ux24-fixed-v1',
  candidate_policy:'ux59-offline-repeat-needs-v1',
  evidence:'hypothetical subjective decisions; not observed retention',totals,rows};
}
