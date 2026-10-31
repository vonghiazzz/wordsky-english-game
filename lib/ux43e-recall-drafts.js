/*
 * UX43E1 - Preview/isolated-only Admin curation workbench.
 * Stores INACTIVE, UNAPPROVED drafts ONLY. There is no approval or
 * activation endpoint: independent bilingual review is not implemented.
 * No SRS, game, consent or player-evidence writes.
 */
import {randomUUID} from 'node:crypto';
import {normalizeTypedEnglish,prepareTypedRecallTrial} from './ux43b-recall-evidence.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DRAFTS_PER_DAY=60;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

export function recallDraftsEnabled(env=process.env){
 return env.VERCEL_ENV!=='production' &&
  env.WORDSKY_RECALL_PREVIEW_ENABLED==='true';
}
function uuid(value){
 if(typeof value!=='string'||!UUID.test(value))
  throw fail('ID từ hoặc bản nháp không hợp lệ',400);
 return value.toLowerCase();
}
function limitedQuery({q='',page=0,size=20}={}){
 if(typeof q!=='string'||q.length>64||
  !Number.isSafeInteger(page)||page<0||page>10000||
  !Number.isSafeInteger(size)||size<1||size>50)
  throw fail('Bộ lọc kiểm duyệt không hợp lệ',400);
 return {q:q.trim(),page,size};
}
function checkInput(input,allowed){
 if(!input||typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).some(k=>!allowed.includes(k)))
  throw fail('Yêu cầu chứa trường không hợp lệ',400);
}
/* Lexical validation is NOT a human bilingual semantic approval.
 * The current catalog English spelling must be among curated variants;
 * meanings can still be ambiguous and MUST be independently reviewed.
 */
export function validateRecallDraft(input,word){
 checkInput(input,['word_id','prompt_vi','accepted_english','answer_revision','admin_password']);
 const wordId=uuid(input.word_id);
 if(!word||word.id!==wordId||word.enabled!==true||word.topic_enabled!==true)
  throw fail('Từ không tồn tại hoặc đã bị vô hiệu hóa',404);
 if(typeof input.prompt_vi!=='string'||typeof input.answer_revision!=='string')
  throw fail('Thiếu nghĩa tiếng Việt hoặc phiên bản đáp án');
 if(!Array.isArray(input.accepted_english)||
  input.accepted_english.some(x=>typeof x!=='string'))
  throw fail('Danh sách đáp án tiếng Anh không hợp lệ');
 const answers=input.accepted_english.map(x=>x.trim());
 let reference;
 try{reference=normalizeTypedEnglish(word.english)}catch{
  throw fail('Từ tiếng Anh trong kho chưa đủ điều kiện kiểm tra');
 }
 let includesCatalogWord=false;
 try{includesCatalogWord=answers.some(x=>normalizeTypedEnglish(x)===reference)}
 catch{throw fail('Đáp án chứa ký tự hoặc định dạng không được hỗ trợ')}
 if(!includesCatalogWord)
  throw fail('Đáp án phải bao gồm từ tiếng Anh gốc trong kho');
 const trialId=randomUUID();
 let normalized;
 try{
  const trial=prepareTypedRecallTrial({
   trial_id:trialId,account_id:randomUUID(),source:'shared',
   word_id:wordId,prompt_vi:input.prompt_vi,accepted_english:answers,
   answer_revision:input.answer_revision,
   issued_at:'2026-10-31T00:00:00Z',
   expires_at:'2026-10-31T00:04:00Z',
   prompt_curation_approved:true,answer_hidden:true,
   research_consent:false
  });
  normalized={prompt_vi:trial.prompt_vi,answer_revision:input.answer_revision.trim()};
 }catch{
  throw fail('Nghĩa/đáp án chưa đạt kiểm tra cú pháp, trùng lặp hoặc làm lộ đáp án');
 }
 return {word_id:wordId,...normalized,accepted_english:answers};
}
export function createRecallDraftService({
 db,transaction,requireAdmin,verifyAdminPassword,expectedOrigin
}){
 if(!db?.query||typeof transaction!=='function'||
  typeof requireAdmin!=='function'||typeof verifyAdminPassword!=='function')
  throw Error('UX43E1 requires trusted WordSky server adapters');

 async function authorize(req,stepUp=false,password=''){
  const a=await requireAdmin(req);
  if(a?.role!=='admin'||a.id!=='owner')
   throw fail('Bạn cần đăng nhập quản trị',401);
  if(stepUp){
   const actual=req?.headers?.origin;
   if(typeof expectedOrigin!=='string'||!/^https?:\/\//.test(expectedOrigin)||
    typeof actual!=='string'||actual!==new URL(expectedOrigin).origin)
    throw fail('Nguồn thao tác không hợp lệ',403);
   if(typeof password!=='string'||password.length<1||password.length>1024||
    !(await verifyAdminPassword(a,password,req)))
    throw fail('Cần xác minh mật khẩu Admin',403);
  }
  return a;
 }
 async function listWords(req,params={}){
  await authorize(req);
  const {q,page,size}=limitedQuery(params);
  const where="FROM public.ws_words w JOIN public.ws_topics t ON t.id=w.topic_id "+
    "WHERE w.enabled=true AND t.enabled=true AND "+
    "($1::text='' OR position(lower($1) in lower(w.english))>0 "+
    "OR position(lower($1) in lower(w.meaning))>0)";
  const [data,count]=await Promise.all([
   db.query("SELECT w.id::text AS id,w.english,w.meaning,t.title AS topic "+
    where+" ORDER BY w.english ASC,w.id ASC LIMIT $2 OFFSET $3",
    [q,size,page*size]),
   db.query("SELECT count(*)::int AS total "+where,[q])
  ]);
  return {words:data.rows,total:count.rows[0]?.total??0,page,size};
 }
 async function listDrafts(req,params={}){
  await authorize(req);
  const {q,page,size}=limitedQuery(params);
  const where="FROM public.ws_recall_curated_prompts p "+
   "JOIN public.ws_words w ON w.id=p.word_id "+
   "WHERE ($1::text='' OR position(lower($1) in lower(w.english))>0 "+
   "OR position(lower($1) in lower(p.prompt_vi))>0)";
  const [data,count]=await Promise.all([
   db.query("SELECT p.id::text,p.word_id::text,w.english,w.meaning,p.prompt_vi,"+
    "p.accepted_english,p.answer_revision,p.curated_at,p.approved,p.active "+
    where+" ORDER BY p.curated_at DESC,p.id DESC LIMIT $2 OFFSET $3",
    [q,size,page*size]),
   db.query("SELECT count(*)::int AS total "+where,[q])
  ]);
  return {drafts:data.rows,total:count.rows[0]?.total??0,page,size,
   approval_available:false,requires_independent_review:true};
 }
 async function createDraft(req,input){
  checkInput(input,['word_id','prompt_vi','accepted_english','answer_revision','admin_password']);
  await authorize(req,true,input.admin_password);
  const wordId=uuid(input.word_id);
  return transaction(async client=>{
   // Serialize owner draft creation so the daily cap cannot be raced.
   await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[435001]);
   // Lock catalog state until draft is recorded; no game/SRS writes.
   const catalog=await client.query(
    "SELECT w.id::text,w.english,w.enabled,t.enabled AS topic_enabled "+
    "FROM public.ws_words w JOIN public.ws_topics t ON t.id=w.topic_id "+
    "WHERE w.id=$1::uuid FOR SHARE",[wordId]
   );
   const normalized=validateRecallDraft(input,catalog.rows[0]);
   const rate=await client.query(
    "SELECT count(*)::int AS count FROM public.ws_recall_curated_prompts "+
    "WHERE curator='owner' AND curated_at>clock_timestamp()-interval '24 hours'"
   );
   if(Number(rate.rows[0]?.count||0)>=MAX_DRAFTS_PER_DAY)
    throw fail('Đã vượt giới hạn bản nháp trong 24 giờ',429);
   try{
    const created=await client.query(
     "INSERT INTO public.ws_recall_curated_prompts "+
     "(word_id,prompt_vi,accepted_english,answer_revision,curator,approved,active) "+
     "VALUES ($1::uuid,$2,$3::text[],$4,'owner',false,false) "+
     "RETURNING id::text,word_id::text,prompt_vi,accepted_english,"+
     "answer_revision,approved,active,curated_at",
     [normalized.word_id,normalized.prompt_vi,
      normalized.accepted_english,normalized.answer_revision]
    );
    return {draft:created.rows[0],approval_available:false,
     requires_independent_review:true};
   }catch(e){
    if(e?.code==='23505')throw fail('Phiên bản đáp án của từ này đã tồn tại',409);
    throw e;
   }
  });
 }
 async function discardDraft(req,draftId,input){
  checkInput(input,['admin_password','confirm_revision']);
  await authorize(req,true,input.admin_password);
  const id=uuid(draftId);
  if(typeof input.confirm_revision!=='string'||!input.confirm_revision.trim()||
    input.confirm_revision.length>64)
   throw fail('Cần xác nhận chính xác phiên bản bản nháp');
  return transaction(async client=>{
   // Approved/active prompts are NEVER deleted or changed by this workbench.
   const removed=await client.query(
    "DELETE FROM public.ws_recall_curated_prompts "+
    "WHERE id=$1::uuid AND answer_revision=$2 "+
    "AND approved=false AND active=false "+
    "RETURNING id::text",
    [id,input.confirm_revision.trim()]
   );
   if(!removed.rows.length)throw fail('Không tìm thấy bản nháp an toàn để xóa',409);
   return {ok:true,deleted_draft:true,approval_available:false};
  });
 }
 return {listWords,listDrafts,createDraft,discardDraft};
}
