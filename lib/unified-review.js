import {transaction} from './db.js';
import {fail} from './game.js';

const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function validateUnifiedReview(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  !uuid.test(input.request_id)||!uuid.test(input.word_id)||
  !['shared','personal'].includes(input.source)||typeof input.remembered!=='boolean'||
  !Number.isSafeInteger(input.expected_version)||input.expected_version<0)
  throw fail('Yêu cầu ghi kết quả ôn từ không hợp lệ',400);
 return {
  request_id:input.request_id.toLowerCase(),
  word_id:input.word_id.toLowerCase(),
  source:input.source,remembered:input.remembered,
  expected_version:input.expected_version
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
    'INSERT INTO ws_learning_review_requests(user_id,request_id,source,word_id,remembered,expected_version) '+
    'VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,request_id) DO NOTHING '+
    'RETURNING reviewed_at',
    [userId,request.request_id,request.source,request.word_id,request.remembered,request.expected_version]
   );
   if(!claim.rows.length){
    const old=await db.query(
     'SELECT source,word_id,remembered,reviewed_at,expected_version,result_version FROM ws_learning_review_requests '+
     'WHERE user_id=$1 AND request_id=$2',
     [userId,request.request_id]
    );
    const saved=old.rows[0];
    if(!saved)throw fail('Không xác minh được yêu cầu ôn từ đã gửi',503);
    if(saved.source!==request.source||saved.word_id!==request.word_id||
       saved.remembered!==request.remembered||saved.expected_version!==request.expected_version)
      throw fail('request_id đã được dùng cho một thao tác học khác',409);
    return {scope:'account-review',source:request.source,word_id:request.word_id,
      request_id:request.request_id,remembered:request.remembered,
      reviewed_at:saved.reviewed_at,version:saved.result_version,replayed:true};
   }
   const shared=request.source==='shared';
   const progressTable=shared?'ws_learning_word_progress':'ws_personal_card_progress';
   const reviewTable=shared?'ws_learning_flashcard_reviews':'ws_personal_card_reviews';
   const wordColumn=shared?'word_id':'personal_word_id';
   if(shared){
    const found=await db.query(
     'SELECT w.id FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id '+
     'WHERE w.id=$1 AND w.enabled=true AND t.enabled=true',[request.word_id]);
    if(!found.rows.length)throw fail('Từ chung không tồn tại hoặc đã bị ẩn',404);
   }else{
    const found=await db.query(
     'SELECT id FROM ws_personal_cards WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
     [request.word_id,userId]);
    if(!found.rows.length)throw fail('Không tìm thấy thẻ cá nhân thuộc tài khoản',404);
   }
   // Lock an existing progress row. For a previously unseen word, the CAS
   // upsert below also rejects a simultaneous first write with version 0.
   const current=await db.query(
    'SELECT review_count FROM '+progressTable+
    ' WHERE user_id=$1 AND '+wordColumn+'=$2 FOR UPDATE',
    [userId,request.word_id]);
   const actual=current.rows.length?current.rows[0].review_count:0;
   if(actual!==request.expected_version)
    throw fail('Tiến độ từ đã thay đổi trên thiết bị khác. Tải lại trước khi lưu.',409);
   const savedProgress=await db.query(
    'INSERT INTO '+progressTable+'(user_id,'+wordColumn+
    ',remembered,review_count,last_reviewed_at) VALUES($1,$2,$3,1,$4) '+
    'ON CONFLICT(user_id,'+wordColumn+') DO UPDATE SET '+
    'remembered=EXCLUDED.remembered,review_count='+progressTable+'.review_count+1,'+
    'last_reviewed_at=EXCLUDED.last_reviewed_at '+
    'WHERE '+progressTable+'.review_count=$5 RETURNING review_count',
    [userId,request.word_id,request.remembered,claim.rows[0].reviewed_at,request.expected_version]
   );
   if(savedProgress.rows.length!==1)
    throw fail('Tiến độ vừa được cập nhật ở thiết bị khác. Tải lại trước khi lưu.',409);
   const version=savedProgress.rows[0].review_count;
   await db.query(
    'INSERT INTO '+reviewTable+'(user_id,'+wordColumn+',remembered,reviewed_at) '+
    'VALUES($1,$2,$3,$4)',
    [userId,request.word_id,request.remembered,claim.rows[0].reviewed_at]
   );
   await db.query(
    'UPDATE ws_learning_review_requests SET result_version=$3 '+
    'WHERE user_id=$1 AND request_id=$2',
    [userId,request.request_id,version]
   );
   return {scope:'account-review',source:request.source,word_id:request.word_id,
     request_id:request.request_id,remembered:request.remembered,
     reviewed_at:claim.rows[0].reviewed_at,version,replayed:false};
  });
 }catch(error){
  if(['42P01','42703'].includes(error?.code))
   throw fail('Database chưa có migration UX-23 Learning Review Requests',503);
  throw error;
 }
}
