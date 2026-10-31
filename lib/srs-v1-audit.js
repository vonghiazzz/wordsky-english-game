/*
 * UX43A - offline, aggregated evaluation of the CURRENT fixed SRS policy.
 * No database imports, no API, no writes, no individual identities in output.
 *
 * "remembered" is a learner's explicit decision, NOT measured test accuracy.
 * Mixed legacy/game-automatic events have no reliable evidence-source column;
 * never call a remembered:false event an objectively incorrect answer.
 */
import {computeSrsState} from './srs-schedule.js';
import {projectAcceptedSrsEvent,rebuildSrsProjection,SRS_POLICY_VERSION} from './srs-projection.js';

const ABSOLUTE=/T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
const MAX_EVENTS=100000;
const MAX_ROWS=100000;
const DAY_MS=86400000;
const key=row=>JSON.stringify([row.user_id,row.source,row.word_id]);
const cmp=(a,b)=>a<b?-1:a>b?1:0;

function instant(value){
 if(value instanceof Date){
  if(!Number.isFinite(value.getTime()))throw Error('UX43A invalid timestamp');
  return value.toISOString();
 }
 if(typeof value!=='string'||!ABSOLUTE.test(value)||!Number.isFinite(Date.parse(value)))
  throw Error('UX43A requires explicit timezone-aware timestamps');
 return new Date(value).toISOString();
}
function identity(row){
 if(!row||typeof row!=='object'||Array.isArray(row)||
   typeof row.user_id!=='string'||!row.user_id.trim()||
   !['shared','personal'].includes(row.source)||
   typeof row.word_id!=='string'||!row.word_id.trim())
  throw Error('UX43A invalid account/card identity');
}
function bounded(list,label,max=MAX_ROWS){
 if(!Array.isArray(list)||list.length>max)throw Error('UX43A invalid or oversized '+label);
}
function normalizeEvents(events,asOf){
 bounded(events,'history',MAX_EVENTS);
 const groups=new Map(),ids=new Set(),accounts=new Set();
 for(const row of events){
  identity(row);
  if(typeof row.id!=='string'||!row.id.trim()||typeof row.remembered!=='boolean')
   throw Error('UX43A invalid historical review event');
  const event={id:row.id,remembered:row.remembered,reviewed_at:instant(row.reviewed_at)};
  if(Date.parse(event.reviewed_at)>Date.parse(asOf))
   throw Error('UX43A future event exceeds repeatable-read snapshot');
  const eventKey=row.source+':'+row.id;
  if(ids.has(eventKey))throw Error('UX43A duplicate history event id');
  ids.add(eventKey);
  const cardKey=key(row);
  if(!groups.has(cardKey))groups.set(cardKey,[]);
  groups.get(cardKey).push(event);
  accounts.add(row.user_id);
 }
 for(const group of groups.values())
  group.sort((a,b)=>cmp(a.reviewed_at,b.reviewed_at)||cmp(a.id,b.id));
 return {groups,accounts:accounts.size};
}
function normalizedStateMap(rows,label){
 bounded(rows,label);
 const map=new Map();
 for(const row of rows){
  identity(row);
  const k=key(row);
  if(map.has(k))throw Error('UX43A duplicate '+label+' row');
  map.set(k,row);
 }
 return map;
}
function sameDate(a,b){
 return instant(a)===instant(b);
}

/**
 * Returns aggregate counters only. The cohort contains REVIEWED cards,
 * never all enabled vocabulary, and event labels are unverified subjective
 * choices (including automatic game "needs review" events).
 */
export function evaluateSrsV1({
 events,progressRows=[],scheduleRows=[],asOf
}){
 const at=instant(asOf);
 const {groups,accounts}=normalizeEvents(events,at);
 const progress=normalizedStateMap(progressRows,'progress');
 const schedules=normalizedStateMap(scheduleRows,'schedule');
 const result={
  schema:'ux43a-v1',
  policy:SRS_POLICY_VERSION,
  as_of:at,
  cohort:'reviewed-cards-only',
  evidence:'explicit-or-automatic-remembered-decisions; not measured recall',
  population:{
   accounts_with_history:accounts,reviewed_cards:groups.size,
   total_review_events:events.length,
   shared_cards:0,personal_cards:0,shared_events:0,personal_events:0
  },
  decisions:{marked_remembered:0,marked_need_review:0},
  timing:{
   first_review_events:0,repeat_review_events:0,
   before_due:0,at_or_after_due:0,more_than_24h_after_due:0,
   more_than_7d_after_due:0,early_remembered_preserved_due:0,
   same_instant_repeats:0
  },
  current_reviewed_cards:{due:0,scheduled:0},
  parity:{matched:0,mismatched:0},
  progress:{matched:0,mismatched:0,missing:0,orphaned:0},
  shadow:{matched:0,mismatched:0,missing:0,orphaned:0},
  verdict:'insufficient-to-estimate-recall-or-algorithm-superiority'
 };
 for(const [cardKey,history] of groups){
  const parsed=JSON.parse(cardKey);
  const source=parsed[1];
  result.population[source+'_cards']++;
  result.population[source+'_events']+=history.length;
  let previous=null;
  for(const [i,event] of history.entries()){
   if(event.remembered)result.decisions.marked_remembered++;
   else result.decisions.marked_need_review++;
   if(i===0)result.timing.first_review_events++;
   else{
    result.timing.repeat_review_events++;
    const eventTime=Date.parse(event.reviewed_at),due=Date.parse(previous.due_at);
    const last=Date.parse(history[i-1].reviewed_at);
    if(eventTime===last)result.timing.same_instant_repeats++;
    if(eventTime<due)result.timing.before_due++;
    else{
     result.timing.at_or_after_due++;
     if(eventTime-due>DAY_MS)result.timing.more_than_24h_after_due++;
     if(eventTime-due>7*DAY_MS)result.timing.more_than_7d_after_due++;
    }
   }
   const projected=projectAcceptedSrsEvent(previous,event);
   if(i>0 && event.remembered && previous.consecutive_remembered>0 &&
      Date.parse(event.reviewed_at)<Date.parse(previous.due_at) &&
      projected.due_at===previous.due_at)
    result.timing.early_remembered_preserved_due++;
   previous=projected;
  }
  const canonical=computeSrsState(history,{now:at});
  const replay=rebuildSrsProjection(history);
  const agreed=previous.last_event_id===replay.last_event_id&&
   previous.review_count===replay.review_count&&
   previous.due_at===replay.due_at&&
   previous.review_count===canonical.review_count&&
   previous.remembered===canonical.remembered&&
   previous.consecutive_remembered===canonical.consecutive_remembered&&
   previous.interval_days===canonical.interval_days&&
   previous.last_reviewed_at===canonical.last_reviewed_at&&
   previous.due_at===canonical.due_at;
  result.parity[agreed?'matched':'mismatched']++;
  result.current_reviewed_cards[canonical.status]++;
  const latest=history.at(-1);
  const stored=progress.get(cardKey);
  if(!stored)result.progress.missing++;
  else{
   progress.delete(cardKey);
   const match=Number.isSafeInteger(stored.review_count)&&
    stored.review_count===history.length&&stored.remembered===latest.remembered&&
    sameDate(stored.last_reviewed_at,latest.reviewed_at);
   result.progress[match?'matched':'mismatched']++;
  }
  const schedule=schedules.get(cardKey);
  if(!schedule)result.shadow.missing++;
  else{
   schedules.delete(cardKey);
   const check=schedule.policy_version===SRS_POLICY_VERSION&&
    schedule.last_event_id===previous.last_event_id&&
    schedule.review_count===previous.review_count&&
    schedule.remembered===previous.remembered&&
    schedule.consecutive_remembered===previous.consecutive_remembered&&
    schedule.interval_days===previous.interval_days&&
    sameDate(schedule.last_reviewed_at,previous.last_reviewed_at)&&
    sameDate(schedule.due_at,previous.due_at);
   result.shadow[check?'matched':'mismatched']++;
  }
 }
 result.progress.orphaned=progress.size;
 result.shadow.orphaned=schedules.size;
 if(result.population.total_review_events!==
    result.decisions.marked_remembered+result.decisions.marked_need_review ||
    result.timing.repeat_review_events+result.timing.first_review_events!==events.length ||
    result.timing.before_due+result.timing.at_or_after_due!==result.timing.repeat_review_events)
  throw Error('UX43A audit counter invariant violated');
 return result;
}
