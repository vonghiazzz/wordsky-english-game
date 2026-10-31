/*
 * UX43C isolated Preview/local-only typed recall challenge service.
 * Does not import SRS, player progress, XP or game scoring.
 * All writes are authorized from server-signed versioned player sessions.
 */
import {randomUUID} from 'node:crypto';
import {sql,transaction} from './db.js';
import {fail} from './game.js';
import {normalizeTypedEnglish,prepareTypedRecallTrial,gradeTypedRecallTrial,RECALL_CONSENT} from './ux43b-recall-evidence.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TRIALS_PER_DAY=25;

export function recallPilotEnabled(env=process.env){
 // An enabled Preview feature flag can NEVER enable this on Production.
 return env.VERCEL_ENV!=='production' &&
   env.WORDSKY_RECALL_PREVIEW_ENABLED==='true';
}

function pinnedActor(actor,input){
 if(actor?.role!=='player'||!UUID.test(String(actor.id||''))||
    !Number.isSafeInteger(actor.session_version)||actor.session_version<0)
  throw fail('Đăng nhập học viên để tiếp tục',401);
 if(!input||typeof input!=='object'||Array.isArray(input)||
    input.expected_actor_id!==actor.id)
  throw fail('Phiên tài khoản đã thay đổi; hãy đăng nhập lại',409);
 return actor.id;
}
async function lockedPlayer(db,actor){
 const query=await db.query('SELECT session_version FROM public.ws_users WHERE id=$1 FOR UPDATE',[actor.id]);
 if(!query.rows.length||query.rows[0].session_version!==actor.session_version)
  throw fail('Phiên đăng nhập đã hết hiệu lực',401);
}
async function consented(db,userId){
 const q=await db.query('SELECT consent_version FROM public.ws_recall_consents WHERE user_id=$1',[userId]);
 if(q.rows[0]?.consent_version!==RECALL_CONSENT)
  throw fail('Cần đồng ý tham gia thử nghiệm trước khi kiểm tra',403);
}
export async function recallPilotStatus(actor){
 const id=actor.id;
 const [consent,prompts]=await Promise.all([
  sql('SELECT consent_version FROM public.ws_recall_consents WHERE user_id=$1',[id]),
  sql('SELECT count(*)::int AS total FROM public.ws_recall_curated_prompts p '+
     'JOIN public.ws_words w ON w.id=p.word_id '+
     'JOIN public.ws_topics t ON t.id=w.topic_id '+
     'WHERE p.active=true AND p.approved=true AND w.enabled=true AND t.enabled=true')
 ]);
 return {
  pilot:true,scope:'shared-curated-only',consent_version:RECALL_CONSENT,
  consent_active:consent.rows[0]?.consent_version===RECALL_CONSENT,
  curated_prompts:prompts.rows[0]?.total??0,
  schedule_unchanged:true
 };
}
export async function acceptRecallPilotConsent(actor,input){
 const id=pinnedActor(actor,input);
 if(input.agree!==true||input.consent_version!==RECALL_CONSENT)
  throw fail('Bạn cần đồng ý rõ ràng với điều khoản thử nghiệm',400);
 return transaction(async db=>{
  await lockedPlayer(db,actor);
  await db.query(
   'INSERT INTO public.ws_recall_consents(user_id,consent_version) VALUES($1,$2) '+
   'ON CONFLICT(user_id) DO NOTHING',[id,RECALL_CONSENT]);
  return {ok:true,consent_active:true,consent_version:RECALL_CONSENT};
 });
}
export async function withdrawRecallPilotConsent(actor,input){
 const id=pinnedActor(actor,input);
 if(input.confirm_withdraw!==true)
  throw fail('Hãy xác nhận rút lại đồng ý',400);
 return transaction(async db=>{
  await lockedPlayer(db,actor);
  // Cascades delete BOTH all stored challenge snapshots and research
  // evidence for this WordSky account. Shared vocab and SRS are untouched.
  await db.query('DELETE FROM public.ws_recall_consents WHERE user_id=$1',[id]);
  return {ok:true,consent_active:false,deleted_account_recall_data:true};
 });
}
export async function issueRecallPilotTrial(actor,input){
 const id=pinnedActor(actor,input);
 if(Object.keys(input).some(k=>!['expected_actor_id'].includes(k)))
  throw fail('Yêu cầu phát câu hỏi không hợp lệ',400);
 return transaction(async db=>{
  await lockedPlayer(db,actor);
  await consented(db,id);
  const used=await db.query(
   "SELECT count(*)::int AS total FROM public.ws_recall_trials "+
   "WHERE user_id=$1 AND issued_at>clock_timestamp()-interval '24 hours'",[id]
  );
  if(used.rows[0].total>=MAX_TRIALS_PER_DAY)
   throw fail('Bạn đã dùng hết lượt kiểm tra thử nghiệm trong 24 giờ',429);
  const found=await db.query(
   'SELECT p.id AS prompt_id,p.word_id,p.prompt_vi,p.accepted_english,'+
   'p.answer_revision,w.english '+
   'FROM public.ws_recall_curated_prompts p '+
   'JOIN public.ws_words w ON w.id=p.word_id '+
   'JOIN public.ws_topics t ON t.id=w.topic_id '+
   'WHERE p.approved=true AND p.active=true AND w.enabled=true AND t.enabled=true '+
   'ORDER BY random() LIMIT 1'
  );
  const prompt=found.rows[0];
  if(!prompt)throw fail('Chưa có câu hỏi được duyệt trong bộ thử nghiệm',409);
  if(!prompt.accepted_english.some(v=>normalizeTypedEnglish(v)===normalizeTypedEnglish(prompt.english)))
   throw fail('Câu hỏi chưa được duyệt đúng với từ trong kho',409);
  const timestamp=await db.query('SELECT clock_timestamp() AS issued_at');
  const issued=new Date(timestamp.rows[0].issued_at).toISOString();
  const expires=new Date(Date.parse(issued)+4*60*1000).toISOString();
  const challenge=prepareTypedRecallTrial({
   trial_id:randomUUID(),account_id:id,source:'shared',word_id:prompt.word_id,
   prompt_vi:prompt.prompt_vi,accepted_english:prompt.accepted_english,
   answer_revision:prompt.answer_revision,issued_at:issued,expires_at:expires,
   prompt_curation_approved:true,answer_hidden:true,
   research_consent:true,consent_version:RECALL_CONSENT
  });
  await db.query(
   'INSERT INTO public.ws_recall_trials '+
   '(id,user_id,prompt_id,word_id,prompt_vi,accepted_english,'+
   'answer_revision,issued_at,expires_at) '+
   'VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)',
   [challenge.trial_id,id,prompt.prompt_id,prompt.word_id,prompt.prompt_vi,
    prompt.accepted_english,prompt.answer_revision,issued,expires]
  );
  return {trial:challenge,scope:'shared-curated-only',schedule_unchanged:true};
 });
}

export async function submitRecallPilotTrial(actor,input){
 const id=pinnedActor(actor,input);
 if(!UUID.test(String(input.trial_id||''))||
    !UUID.test(String(input.request_id||''))||
    typeof input.response!=='string'||input.response.length>160)
  throw fail('Yêu cầu kiểm tra từ không hợp lệ',400);
 // The only client-supplied grading input is the typed answer.
 // Client-supplied correctness, timing, consent or hint flags are rejected.
 const expectedKeys=['expected_actor_id','trial_id','request_id','response'];
 if(Object.keys(input).some(k=>!expectedKeys.includes(k)))
  throw fail('Yêu cầu chứa thông tin chấm điểm không hợp lệ',400);
 return transaction(async db=>{
  await lockedPlayer(db,actor);
  await consented(db,id);
  const found=await db.query(
   'SELECT id,user_id,word_id,prompt_vi,accepted_english,answer_revision,'+
   'issued_at,expires_at,submitted_at,submitted_request_id,result,response_latency '+
   'FROM public.ws_recall_trials WHERE id=$1 AND user_id=$2 FOR UPDATE',
   [input.trial_id,id]
  );
  const saved=found.rows[0];
  if(!saved)throw fail('Không tìm thấy lượt kiểm tra của tài khoản',404);
  if(saved.submitted_request_id){
   if(saved.submitted_request_id!==input.request_id)
    throw fail('Lượt kiểm tra đã được hoàn thành; không ghi lần nữa',409);
   return {ok:true,trial_id:saved.id,correct:saved.result==='correct',
    replayed:true,schedule_unchanged:true};
  }
  const clock=await db.query('SELECT clock_timestamp() AS submitted_at');
  const submitted=new Date(clock.rows[0].submitted_at).toISOString();
  const trial=prepareTypedRecallTrial({
   trial_id:saved.id,account_id:id,source:'shared',word_id:saved.word_id,
   prompt_vi:saved.prompt_vi,accepted_english:saved.accepted_english,
   answer_revision:saved.answer_revision,
   issued_at:new Date(saved.issued_at).toISOString(),
   expires_at:new Date(saved.expires_at).toISOString(),
   prompt_curation_approved:true,answer_hidden:true,
   research_consent:true,consent_version:RECALL_CONSENT
  });
  const grade=gradeTypedRecallTrial(trial,{
   trial_id:saved.id,response:input.response,
   server_submitted_at:submitted,server_attempt_index:1,
   server_hints_used:false,server_answer_revealed:false
  });
  if(grade.exclusion)throw fail(
   grade.exclusion==='expired'?'Lượt kiểm tra đã hết thời gian':'Câu trả lời chưa đủ điều kiện',
   grade.exclusion==='expired'?409:400
  );
  const event=grade.evidence;
  await db.query(
   'UPDATE public.ws_recall_trials SET submitted_request_id=$3,'+
   'submitted_at=$4::timestamptz,result=$5,response_latency=$6 '+
   'WHERE id=$1 AND user_id=$2 AND submitted_request_id IS NULL',
   [saved.id,id,input.request_id,submitted,event.result,event.response_latency]
  );
  try{
   await db.query(
    'INSERT INTO public.ws_recall_evidence '+
    '(trial_id,user_id,request_id,word_id,answer_revision,prompt_kind,'+
    'result,response_latency,consent_version,observed_at) '+
    'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz)',
    [saved.id,id,input.request_id,event.word_id,event.answer_revision,
     event.prompt_kind,event.result,event.response_latency,event.consent_version,submitted]
   );
  }catch(error){
   if(error?.code==='23505')throw fail('Mã gửi câu trả lời đã được sử dụng',409);
   throw error;
  }
  return {ok:true,trial_id:saved.id,correct:event.result==='correct',
   replayed:false,schedule_unchanged:true};
 });
}
