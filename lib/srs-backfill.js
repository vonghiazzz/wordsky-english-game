import {transaction} from './db.js';
import {fail} from './game.js';
import {rebuildSrsProjection,SRS_POLICY_VERSION} from './srs-projection.js';
import {compareSrsShadowRows} from './srs-diagnostics.js';

const MAX_EVENTS=50000,MAX_SCHEDULES=10000;
const iso=value=>new Date(value).toISOString();

// User-scoped deterministic plan; never synthesizes history from progress.
// Unknown or conflicting old schedule rows fail closed: backfill must not
// silently rewrite learner decisions or hide a drift bug.
export function planAccountSrsBackfill({shared=[],personal=[],progress=[],schedules=[]}={}){
 const observed=new Map(), counts=new Map(),projected=new Map();
 for(const [source,events,field] of [
  ['shared',shared,'word_id'],['personal',personal,'personal_word_id']
 ]){
  for(const event of events){
   const key=source+':'+event[field];
   if(!observed.has(key))observed.set(key,[]);
   observed.get(key).push(event);
  }
 }
 for(const item of progress){
  if(!['shared','personal'].includes(item.source)||
     typeof item.word_id!=='string'||!Number.isSafeInteger(item.review_count)||
     item.review_count<1)
   throw fail('Dữ liệu tiến độ SRS không hợp lệ',503);
  const key=item.source+':'+item.word_id;
  if(counts.has(key))throw fail('Tiến độ SRS bị trùng',503);
  counts.set(key,item.review_count);
 }
 for(const [key,history] of observed){
  if(counts.get(key)!==history.length)
   throw fail('Tiến độ và lịch sử ôn chưa khớp; từ chối backfill',503);
  projected.set(key,rebuildSrsProjection(history));
 }
 for(const key of counts.keys()){
  if(!observed.has(key))throw fail('Tiến độ không có lịch sử ôn; từ chối backfill',503);
 }
 const audit=compareSrsShadowRows(schedules,shared,personal);
 if(audit.mismatched||audit.orphaned)
  throw fail('Lịch SRS đã lưu khác lịch sử; không ghi đè dữ liệu',409);
 const existing=new Set(schedules.map(row=>row.source+':'+row.word_id));
 const pending=[];
 for(const [key,state] of projected){
  if(existing.has(key))continue;
  const index=key.indexOf(':');
  pending.push({source:key.slice(0,index),word_id:key.slice(index+1),...state});
 }
 pending.sort((a,b)=>a.source.localeCompare(b.source)||a.word_id.localeCompare(b.word_id));
 return {status:pending.length?'partial':'complete',
  historical_words:observed.size,existing:schedules.length,
  ready_to_insert:pending.length,matched:audit.matched,pending};
}

// Each account is an independent transactional batch. Every active review
// writer locks ws_users FIRST, so no accepted event can race this snapshot.
// A failed insert rolls back the whole account's backfill.
export async function backfillAccountSrs(userId,{apply=false}={}){
 if(typeof userId!=='string'||!userId)throw fail('Tài khoản SRS không hợp lệ',400);
 return transaction(async db=>{
  if(!apply)await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  else{
   const owner=await db.query('SELECT id FROM ws_users WHERE id=$1 FOR UPDATE',[userId]);
   if(!owner.rows.length)throw fail('Tài khoản SRS không tồn tại',404);
  }
  const shared=await db.query('SELECT id,word_id,remembered,reviewed_at FROM ws_learning_flashcard_reviews WHERE user_id=$1 ORDER BY reviewed_at,id LIMIT 50001',[userId]);
  const personal=await db.query('SELECT id,personal_word_id,remembered,reviewed_at FROM ws_personal_card_reviews WHERE user_id=$1 ORDER BY reviewed_at,id LIMIT 50001',[userId]);
  const progress=await db.query(
   "SELECT 'shared'::text AS source,word_id,review_count FROM ws_learning_word_progress WHERE user_id=$1 "+
   "UNION ALL SELECT 'personal'::text AS source,personal_word_id AS word_id,review_count FROM ws_personal_card_progress WHERE user_id=$1",
   [userId]);
  const schedules=await db.query(
   'SELECT source,word_id,policy_version,last_event_id,last_reviewed_at,remembered,'+
   'review_count,consecutive_remembered,interval_days,due_at FROM ws_user_srs_schedules '+
   'WHERE user_id=$1 ORDER BY source,word_id LIMIT 10001',[userId]);
  if(shared.rows.length>MAX_EVENTS||personal.rows.length>MAX_EVENTS||
     schedules.rows.length>MAX_SCHEDULES)
   throw fail('Lịch sử SRS vượt giới hạn backfill an toàn',503);
  const plan=planAccountSrsBackfill({
   shared:shared.rows,personal:personal.rows,progress:progress.rows,schedules:schedules.rows
  });
  if(apply){
   for(const p of plan.pending){
    if(p.policy_version!==SRS_POLICY_VERSION)throw fail('Sai phiên bản lịch ôn',503);
    const insert=await db.query(
     'INSERT INTO ws_user_srs_schedules '+
     '(user_id,source,word_id,policy_version,last_event_id,last_reviewed_at,'+
     'remembered,review_count,consecutive_remembered,interval_days,due_at) '+
     'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) '+
     'ON CONFLICT (user_id,source,word_id) DO NOTHING RETURNING word_id',
     [userId,p.source,p.word_id,p.policy_version,p.last_event_id,
      iso(p.last_reviewed_at),p.remembered,p.review_count,
      p.consecutive_remembered,p.interval_days,iso(p.due_at)]
    );
    if(insert.rowCount!==1)
     throw fail('Lịch SRS thay đổi khi backfill; rollback cả tài khoản',409);
   }
  }
  return {scope:'account-srs-backfill',mode:apply?'apply':'dry-run',
   historical_words:plan.historical_words,existing:plan.existing,
   ready_to_insert:plan.ready_to_insert,inserted:apply?plan.ready_to_insert:0,
   matched:plan.matched};
 });
}
