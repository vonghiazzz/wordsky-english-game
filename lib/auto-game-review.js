/*
 * UX27.1 — account-owned, idempotent automatic "needs review" from finished
 * Solo games. An objective game mistake is a false/needs-review learning event;
 * it never fabricates a remembered:true event or changes another user's state.
 *
 * The game transaction commits first. This separate account-serialized
 * transaction is retried by authorized reads after transient failure, so a
 * learning error never rolls back a completed game. No new tables/migrations.
 */
import {createHash} from 'node:crypto';
import {sql,transaction} from './db.js';
import {validWrongWordIds} from './game-mistakes.js';
import {srsShadowEnabled,writeSrsShadowSchedule} from './srs-shadow.js';

export function gameReviewRequestId(runId,wordId){
 const hex=createHash('sha1').update('wordsky.ux27.1.auto-review:').update(runId).update(':').update(wordId).digest('hex');
 // RFC 4122 UUID v5: deterministic per (run, word), replay-safe.
 const chars=hex.slice(0,32).split('');
 chars[12]='5';
 chars[16]='89ab'[parseInt(chars[16],16)&3];
 const x=chars.join('');
 return x.slice(0,8)+'-'+x.slice(8,12)+'-'+x.slice(12,16)+'-'+x.slice(16,20)+'-'+x.slice(20,32);
}

export async function syncFinishedSoloReview(userId,runId){
 return transaction(async db=>{
  // Same lock as the normal UX23 review API, so browser writes and
  // automatic game marks cannot overwrite each other concurrently.
  const actor=await db.query('SELECT id FROM ws_users WHERE id=$1 FOR UPDATE',[userId]);
  if(!actor.rows.length)return {status:'account-unavailable',newly_queued:0};
  const run=await db.query(
    'SELECT status,state,finished_at FROM ws_solo_runs '+
    'WHERE id=$1 AND user_id=$2',[runId,userId]
  );
  const item=run.rows[0];
  if(!item||item.status==='PLAYING'||!item.finished_at)
    return {status:'not-finished',newly_queued:0};
  const ids=validWrongWordIds(item.state);
  if(!ids.length)return {status:'synced',newly_queued:0,identified:0};
  const found=await db.query(
    'SELECT w.id::text AS word_id,p.remembered,p.last_reviewed_at '+
    'FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id '+
    'LEFT JOIN ws_learning_word_progress p ON p.user_id=$1 AND p.word_id=w.id '+
    'WHERE w.id=ANY($2::uuid[]) AND w.enabled=true AND t.enabled=true',
    [userId,ids]
  );
  const finishedAt=new Date(item.finished_at).getTime();
  // A learner's newer explicit review always wins over an old game result.
  // Already-needed-review cards remain due; don't inflate their review counts.
  const queued=found.rows.filter(w=>{
    if(w.remembered===false)return false;
    if(w.last_reviewed_at&&new Date(w.last_reviewed_at).getTime()>finishedAt)return false;
    return true;
  });
  if(!queued.length)return {status:'synced',newly_queued:0,identified:ids.length};
  const selectedIds=queued.map(w=>w.word_id);
  const requestIds=selectedIds.map(id=>gameReviewRequestId(runId,id));
  const claim=await db.query(
    'INSERT INTO ws_learning_review_requests '+
    '(user_id,request_id,source,word_id,remembered,reviewed_at) '+
    "SELECT $1::uuid, x.request_id, 'shared',x.word_id,false,clock_timestamp() "+
    'FROM unnest($2::uuid[],$3::uuid[]) AS x(word_id,request_id) '+
    'ON CONFLICT(user_id,request_id) DO NOTHING '+
    'RETURNING word_id::text AS word_id,reviewed_at',
    [userId,selectedIds,requestIds]
  );
  const added=claim.rows;
  if(!added.length)return {status:'synced',newly_queued:0,identified:ids.length};
  const words=added.map(v=>v.word_id);
  const at=added.map(v=>v.reviewed_at);
  await db.query(
    'INSERT INTO ws_learning_flashcard_reviews(user_id,word_id,remembered,reviewed_at) '+
    'SELECT $1::uuid,x.word_id,false,x.reviewed_at '+
    'FROM unnest($2::uuid[],$3::timestamptz[]) AS x(word_id,reviewed_at)',
    [userId,words,at]
  );
  await db.query(
    'INSERT INTO ws_learning_word_progress '+
    '(user_id,word_id,remembered,review_count,last_reviewed_at) '+
    'SELECT $1::uuid,x.word_id,false,1,x.reviewed_at '+
    'FROM unnest($2::uuid[],$3::timestamptz[]) AS x(word_id,reviewed_at) '+
    'ON CONFLICT(user_id,word_id) DO UPDATE SET '+
    'remembered=false,review_count=ws_learning_word_progress.review_count+1,'+
    'last_reviewed_at=EXCLUDED.last_reviewed_at',
    [userId,words,at]
  );
  // Only when the correctly gated SRS shadow is enabled; never use Preview
  // flags to change the Production SRS release gate.
  if(srsShadowEnabled()){
    for(const wordId of words)
      await writeSrsShadowSchedule(db,{userId,source:'shared',wordId});
  }
  return {status:'synced',newly_queued:added.length,identified:ids.length};
 });
}


// Account-scoped historical reconciliation, explicitly called by a POST from
// the learner's notebook. It covers completed UX27 runs that predate automatic
// enqueueing; never backfills old runs without recorded word identities.
export async function syncRecentSoloReviews(userId){
 const recent=await sql(
   'SELECT id FROM ws_solo_runs WHERE user_id=$1 '+
   "AND status IN ('COMPLETED','FAILED','TIMEOUT') "+
   'AND finished_at IS NOT NULL AND ('+
   "(CASE WHEN jsonb_typeof(state->'wrongWordIds')='array' "+
   "THEN jsonb_array_length(state->'wrongWordIds') ELSE 0 END)>0 OR "+
   "(CASE WHEN jsonb_typeof(state->'missedPracticeWordIds')='array' "+
   "THEN jsonb_array_length(state->'missedPracticeWordIds') ELSE 0 END)>0"+
   ') ORDER BY finished_at DESC,id LIMIT 20',
   [userId]
 );
 let enrolled=0;
 for(const run of recent.rows){
   const response=await syncFinishedSoloReview(userId,run.id);
   enrolled+=response.newly_queued||0;
 }
 return {scope:'account-game-mistakes',actor_id:userId,
   scanned_runs:recent.rows.length,newly_queued:enrolled};
}
