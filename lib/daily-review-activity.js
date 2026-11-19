/* UX58 M3: account-bound, read-only daily activity from committed review history.
 * This counts review decisions, NOT objective quiz accuracy or mastery.
 * No mutable streak state or new table. Local date comes from PostgreSQL VN time.
 */
import {transaction} from './db.js';
import {fail} from './game.js';

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const count=(value,label)=>{
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0)throw Error('Số lượt '+label+' không hợp lệ');
 return n;
};
const previousDay=day=>{
 const date=new Date(day+'T00:00:00.000Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)
  throw Error('Ngày hoạt động không hợp lệ');
 date.setUTCDate(date.getUTCDate()-1);
 return date.toISOString().slice(0,10);
};

// A bounded 366-day history avoids unbounded growth. Distinguish the cap
// explicitly rather than suggesting a 366-day streak is exact if it is longer.
export function summarizeDailyReviewActivity({actorId,today,asOf,rows}){
 if(typeof actorId!=='string'||!actorId||!DATE.test(today)||
  !Number.isFinite(Date.parse(asOf))||!Array.isArray(rows)||rows.length>366)
  throw Error('Lịch sử học hôm nay không hợp lệ');
 previousDay(today);
 const seen=new Set(),days=[];
 for(const row of rows){
  const day=String(row.day);
  if(!DATE.test(day)||day>today||seen.has(day))throw Error('Ngày lịch sử bị trùng hoặc trong tương lai');
  previousDay(day);seen.add(day);
  const reviews=count(row.reviews,'ôn tập');
  const uniqueWords=count(row.unique_words,'từ duy nhất');
  if(reviews<1||uniqueWords<1||uniqueWords>reviews)
   throw Error('Lịch sử lượt ôn không nhất quán');
  days.push({day,reviews,unique_words:uniqueWords});
 }
 days.sort((a,b)=>b.day.localeCompare(a.day));
 const todayEntry=days.find(row=>row.day===today);
 const prior=previousDay(today);
 let cursor=todayEntry?today:prior;
 let streak=0;
 for(const day of days){
  if(day.day===cursor){streak++;cursor=previousDay(cursor);}
  else if(day.day<cursor)break;
 }
 return Object.freeze({
  scope:'account-daily-review-activity',actor_id:actorId,
  time_zone:'Asia/Ho_Chi_Minh',as_of:new Date(asOf).toISOString(),day:today,
  reviews_today:todayEntry?.reviews??0,
  unique_words_today:todayEntry?.unique_words??0,
  streak_days:streak,streak_capped:streak>=366,
  streak_ends_on:streak?todayEntry?today:prior:null,
  basis:'confirmed-review-history-not-game-scores',
  // A daily target is NOT considered completed based only on count of events.
  completed_goal:null
 });
}

const DAILY_SQL=`
 WITH e AS (
  SELECT (reviewed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
         'shared'::text AS source,word_id AS id
  FROM ws_learning_flashcard_reviews
  WHERE user_id=$1 AND reviewed_at <= $2::timestamptz
    AND reviewed_at >= (($3::date - 365)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  UNION ALL
  SELECT (reviewed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
         'personal'::text AS source,personal_word_id AS id
  FROM ws_personal_card_reviews
  WHERE user_id=$1 AND reviewed_at <= $2::timestamptz
    AND reviewed_at >= (($3::date - 365)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
 )
 SELECT to_char(day,'YYYY-MM-DD') AS day,
        count(*)::int AS reviews,
        count(DISTINCT (source,id))::int AS unique_words
 FROM e GROUP BY day ORDER BY day DESC LIMIT 366`;

export async function getAccountDailyReviewActivity(userId){
 try{
  return await transaction(async db=>{
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const clock=(await db.query(
    "SELECT transaction_timestamp() AS as_of, "+
    "to_char(transaction_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS today"
   )).rows[0];
   const asOf=new Date(clock.as_of).toISOString();
   const rows=(await db.query(DAILY_SQL,[userId,asOf,clock.today])).rows;
   return summarizeDailyReviewActivity({actorId:userId,today:clock.today,asOf,rows});
  });
 }catch(error){
  if(error?.code==='42P01')throw fail('Chưa có lịch sử ôn từ để thống kê',503);
  throw error;
 }
}
