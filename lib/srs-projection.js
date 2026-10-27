import {SRS_INTERVAL_DAYS,computeSrsState} from './srs-schedule.js';

// UX-24B shadow projection prototype. Pure functions only.
// Versioned to prevent silently reinterpreting persisted schedules when
// the heuristic changes. No DB writes, API endpoint changes or deployments.
export const SRS_POLICY_VERSION='ux24-fixed-v1';
const DAY_MS=86400000;
const ZONED=/T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
const cmp=(a,b)=>a<b?-1:a>b?1:0;

function iso(value,label){
 if(value instanceof Date){
  if(!Number.isFinite(value.getTime()))throw Error(label+' must be a valid instant');
  return value.toISOString();
 }
 if(typeof value!=='string'||!ZONED.test(value)||!Number.isFinite(Date.parse(value)))
  throw Error(label+' must contain a timezone-aware instant');
 return new Date(value).toISOString();
}
function verify(previous){
 if(previous===null)return;
 if(!previous||previous.policy_version!==SRS_POLICY_VERSION||
  !Number.isSafeInteger(previous.review_count)||previous.review_count<1||
  !Number.isSafeInteger(previous.consecutive_remembered)||previous.consecutive_remembered<0||
  !Number.isSafeInteger(previous.interval_days)||previous.interval_days<0||
  typeof previous.remembered!=='boolean'||
  typeof previous.last_event_id!=='string'||!previous.last_event_id||
  previous.consecutive_remembered>previous.review_count)
  throw Error('SRS projection is invalid or uses another policy version');
 iso(previous.last_reviewed_at,'SRS previous last_reviewed_at');
 iso(previous.due_at,'SRS previous due_at');
}

// The caller MUST already have accepted this event in the UX-23 atomic
// account transaction, or be replaying an explicitly ordered history.
// Replayed request IDs must never reach this function as new events.
export function projectAcceptedSrsEvent(previous,event){
 verify(previous);
 if(!event||typeof event!=='object'||Array.isArray(event)||
    typeof event.id!=='string'||!event.id.trim()||
    typeof event.remembered!=='boolean')
  throw Error('SRS event must have id and remembered boolean');
 const reviewedAt=iso(event.reviewed_at,'SRS event reviewed_at');
 if(previous){
  const order=cmp(reviewedAt,iso(previous.last_reviewed_at,'previous time'))||
    cmp(event.id,previous.last_event_id);
  if(order<=0)throw Error('SRS event is duplicate or not in deterministic order; rebuild from history');
 }
 const reviewCount=(previous?.review_count??0)+1;
 const hadStreak=(previous?.consecutive_remembered??0)>0;
 let streak=previous?.consecutive_remembered??0;
 let intervalDays=previous?.interval_days??0;
 let dueAt=previous?.due_at??null;
 if(!event.remembered){
  streak=0;
  intervalDays=0;
  dueAt=reviewedAt;
 }else if(!hadStreak||Date.parse(reviewedAt)>=Date.parse(dueAt)){
  streak+=1;
  intervalDays=SRS_INTERVAL_DAYS[Math.min(streak,SRS_INTERVAL_DAYS.length)-1];
  dueAt=new Date(Date.parse(reviewedAt)+intervalDays*DAY_MS).toISOString();
 }
 return {
  policy_version:SRS_POLICY_VERSION,
  last_event_id:event.id,
  last_reviewed_at:reviewedAt,
  remembered:event.remembered,
  review_count:reviewCount,
  consecutive_remembered:streak,
  interval_days:intervalDays,
  due_at:dueAt
 };
}

// Backfill/reconciliation from accepted history, not from a progress count.
// A history with non-monotonic event times must be sorted and replayed.
// This is NOT automatically called on Production, Preview or the API.
export function rebuildSrsProjection(history){
 if(!Array.isArray(history))throw Error('SRS history must be an array');
 const ids=new Set();
 const events=history.map(event=>{
  if(!event||typeof event.id!=='string'||!event.id.trim())
   throw Error('SRS history event id is required');
  if(ids.has(event.id))throw Error('Duplicate SRS event id');
  ids.add(event.id);
  return {...event,reviewed_at:iso(event.reviewed_at,'SRS event reviewed_at')};
 }).sort((a,b)=>cmp(a.reviewed_at,b.reviewed_at)||cmp(a.id,b.id));
 return events.reduce((state,event)=>projectAcceptedSrsEvent(state,event),null);
}

export function compareSrsProjection(history,{now=new Date()}={}){
 const rebuilt=rebuildSrsProjection(history);
 const canonical=computeSrsState(history,{now});
 if(!rebuilt)return {matches:canonical.status==='new'&&canonical.review_count===0,
  projection:null,canonical};
 const fields=['review_count','remembered','consecutive_remembered',
  'interval_days','last_reviewed_at','due_at'];
 return {matches:fields.every(field=>rebuilt[field]===canonical[field]),
  projection:rebuilt,canonical};
}
