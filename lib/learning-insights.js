/* UX29: READ-ONLY account learning insights.
 * Each query binds the server-authenticated actor; no client actor query.
 * Review-event true/false are learner decisions, NOT objective quiz accuracy.
 */
import {transaction} from './db.js';
import {fail} from './game.js';

export const INSIGHTS_ZONE='Asia/Ho_Chi_Minh';
export const INSIGHTS_WINDOWS=Object.freeze([7,30]);

export function parseInsightsWindow(query={}){
 const input=query?.days;
 if(input===undefined)return 7;
 if(typeof input!=='string'||!['7','30'].includes(input))
  throw fail('Chỉ hỗ trợ thống kê 7 hoặc 30 ngày',400);
 return Number(input);
}

const DAILY_SQL="\nWITH review_events AS (\n SELECT (reviewed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, remembered\n FROM ws_learning_flashcard_reviews\n WHERE user_id=$1 AND reviewed_at >= (($2::date - ($3::int - 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at <= $4::timestamptz\n UNION ALL\n SELECT (reviewed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, remembered\n FROM ws_personal_card_reviews\n WHERE user_id=$1 AND reviewed_at >= (($2::date - ($3::int - 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at <= $4::timestamptz\n),\ndaily_reviews AS (\n SELECT day,count(*)::int AS reviews,\n        count(*) FILTER (WHERE remembered)::int AS marked_remembered,\n        count(*) FILTER (WHERE NOT remembered)::int AS marked_need_review\n FROM review_events GROUP BY day\n),\ndaily_solo AS (\n SELECT (finished_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,\n        count(*)::int AS solo_runs\n FROM ws_solo_runs\n WHERE user_id=$1 AND status IN ('COMPLETED','FAILED','TIMEOUT')\n   AND finished_at IS NOT NULL AND finished_at >= (($2::date - ($3::int - 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND finished_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND finished_at <= $4::timestamptz\n GROUP BY 1\n)\nSELECT to_char(d.day,'YYYY-MM-DD') AS day,\n       coalesce(r.reviews,0)::int AS reviews,\n       coalesce(r.marked_remembered,0)::int AS marked_remembered,\n       coalesce(r.marked_need_review,0)::int AS marked_need_review,\n       coalesce(s.solo_runs,0)::int AS solo_runs\nFROM generate_series(($2::date-($3::int-1))::timestamp,\n                     $2::date::timestamp,interval '1 day') AS d(day)\nLEFT JOIN daily_reviews r ON r.day=d.day\nLEFT JOIN daily_solo s ON s.day=d.day\nORDER BY d.day";
const CURRENT_SQL="\nSELECT coalesce(sum(current_known),0)::int AS current_known,\n       coalesce(sum(current_need_review),0)::int AS current_need_review\nFROM (\n SELECT count(*) FILTER (WHERE p.remembered)::int AS current_known,\n        count(*) FILTER (WHERE NOT p.remembered)::int AS current_need_review\n FROM ws_learning_word_progress p\n JOIN ws_words w ON w.id=p.word_id AND w.enabled=true\n JOIN ws_topics t ON t.id=w.topic_id AND t.enabled=true\n WHERE p.user_id=$1\n UNION ALL\n SELECT count(*) FILTER (WHERE p.remembered)::int AS current_known,\n        count(*) FILTER (WHERE NOT p.remembered)::int AS current_need_review\n FROM ws_personal_card_progress p\n JOIN ws_personal_cards w ON w.id=p.personal_word_id\n   AND w.user_id=p.user_id AND w.deleted_at IS NULL\n WHERE p.user_id=$1\n) status";
const FOCUS_SQL="\nWITH events AS (\n SELECT 'shared'::text AS source,word_id,remembered,reviewed_at\n FROM ws_learning_flashcard_reviews\n WHERE user_id=$1 AND reviewed_at >= (($2::date - ($3::int - 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at <= $4::timestamptz\n UNION ALL\n SELECT 'personal'::text AS source,personal_word_id AS word_id,remembered,reviewed_at\n FROM ws_personal_card_reviews\n WHERE user_id=$1 AND reviewed_at >= (($2::date - ($3::int - 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND reviewed_at <= $4::timestamptz\n),\nranked AS (\n SELECT source,word_id,\n        count(*) FILTER (WHERE NOT remembered)::int AS need_review_marks,\n        count(*)::int AS review_events,\n        max(reviewed_at) AS last_reviewed_at\n FROM events GROUP BY source,word_id\n)\nSELECT ranked.source, ranked.word_id::text AS word_id,\n       coalesce(w.english,pc.english) AS english,\n       coalesce(w.meaning,pc.meaning) AS meaning,\n       coalesce(t.title,pc.topic) AS topic,\n       ranked.need_review_marks,ranked.review_events,\n       ranked.last_reviewed_at\nFROM ranked\nLEFT JOIN ws_words w ON ranked.source='shared'\n  AND ranked.word_id=w.id AND w.enabled=true\nLEFT JOIN ws_topics t ON t.id=w.topic_id AND t.enabled=true\nLEFT JOIN ws_learning_word_progress wp\n  ON ranked.source='shared' AND wp.user_id=$1 AND wp.word_id=ranked.word_id\nLEFT JOIN ws_personal_cards pc ON ranked.source='personal'\n  AND pc.id=ranked.word_id AND pc.user_id=$1 AND pc.deleted_at IS NULL\nLEFT JOIN ws_personal_card_progress pp\n  ON ranked.source='personal' AND pp.user_id=$1 AND pp.personal_word_id=ranked.word_id\nWHERE ranked.need_review_marks>0\n  AND ((ranked.source='shared' AND t.id IS NOT NULL AND wp.remembered IS FALSE)\n    OR (ranked.source='personal' AND pc.id IS NOT NULL AND pp.remembered IS FALSE))\nORDER BY ranked.need_review_marks DESC,ranked.last_reviewed_at DESC,\n         ranked.source,ranked.word_id\nLIMIT 8";
const SOLO_SQL="\nSELECT mode,count(*)::int AS runs\nFROM ws_solo_runs\nWHERE user_id=$1 AND status IN ('COMPLETED','FAILED','TIMEOUT')\n AND finished_at IS NOT NULL AND finished_at >= (($2::date - ($3::int - 1))::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND finished_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND finished_at <= $4::timestamptz\n AND mode IN ('MATCH','BOMB','CAR')\nGROUP BY mode ORDER BY mode";

const number=value=>{
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0)throw Error('Số liệu hoạt động không hợp lệ');
 return n;
};

// Pure report formatting: the same point-in-time server snapshot on every device.
export function summarizeLearningInsights({actorId,days,asOf,today,daily,current,focus,solo}){
 if(typeof actorId!=='string'||!INSIGHTS_WINDOWS.includes(days)||
    !/^\d{4}-\d{2}-\d{2}$/.test(today)||!Number.isFinite(Date.parse(asOf))||
    !Array.isArray(daily)||daily.length!==days||!Array.isArray(focus)||
    !Array.isArray(solo))
  throw Error('Báo cáo học tập không hợp lệ');
 const dailyRows=daily.map(row=>({
  day:String(row.day),
  reviews:number(row.reviews),
  marked_remembered:number(row.marked_remembered),
  marked_need_review:number(row.marked_need_review),
  solo_runs:number(row.solo_runs)
 }));
 if(dailyRows.some(row=>!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||
    row.marked_remembered+row.marked_need_review!==row.reviews))
  throw Error('Dữ liệu lịch sử học không nhất quán');
 for(let i=1;i<dailyRows.length;i++){
  const prev=Date.parse(dailyRows[i-1].day+'T00:00:00Z');
  const next=Date.parse(dailyRows[i].day+'T00:00:00Z');
  if(next-prev!==86400000)throw Error('Trục ngày bị thiếu hoặc trùng');
 }
 if(dailyRows.at(-1).day!==today)
  throw Error('Báo cáo không khớp ngày Việt Nam');
 const total=field=>dailyRows.reduce((n,row)=>n+row[field],0);
 const reviews=total('reviews'),markedRemembered=total('marked_remembered');
 const modeCounts={MATCH:0,BOMB:0,CAR:0};
 for(const mode of solo){
  if(!Object.hasOwn(modeCounts,mode.mode))throw Error('Chế độ Solo không hợp lệ');
  modeCounts[mode.mode]=number(mode.runs);
 }
 if(Object.values(modeCounts).reduce((a,b)=>a+b,0)!==total('solo_runs'))
  throw Error('Báo cáo Solo không nhất quán');
 return {
  scope:'account-learning-insights',actor_id:actorId,
  days,time_zone:INSIGHTS_ZONE,as_of:new Date(asOf).toISOString(),
  period:{from:dailyRows[0].day,to:today},
  summary:{
   reviews,marked_remembered:markedRemembered,
   marked_need_review:total('marked_need_review'),
   remembered_mark_rate:reviews?Math.round(markedRemembered*1000/reviews)/10:null,
   active_days:dailyRows.filter(row=>row.reviews>0||row.solo_runs>0).length,
   solo_runs:total('solo_runs'),
   current_known:number(current.current_known),
   current_need_review:number(current.current_need_review)
  },
  daily:dailyRows,
  solo_modes:['MATCH','BOMB','CAR'].map(mode=>({mode,runs:modeCounts[mode]})),
  focus_words:focus.map(row=>({
   source:row.source,word_id:row.word_id,english:row.english,
   meaning:row.meaning,topic:row.topic,
   need_review_marks:number(row.need_review_marks),
   review_events:number(row.review_events),
   last_reviewed_at:new Date(row.last_reviewed_at).toISOString()
  }))
 };
}

export async function getAccountLearningInsights(userId,query={}){
 const days=parseInsightsWindow(query);
 try {
  return await transaction(async db=>{
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const clock=(await db.query(
    "SELECT transaction_timestamp() AS as_of, "+
    "to_char(transaction_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS today"
   )).rows[0];
   const asOf=new Date(clock.as_of).toISOString();
   const params=[userId,clock.today,days,asOf];
   const daily=(await db.query(DAILY_SQL,params)).rows;
   const current=(await db.query(CURRENT_SQL,[userId])).rows[0];
   const focus=(await db.query(FOCUS_SQL,params)).rows;
   const solo=(await db.query(SOLO_SQL,params)).rows;
   return summarizeLearningInsights({actorId:userId,days,asOf,today:clock.today,
    daily,current,focus,solo});
  });
 }catch(error){
  if(error?.code==='42P01')
   throw fail('Database chưa có các bảng lịch sử học tập cần thiết',503);
  throw error;
 }
}
