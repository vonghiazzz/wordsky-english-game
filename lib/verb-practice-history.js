/* UX51: server-calculated V1/V2/V3 attempt history. No SRS writes. */
import {sql} from './db.js';
import {fail} from './game.js';
import {listVerbEntries} from '../public/verb-dictionary.js';
import {isVerbAnswerCorrect} from '../public/verb-practice-core.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dictionary=new Map(listVerbEntries().map(v=>[v.v1,v]));
export function evaluateVerbAttempt(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
  !uuid.test(String(payload.request_id||''))||
  !['full','retry'].includes(payload.mode)||
  !Array.isArray(payload.answers)||payload.answers.length<1||payload.answers.length>10)
  throw fail('Dữ liệu luyện tập không hợp lệ',400);
 if(payload.mode==='full'&&payload.answers.length!==10)
  throw fail('Lượt luyện đầy đủ phải có 10 câu',400);
 const visited=new Set();
 const answers=payload.answers.map((input,i)=>{
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.v1!=='string'||
    !['v1','v2','v3'].includes(input.target)||typeof input.given!=='string'||
    input.given.length>80)throw fail('Câu trả lời không hợp lệ',400);
  const v=dictionary.get(input.v1),key=input.v1+':'+input.target;
  if(!v||visited.has(key))throw fail('Động từ trùng hoặc không tồn tại',400);
  visited.add(key);
  const given=input.given.trim();
  const correct=isVerbAnswerCorrect(given,v[input.target]);
  return {index:i+1,v1:v.v1,target:input.target,given,correct};
 });
 return {mode:payload.mode,answers,total:answers.length,correct:answers.filter(a=>a.correct).length};
}
export async function saveVerbAttempt(userId,payload,query=sql){
 const evaluated=evaluateVerbAttempt(payload);
 const requestId=payload.request_id.toLowerCase();
 const data=JSON.stringify(evaluated.answers);
 const added=await query(
  `INSERT INTO public.ws_verb_practice_runs(user_id,request_id,mode,total,correct,answers)
   VALUES($1,$2,$3,$4,$5,$6::jsonb)
   ON CONFLICT(user_id,request_id) DO NOTHING
   RETURNING request_id,mode,total,correct,completed_at`,
  [userId,requestId,evaluated.mode,evaluated.total,evaluated.correct,data]);
 if(added.rows.length)
  return {scope:'account-verb-practice',replayed:false,...added.rows[0]};
 const previous=await query(
  'SELECT request_id,mode,total,correct,answers,completed_at FROM public.ws_verb_practice_runs WHERE user_id=$1 AND request_id=$2',
  [userId,requestId]);
 const r=previous.rows[0];
 if(!r||r.mode!==evaluated.mode||r.total!==evaluated.total||r.correct!==evaluated.correct||
  JSON.stringify(r.answers.map(a=>[a.index,a.v1,a.target,a.given,a.correct]))!==
  JSON.stringify(evaluated.answers.map(a=>[a.index,a.v1,a.target,a.given,a.correct])))
  throw fail('Mã lượt luyện đã được sử dụng cho dữ liệu khác',409);
 return {scope:'account-verb-practice',replayed:true,request_id:r.request_id,
  mode:r.mode,total:r.total,correct:r.correct,completed_at:r.completed_at};
}
export async function getVerbPracticeHistory(userId,query=sql){
 const [stats,recent,weak]=await Promise.all([
  query(`SELECT count(*)::int AS runs,coalesce(sum(total),0)::int AS questions,
    coalesce(sum(correct),0)::int AS correct FROM public.ws_verb_practice_runs WHERE user_id=$1`,[userId]),
  query(`SELECT request_id,mode,total,correct,completed_at
    FROM public.ws_verb_practice_runs WHERE user_id=$1
    ORDER BY completed_at DESC,request_id DESC LIMIT 20`,[userId]),
  query(`SELECT item->>'v1' AS v1,item->>'target' AS form,count(*)::int AS mistakes
    FROM public.ws_verb_practice_runs r
    CROSS JOIN LATERAL jsonb_array_elements(r.answers) AS item
    WHERE r.user_id=$1 AND item->>'correct'='false'
    GROUP BY 1,2 ORDER BY mistakes DESC,v1,form LIMIT 5`,[userId])
 ]);
 return {scope:'account-verb-practice',summary:stats.rows[0],recent:recent.rows,weak_forms:weak.rows};
}
