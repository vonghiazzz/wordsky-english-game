import {transaction} from './db.js';
import {fail} from './game.js';
import {buildSrsQueue} from './srs-schedule.js';

// Feature-gated, account-scoped READ ONLY UX-24 API. No materialized schedule
// and no writes to browser storage or PostgreSQL.
export function parseSrsQueueQuery(query={}){
 const value=(key,fallback)=>{
  const x=query?.[key];
  if(x===undefined)return fallback;
  if(typeof x!=='string'||!/^\d{1,5}$/.test(x))throw fail('Trang hoặc số lượng từ không hợp lệ',400);
  return Number(x);
 };
 const status=query?.status??'due';
 if(!['due','upcoming','new'].includes(status))
  throw fail('Bộ lọc lịch ôn không hợp lệ',400);
 const page=value('page',0),size=value('size',20);
 if(size<1||size>100||page>10000)throw fail('Trang hoặc số lượng từ không hợp lệ',400);
 return {status,page,size};
}

const MAX_WORDS_PER_SOURCE=5000;
const MAX_HISTORY_PER_SOURCE=50000;

export async function getAccountSrsQueue(userId,input={}){
 const {status,page,size}=parseSrsQueueQuery(input);
 const topic=input?.topic??'';
 if(typeof topic!=='string'||topic.length>80||/[\\u0000-\\u001f]/.test(topic))
  throw fail('Bộ lọc chủ đề không hợp lệ',400);
 try{
  return await transaction(async db=>{
   // Use the SAME point-in-time snapshot for cards, history and as_of.
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const clock=await db.query('SELECT transaction_timestamp() AS as_of');
   const asOf=clock.rows[0].as_of;
   const shared=await db.query(
    'SELECT w.id,w.english,t.title AS topic,w.meaning,w.ipa,w.example,w.translation '+
    'FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id '+
    'WHERE w.enabled=true AND t.enabled=true '+
    'ORDER BY t.title,w.english,w.id LIMIT 5001');
   const personal=await db.query(
    'SELECT id,english,topic,meaning,ipa,example,translation '+
    'FROM ws_personal_cards WHERE user_id=$1 AND deleted_at IS NULL '+
    'ORDER BY topic,english,id LIMIT 5001',[userId]);
   if(shared.rows.length>MAX_WORDS_PER_SOURCE||personal.rows.length>MAX_WORDS_PER_SOURCE)
    throw fail('Kho từ vượt giới hạn lịch ôn an toàn',503);
   const commonHistory=await db.query(
    'SELECT id,word_id,remembered,reviewed_at FROM ws_learning_flashcard_reviews '+
    'WHERE user_id=$1 ORDER BY reviewed_at,id LIMIT 50001',[userId]);
   const personalHistory=await db.query(
    'SELECT id,personal_word_id,remembered,reviewed_at FROM ws_personal_card_reviews '+
    'WHERE user_id=$1 ORDER BY reviewed_at,id LIMIT 50001',[userId]);
   if(commonHistory.rows.length>MAX_HISTORY_PER_SOURCE||
      personalHistory.rows.length>MAX_HISTORY_PER_SOURCE)
    throw fail('Lịch sử ôn quá lớn cho phiên bản thử nghiệm',503);

   const historyByWord=new Map();
   for(const [source,rows,key] of [
    ['shared',commonHistory.rows,'word_id'],
    ['personal',personalHistory.rows,'personal_word_id']
   ]){
    for(const event of rows){
     const mapKey=source+':'+event[key];
     if(!historyByWord.has(mapKey))historyByWord.set(mapKey,[]);
     historyByWord.get(mapKey).push({
      id:event.id,remembered:event.remembered,reviewed_at:event.reviewed_at
     });
    }
   }
   const cards=[
    ...shared.rows.map(card=>({...card,source:'shared'})),
    ...personal.rows.map(card=>({...card,source:'personal'}))
   ];
   const queue=buildSrsQueue(cards,historyByWord,{now:asOf});
   const rows=topic?queue[status].filter(card=>card.topic===topic):queue[status];
   const topics=[...new Set(cards.map(card=>card.topic))].sort((a,b)=>a.localeCompare(b));
   const start=page*size;
   return {scope:'account-srs',actor_id:userId,
    policy:'ux24-fixed-interval-prototype',as_of:new Date(asOf).toISOString(),
    status,topic,topics,page,size,total:rows.length,total_pages:Math.ceil(rows.length/size),
    summary:queue.summary,words:rows.slice(start,start+size)};
  });
 }catch(error){
  if(error?.code==='42P01')
   throw fail('Database chưa có lịch sử ôn từ để tạo lịch SRS',503);
  throw error;
 }
}
