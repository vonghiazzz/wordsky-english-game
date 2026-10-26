import {sql,transaction} from './db.js';
import {fail} from './game.js';

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function normalizePersonalCard(payload) {
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw fail('Dữ liệu thẻ không hợp lệ',400);
 const card={};
 for(const [name,min,max] of [['topic',1,80],['english',1,80],['ipa',0,120],['meaning',1,180],['example',0,500],['translation',0,500]]){
  const value=payload[name]??'';
  if(typeof value!=='string'||value.trim().length<min||value.length>max)throw fail('Trường '+name+' không hợp lệ',400);
  card[name]=value.trim();
 }
 return card;
}
export async function listPersonalVocabulary(userId) {
 const [cards,progress]=await Promise.all([
  sql('SELECT id,topic,english,ipa,meaning,example,translation,revision,updated_at FROM ws_personal_cards WHERE user_id=$1 AND deleted_at IS NULL ORDER BY topic,english,id LIMIT 5001',[userId]),
  sql('SELECT personal_word_id,remembered,review_count,last_reviewed_at FROM ws_personal_card_progress WHERE user_id=$1',[userId])
 ]);
 if(cards.rows.length>5000)throw fail('Kho từ cá nhân vượt giới hạn',503);
 return {scope:'personal-account',words:cards.rows,progress:progress.rows};
}
export async function addPersonalCard(userId,payload) {
 const c=normalizePersonalCard(payload);
 return transaction(async db=>{
  const n=await db.query('SELECT count(*)::int AS total FROM ws_personal_cards WHERE user_id=$1 AND deleted_at IS NULL',[userId]);
  if(n.rows[0].total>=5000)throw fail('Đã đạt giới hạn 5000 thẻ',409);
  try{
   const r=await db.query('INSERT INTO ws_personal_cards(user_id,topic,english,ipa,meaning,example,translation) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,topic,english,ipa,meaning,example,translation,revision,updated_at',[userId,c.topic,c.english,c.ipa,c.meaning,c.example,c.translation]);
   return r.rows[0];
  }catch(e){if(e.code==='23505')throw fail('Từ đã có trong chủ đề cá nhân',409);throw e}
 });
}
export async function markPersonalCard(userId,body) {
 if(!uuid.test(body?.personal_word_id)||typeof body.remembered!=='boolean')throw fail('Đánh giá không hợp lệ',400);
 return transaction(async db=>{
  const found=await db.query('SELECT id FROM ws_personal_cards WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',[body.personal_word_id,userId]);
  if(!found.rows.length)throw fail('Không tìm thấy thẻ cá nhân',404);
  const log=await db.query('INSERT INTO ws_personal_card_reviews(user_id,personal_word_id,remembered) VALUES($1,$2,$3) RETURNING reviewed_at',[userId,body.personal_word_id,body.remembered]);
  await db.query('INSERT INTO ws_personal_card_progress(user_id,personal_word_id,remembered,last_reviewed_at) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,personal_word_id) DO UPDATE SET remembered=EXCLUDED.remembered,review_count=ws_personal_card_progress.review_count+1,last_reviewed_at=EXCLUDED.last_reviewed_at',[userId,body.personal_word_id,body.remembered,log.rows[0].reviewed_at]);
  return {scope:'personal-account',personal_word_id:body.personal_word_id,remembered:body.remembered};
 });
}

export async function updatePersonalCard(userId,wordId,payload) {
 if(!uuid.test(wordId)||!Number.isInteger(payload?.revision)||payload.revision<1)throw fail('Phiên bản thẻ không hợp lệ',400);
 const card=normalizePersonalCard(payload);
 try{
  const {rows}=await sql('UPDATE ws_personal_cards SET topic=$3,english=$4,ipa=$5,meaning=$6,example=$7,translation=$8,revision=revision+1,updated_at=now() WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL AND revision=$9 RETURNING id,topic,english,ipa,meaning,example,translation,revision,updated_at',
   [userId,wordId,card.topic,card.english,card.ipa,card.meaning,card.example,card.translation,payload.revision]);
  if(!rows.length)throw fail('Thẻ đã thay đổi hoặc không tồn tại; tải lại trước khi sửa',409);
  return rows[0];
 }catch(e){if(e.code==='23505')throw fail('Từ đã có trong chủ đề cá nhân',409);throw e}
}
export async function deletePersonalCard(userId,wordId,revision) {
 if(!uuid.test(wordId)||!Number.isInteger(revision)||revision<1)throw fail('Thông tin xóa thẻ không hợp lệ',400);
 const {rows}=await sql('UPDATE ws_personal_cards SET deleted_at=now(),revision=revision+1,updated_at=now() WHERE user_id=$1 AND id=$2 AND revision=$3 AND deleted_at IS NULL RETURNING id',[userId,wordId,revision]);
 if(!rows.length)throw fail('Thẻ đã thay đổi hoặc không tồn tại; tải lại trước khi xóa',409);
 return {ok:true,id:rows[0].id};
}
