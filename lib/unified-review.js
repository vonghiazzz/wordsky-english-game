import {transaction} from './db.js';
import {fail} from './game.js';

const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function validateUnifiedReview(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !uuid.test(input.request_id)||!uuid.test(input.word_id)||
  !['shared','personal'].includes(input.source)||typeof input.remembered!=='boolean'||
  (input.expected_review_count!==undefined&&(!Number.isSafeInteger(input.expected_review_count)||input.expected_review_count<0)))
  throw fail('Yêu cầu ghi kết quả ôn từ không hợp lệ',400);
 return {
  request_id:input.request_id.toLowerCase(),
  word_id:input.word_id.toLowerCase(),
  source:input.source,remembered:input.remembered,
  expected_review_count:input.expected_review_count??null
 };
}

// Exactly one committed event for one (user, request_id), even under
// concurrent requests, retries, or a lost HTTP response.
export async function recordUnifiedReview(userId,payload){
 const request=validateUnifiedReview(payload);
 try {
  return await transaction(async db=>{
   // Serialize distinct commands for the same account. This lock also
   // protects the zero-review state (no progress row exists to lock yet).
   const actor=await db.query('SELECT id FROM ws_users WHERE id=$1 FOR UPDATE',[userId]);
   if(!actor.rows.length)throw fail('Tài khoản không còn tồn tại',401);
   // PostgreSQL unique conflict waits for the first transaction to commit.
   // If it rolls back, a retry can claim the same idempotency key.
   const claim=await db.query(
    'INSERT INTO ws_learning_review_requests(user_id,request_id,source,word_id,remembered) '+
    'VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,request_id) DO NOTHING '+
    'RETURNING reviewed_at',
    [userId,request.request_id,request.source,request.word_id,request.remembered]
   );
   if(!claim.rows.length){
    const old=await db.query(
     'SELECT source,word_id,remembered,reviewed_at FROM ws_learning_review_requests '+
     'WHERE user_id=$1 AND request_id=$2',
     [userId,request.request_id]
    );
    const saved=old.rows[0];
    if(!saved)throw fail('Không xác minh được yêu cầu ôn từ đã gửi',503);
    if(saved.source!==request.source||saved.word_id!==request.word_id||
       saved.remembered!==request.remembered)
      throw fail('request_id đã được dùng cho một thao tác học khác',409);
    return {scope:'account-review',source:request.source,word_id:request.word_id,
      request_id:request.request_id,remembered:request.remembered,
      reviewed_at:saved.reviewed_at,replayed:true};
   }
   // Optimistic check against the state the device actually observed.
   // A stale command is rejected before it can append review history.
   if(request.expected_review_count!==null){
    const table=request.source==='shared'?'ws_learning_word_progress':'ws_personal_card_progress';
    const key=request.source==='shared'?'word_id':'personal_word_id';
    const current=await db.query(
     'SELECT review_count FROM '+table+' WHERE user_id=$1 AND '+key+'=$2',
     [userId,request.word_id]);
    const count=current.rows[0]?.review_count??0;
    if(count!==request.expected_review_count)
      throw fail('Tiến độ từ đã được cập nhật trên thiết bị khác. Tải lại trước khi lưu.',409);
   }
   if(request.source==='shared'){
    const found=await db.query(
     'SELECT w.id FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id '+
     'WHERE w.id=$1 AND w.enabled=true AND t.enabled=true',[request.word_id]);
    if(!found.rows.length)throw fail('Từ chung không tồn tại hoặc đã bị ẩn',404);
    await db.query(
     'INSERT INTO ws_learning_flashcard_reviews(user_id,word_id,remembered,reviewed_at) '+
     'VALUES($1,$2,$3,$4)',
     [userId,request.word_id,request.remembered,claim.rows[0].reviewed_at]
    );
    await db.query(
     'INSERT INTO ws_learning_word_progress(user_id,word_id,remembered,review_count,last_reviewed_at) '+
     'VALUES($1,$2,$3,1,$4) ON CONFLICT(user_id,word_id) DO UPDATE SET '+
     'remembered=EXCLUDED.remembered,'+
     'review_count=ws_learning_word_progress.review_count+1,'+
     'last_reviewed_at=EXCLUDED.last_reviewed_at',
     [userId,request.word_id,request.remembered,claim.rows[0].reviewed_at]
    );
   }else{
    const found=await db.query(
     'SELECT id FROM ws_personal_cards WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
     [request.word_id,userId]
    );
    if(!found.rows.length)throw fail('Không tìm thấy thẻ cá nhân thuộc tài khoản',404);
    await db.query(
     'INSERT INTO ws_personal_card_reviews(user_id,personal_word_id,remembered,reviewed_at) '+
     'VALUES($1,$2,$3,$4)',
     [userId,request.word_id,request.remembered,claim.rows[0].reviewed_at]
    );
    await db.query(
     'INSERT INTO ws_personal_card_progress(user_id,personal_word_id,remembered,review_count,last_reviewed_at) '+
     'VALUES($1,$2,$3,1,$4) ON CONFLICT(user_id,personal_word_id) DO UPDATE SET '+
     'remembered=EXCLUDED.remembered,'+
     'review_count=ws_personal_card_progress.review_count+1,'+
     'last_reviewed_at=EXCLUDED.last_reviewed_at',
     [userId,request.word_id,request.remembered,claim.rows[0].reviewed_at]
    );
   }
   return {scope:'account-review',source:request.source,word_id:request.word_id,
     request_id:request.request_id,remembered:request.remembered,
     reviewed_at:claim.rows[0].reviewed_at,replayed:false};
  });
 }catch(error){
  if(error?.code==='42P01')
   throw fail('Database chưa có migration UX-23 Learning Review Requests',503);
  throw error;
 }
}
