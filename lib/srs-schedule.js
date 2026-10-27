// UX-24 SRS prototype. Pure deterministic policy; no database writes.
// It is NOT FSRS: remembered=true/false are explicit learner decisions,
// not objective quiz grades, and should not be treated as measured recall.
export const SRS_INTERVAL_DAYS=Object.freeze([1,3,7,14,30,60,90]);
const DAY_MS=24*60*60*1000;
const ABSOLUTE_DATE=/T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

function instant(input,label){
 if(input instanceof Date){
  const millis=input.getTime();
  if(!Number.isFinite(millis))throw Error(label+' must be a valid instant');
  return millis;
 }
 if(typeof input!=='string'||!ABSOLUTE_DATE.test(input))
  throw Error(label+' must specify a timezone');
 const millis=Date.parse(input);
 if(!Number.isFinite(millis))throw Error(label+' must be a valid instant');
 return millis;
}
const compare=(a,b)=>a<b?-1:a>b?1:0;

export function computeSrsState(history,{now=new Date()}={}){
 if(!Array.isArray(history))throw Error('SRS history must be an array');
 const nowMillis=instant(now,'SRS now');
 const observed=new Set();
 const events=history.map(event=>{
  if(!event||typeof event!=='object'||Array.isArray(event)||
     typeof event.id!=='string'||!event.id.trim()||
     typeof event.remembered!=='boolean')
   throw Error('SRS event must have id and remembered boolean');
  if(observed.has(event.id))throw Error('Duplicate SRS review event id');
  observed.add(event.id);
  return {id:event.id,remembered:event.remembered,
    reviewed_at:instant(event.reviewed_at,'SRS reviewed_at')};
 }).sort((a,b)=>a.reviewed_at-b.reviewed_at||compare(a.id,b.id));

 let streak=0,intervalDays=0,dueMillis=null,lastReviewedMillis=null;
 for(const event of events){
  lastReviewedMillis=event.reviewed_at;
  if(event.remembered){
   if(streak>0&&dueMillis!==null&&event.reviewed_at<dueMillis){
    // Early repeat practice counts as history, but cannot inflate SRS
    // success streak or push the due date farther into the future.
    continue;
   }
   streak+=1;
   intervalDays=SRS_INTERVAL_DAYS[Math.min(streak,SRS_INTERVAL_DAYS.length)-1];
   dueMillis=event.reviewed_at+intervalDays*DAY_MS;
  }else{
   // Explicit 'Need review' means actionable immediately, not a quiz failure.
   streak=0;
   intervalDays=0;
   dueMillis=event.reviewed_at;
  }
 }
 const status=!events.length?'new':dueMillis<=nowMillis?'due':'scheduled';
 return {
  status,review_count:events.length,remembered:events.length>0?events.at(-1).remembered:null,
  consecutive_remembered:streak,interval_days:intervalDays,
  last_reviewed_at:lastReviewedMillis===null?null:new Date(lastReviewedMillis).toISOString(),
  due_at:dueMillis===null?null:new Date(dueMillis).toISOString()
 };
}

// Sort ALL eligible cards; do not silently limit the list to 20 words.
// Presentation can paginate independently of backend import chunk sizes.
export function buildSrsQueue(cards,historyByWord,{now=new Date()}={}){
 if(!Array.isArray(cards)||!(historyByWord instanceof Map))
  throw Error('SRS requires cards and per-word histories');
 const seen=new Set(),due=[],upcoming=[],newWords=[];
 for(const card of cards){
  if(!card||!['shared','personal'].includes(card.source)||
     typeof card.id!=='string'||!card.id.trim())
   throw Error('SRS card requires source and id');
  const key=card.source+':'+card.id;
  if(seen.has(key))throw Error('Duplicate SRS vocabulary card');
  seen.add(key);
  const state=computeSrsState(historyByWord.get(key)??[],{now});
  const row={...card,...state};
  if(state.status==='due')due.push(row);
  else if(state.status==='scheduled')upcoming.push(row);
  else newWords.push(row);
 }
 const byKey=(a,b)=>compare(a.source,b.source)||compare(a.id,b.id);
 due.sort((a,b)=>compare(a.due_at,b.due_at)||byKey(a,b));
 upcoming.sort((a,b)=>compare(a.due_at,b.due_at)||byKey(a,b));
 newWords.sort(byKey);
 return {due,upcoming,new:newWords,
  summary:{due:due.length,upcoming:upcoming.length,new:newWords.length,
   total:cards.length}};
}
