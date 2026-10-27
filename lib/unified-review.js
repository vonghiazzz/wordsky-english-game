import {transaction} from './db.js';
import {fail} from './game.js';

const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function validateUnifiedReview(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !uuid.test(input.request_id)||!uuid.test(input.word_id)||
  !['shared','personal'].includes(input.source)||typeof input.remembered!=='boolean')
  throw fail('Yêu cầu ghi kết quả ôn từ không hợp lệ',400);
 return {
  request_id:input.request_id.toLowerCase(),
  word_id:input.word_id.toLowerCase(),
  source:input.source,remembered:input.remembered
 };
}

// Exactly one committed event for one (user, request_id), even under
// concurrent requests, retries, or a lost HTTP response.
export async function recordUnifiedReview(userId,payload){
 const request=validateUnifiedReview(payload);
 try {
  return await transaction(async db=>{
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
