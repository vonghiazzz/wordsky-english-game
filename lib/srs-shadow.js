import {rebuildSrsProjection,SRS_POLICY_VERSION} from './srs-projection.js';
import {fail} from './game.js';

// UX-24B opt-in shadow write, scoped to the isolated Preview environment.
// Production remains history-derived. Never enable without the additive
// schedule migration, full legacy-writer review, and separate release approval.
export function srsShadowEnabled(env=process.env){
 return env.VERCEL_ENV!=='production'&&env.WORDSKY_SRS_SHADOW_ENABLED==='true';
}

// Called inside the existing UX-23 DB transaction, only AFTER both review
// history and progress have been written, and NEVER for a replay or a 409.
// Full-history reconstruction is intentional: it includes legacy events
// written before shadow migration and cannot invent a success streak.
export async function writeSrsShadowSchedule(db,{userId,source,wordId}){
 if(!['shared','personal'].includes(source))throw fail('Nguồn SRS không hợp lệ',400);
 const historyTable=source==='shared'?'ws_learning_flashcard_reviews':'ws_personal_card_reviews';
 const progressTable=source==='shared'?'ws_learning_word_progress':'ws_personal_card_progress';
 const key=source==='shared'?'word_id':'personal_word_id';
 const history=await db.query(
  'SELECT id,remembered,reviewed_at FROM '+historyTable+
  ' WHERE user_id=$1 AND '+key+'=$2 ORDER BY reviewed_at,id',
  [userId,wordId]);
 const projection=rebuildSrsProjection(history.rows);
 if(!projection)throw fail('Không tìm thấy lịch sử ôn đã ghi',503);
 const current=await db.query(
  'SELECT review_count FROM '+progressTable+
  ' WHERE user_id=$1 AND '+key+'=$2',[userId,wordId]);
 if(current.rows[0]?.review_count!==projection.review_count)
  throw fail('Lịch sử và tiến độ ôn không đồng nhất; dừng cập nhật SRS',503);
 if(projection.policy_version!==SRS_POLICY_VERSION)
  throw fail('Phiên bản thuật toán SRS không tương thích',503);
 const p=projection;
 const updated=await db.query(
  'INSERT INTO ws_user_srs_schedules '+
  '(user_id,source,word_id,policy_version,last_event_id,last_reviewed_at,'+
  'remembered,review_count,consecutive_remembered,interval_days,due_at) '+
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) '+
  'ON CONFLICT(user_id,source,word_id) DO UPDATE SET '+
  'last_event_id=EXCLUDED.last_event_id,last_reviewed_at=EXCLUDED.last_reviewed_at,'+
  'remembered=EXCLUDED.remembered,review_count=EXCLUDED.review_count,'+
  'consecutive_remembered=EXCLUDED.consecutive_remembered,'+
  'interval_days=EXCLUDED.interval_days,due_at=EXCLUDED.due_at,'+
  'updated_at=clock_timestamp() '+
  'WHERE ws_user_srs_schedules.policy_version=EXCLUDED.policy_version '+
  'AND ws_user_srs_schedules.review_count<=EXCLUDED.review_count '+
  'RETURNING review_count',
  [userId,source,wordId,p.policy_version,p.last_event_id,p.last_reviewed_at,
   p.remembered,p.review_count,p.consecutive_remembered,p.interval_days,p.due_at]
 );
 if(updated.rowCount!==1)
  throw fail('Lịch ôn đã thay đổi hoặc không tương thích; rollback lượt ôn',409);
 return p;
}
