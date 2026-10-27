import {transaction} from './db.js';
import {rebuildSrsProjection,SRS_POLICY_VERSION} from './srs-projection.js';
import {fail} from './game.js';

// Read-only QA endpoint: account-scoped parity of persisted SRS projection
// against the authoritative append-only events. Never returns raw history.
export function compareSrsShadowRows(schedules,sharedEvents,personalEvents){
 if(!Array.isArray(schedules)||!Array.isArray(sharedEvents)||!Array.isArray(personalEvents))
  throw Error('SRS diagnostic input must contain arrays');
 const byWord=new Map();
 for(const [source,events,column] of [
  ['shared',sharedEvents,'word_id'],['personal',personalEvents,'personal_word_id']
 ]){
  for(const event of events){
   const key=source+':'+event[column];
   if(!byWord.has(key))byWord.set(key,[]);
   byWord.get(key).push(event);
  }
 }
 const observed=new Set();
 let matched=0,mismatched=0,orphaned=0;
 for(const row of schedules){
  const key=row.source+':'+row.word_id;
  if(!['shared','personal'].includes(row.source)||observed.has(key))
   throw Error('SRS diagnostic has duplicate or unsupported schedule');
  observed.add(key);
  const history=byWord.get(key);
  if(!history?.length){orphaned++;continue;}
  let desired;
  try{desired=rebuildSrsProjection(history);}catch{mismatched++;continue;}
  const utc=x=>x instanceof Date?x.toISOString():new Date(x).toISOString();
  if(row.policy_version===SRS_POLICY_VERSION &&
     row.review_count===desired.review_count &&
     row.remembered===desired.remembered &&
     row.consecutive_remembered===desired.consecutive_remembered &&
     row.interval_days===desired.interval_days &&
     row.last_event_id===desired.last_event_id &&
     utc(row.due_at)===desired.due_at &&
     utc(row.last_reviewed_at)===desired.last_reviewed_at)matched++;
  else mismatched++;
 }
 const missing=[...byWord.keys()].filter(k=>!observed.has(k)).length;
 // Rows can be absent because a historical word has never been shadow-written;
 // this is "partial", not a false claim that the persisted schedules disagree.
 const status=mismatched||orphaned?'mismatch':missing?'partial':'complete';
 return {status,history_words:byWord.size,materialized:schedules.length,
  matched,mismatched,missing,orphaned};
}

export async function getAccountSrsDiagnostics(userId){
 try{
  return await transaction(async db=>{
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const timestamp=await db.query('SELECT transaction_timestamp() AS as_of');
   const rows=await db.query(
    'SELECT source,word_id,policy_version,last_event_id,last_reviewed_at,'+
    'remembered,review_count,consecutive_remembered,interval_days,due_at '+
    'FROM ws_user_srs_schedules WHERE user_id=$1 ORDER BY source,word_id LIMIT 10001',[userId]);
   const shared=await db.query(
    'SELECT id,word_id,remembered,reviewed_at FROM ws_learning_flashcard_reviews '+
    'WHERE user_id=$1 ORDER BY reviewed_at,id LIMIT 50001',[userId]);
   const personal=await db.query(
    'SELECT id,personal_word_id,remembered,reviewed_at FROM ws_personal_card_reviews '+
    'WHERE user_id=$1 ORDER BY reviewed_at,id LIMIT 50001',[userId]);
   if(rows.rows.length>10000||shared.rows.length>50000||personal.rows.length>50000)
    throw fail('Lịch sử ôn vượt giới hạn kiểm tra an toàn',503);
   const report=compareSrsShadowRows(rows.rows,shared.rows,personal.rows);
   return {scope:'account-srs-diagnostics',actor_id:userId,
    as_of:new Date(timestamp.rows[0].as_of).toISOString(),
    policy:SRS_POLICY_VERSION,...report};
  });
 }catch(error){
  if(error?.code==='42P01')
   throw fail('Chưa triển khai bảng SRS để đối chiếu lịch ôn',503);
  throw error;
 }
}
