import {transaction} from './db.js';
import {fail} from './game.js';

// Stable repeatable-read snapshot for all words and progress on one account.
export async function getUnifiedLearningSummary(userId) {
 try {
  return await transaction(async db => {
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const common=await db.query(
    'SELECT w.id,t.title AS topic,w.english,w.ipa,w.meaning,w.example,w.translation,'+
    'p.remembered,p.review_count FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id '+
    'LEFT JOIN ws_learning_word_progress p ON p.word_id=w.id AND p.user_id=$1 '+
    'WHERE w.enabled=true AND t.enabled=true ORDER BY t.title,w.english,w.id LIMIT 5001',[userId]);
   const personal=await db.query(
    'SELECT w.id,w.topic,w.english,w.ipa,w.meaning,w.example,w.translation,'+
    'p.remembered,p.review_count FROM ws_personal_cards w '+
    'LEFT JOIN ws_personal_card_progress p ON p.personal_word_id=w.id AND p.user_id=w.user_id '+
    'WHERE w.user_id=$1 AND w.deleted_at IS NULL ORDER BY w.topic,w.english,w.id LIMIT 5001',[userId]);
   if(common.rows.length>5000||personal.rows.length>5000)
     throw fail('Kho từ vượt giới hạn đồng bộ. Hãy liên hệ quản trị viên.',503);
   const word=(row,source)=>({
    source,id:row.id,topic:row.topic,english:row.english,ipa:row.ipa,
    meaning:row.meaning,example:row.example,translation:row.translation,
    remembered:row.remembered===true,reviewed:row.review_count!==null,
    version:row.review_count??0
   });
   const words=[
    ...common.rows.map(r=>word(r,'shared')),
    ...personal.rows.map(r=>word(r,'personal'))
   ];
   const tally=items=>{
    const total=items.length,known=items.filter(w=>w.remembered===true).length,
      reviewed=items.filter(w=>w.reviewed===true).length;
    return {total,known,review:total-known,reviewed,
      percent:total?Math.round(known*1000/total)/10:0};
   };
   return {scope:'unified-account',actor_id:userId,
     summary:{...tally(words),shared:tally(words.filter(w=>w.source==='shared')),
       personal:tally(words.filter(w=>w.source==='personal'))},words};
  });
 } catch(error) {
  if(error?.code==='42P01')
   throw fail('Database chưa có đủ bảng Learning Progress và Personal Vocabulary để đồng bộ tài khoản.',503);
  throw error;
 }
}
