// WordSky V4 server-side API. Vercel Node Function, PostgreSQL as durable source of truth.
import {sql,transaction} from '../lib/db.js';
import {hashPassword,verifyPassword,issueSession,parseSession,parseCookie,cookie,hashToken,randomToken,normalizeName,username,sameOrigin} from '../lib/security.js';
import {rankForXp,awardedAttendance,normalizeRound,normalizeAnswer,roundWindows,createState,reconcile,answerQuestion,publicState,requiredWords,assertWordCapacity,carWordRequirements,carMissingWords,fail} from '../lib/game.js';
import {randomInt} from 'node:crypto';
import {recordFlashcardReview,getFlashcardProgress,getFlashcardCatalog} from '../lib/learning-progress.js';

const AUTH_COOKIE='ws_auth';
const SOLO_COOKIE='ws_solo';
const SOLO_COOKIE_MAX_AGE=30*24*3600;
const REQ_MAX=16000;
const secret=()=>process.env.SESSION_SECRET;
const guestCookie=code=>'ws_room_'+code;
const idRegexp=/^[0-9a-f-]{36}$/i;
const toInt=(x,d=0)=>Number.isInteger(Number(x))?Number(x):d;
const badId=(x)=>!idRegexp.test(String(x||''));
const output=(res,code,obj)=>{res.statusCode=code;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(obj))};
function route(req){
 const fromQuery=req.query?.rest; let s=Array.isArray(fromQuery)?fromQuery.join('/'):String(fromQuery||'');
 if(!s){s=new URL(req.url||'/','http://local').pathname.replace(/^\/api\/?/,'')}
 return s.split('/').filter(Boolean).map(decodeURIComponent);
}
function body(req){let b=req.body??{};if(typeof b==='string'){if(b.length>REQ_MAX)throw fail('Dữ liệu quá dài',413);try{b=JSON.parse(b)}catch{throw fail('JSON không hợp lệ')}};if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>REQ_MAX)throw fail('Dữ liệu không hợp lệ',413);return b}
function actor(req){return parseSession(parseCookie(req.headers.cookie,AUTH_COOKIE),secret())}
function mustAdmin(req){const a=actor(req);if(a?.role!=='admin'||a.id!=='owner')throw fail('Bạn cần đăng nhập quản trị',401);return a}
function mustPlayer(req){const a=actor(req);if(a?.role!=='player')throw fail('Đăng nhập học viên để sử dụng tính năng này',401);return a}
async function playerRow(id){const {rows}=await sql('SELECT id,username,display_name,xp,streak,last_checkin FROM ws_users WHERE id=$1',[id]);if(!rows.length)throw fail('Tài khoản không tồn tại',401);return rows[0]}
const setAuth=(res,role,id)=>{const maxAge=role==='admin'?12*3600:7*24*3600;res.setHeader('set-cookie',cookie(AUTH_COOKIE,issueSession({role,id},secret(),maxAge),maxAge))};
const allowedUser=(v)=>{let s=normalizeName(v,40);if(s.length<2)throw fail('Tên hiển thị tối thiểu 2 ký tự');return s};
async function throttle(ip){const c=await sql("SELECT count(*)::int AS n FROM ws_login_failures WHERE remote_ip=$1 AND attempted_at>now()-interval '15 minutes'",[ip]);if(c.rows[0].n>=10)throw fail('Đăng nhập quá nhiều lần. Thử lại sau 15 phút.',429)}
const ipOf=req=>String(req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').slice(0,70);
async function signIn(req,res){
 const b=body(req);const ip=ipOf(req);await throttle(ip);
 const u=username(b.username);let row=null;let passOk=false;let role='player',id;
 if(u===String(process.env.ADMIN_USERNAME||'owner').toLowerCase()){
  if(process.env.ADMIN_PASSWORD_HASH)passOk=verifyPassword(b.password,process.env.ADMIN_PASSWORD_HASH);
  role='admin';id='owner';
 }else{
  const r=await sql('SELECT id,password_hash FROM ws_users WHERE username=$1',[u]);row=r.rows[0];
  // Hash a dummy when account doesn't exist to reduce username enumeration.
  passOk=verifyPassword(b.password,row?.password_hash||'scrypt:01234567890123456789012345678901:'+('00'.repeat(64)));
  id=row?.id;
 }
 if(!passOk){await sql('INSERT INTO ws_login_failures(remote_ip) VALUES ($1)',[ip]);throw fail('Sai tên đăng nhập hoặc mật khẩu',401)}
 await sql('DELETE FROM ws_login_failures WHERE remote_ip=$1',[ip]);
 setAuth(res,role,id);return {success:true,role};
}
async function signUp(req,res){
 const f=await sql("SELECT enabled FROM ws_features WHERE feature_key='SIGNUP'");if(f.rows[0]?.enabled===false)throw fail('Hệ thống đang tạm đóng đăng ký',403);
 const b=body(req);const u=username(b.username);if(u===String(process.env.ADMIN_USERNAME||'owner').toLowerCase())throw fail('Tên đăng nhập đã được sử dụng');
 const name=allowedUser(b.display_name||u);const pass=hashPassword(b.password);
 try{const row=await sql('INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',[u,name,pass]);setAuth(res,'player',row.rows[0].id);return {success:true,username:u}}catch(e){if(e.code==='23505')throw fail('Tên đăng nhập đã tồn tại',409);throw e}
}
async function checkin(req){
 const a=mustPlayer(req);
 const f=await sql("SELECT enabled FROM ws_features WHERE feature_key='ATTENDANCE'");if(f.rows[0]?.enabled===false)throw fail('Chức năng chuyên cần đang tạm dừng',403);
 return transaction(async db=>{
  const r=await db.query('SELECT * FROM ws_users WHERE id=$1 FOR UPDATE',[a.id]);if(!r.rows.length)throw fail('Tài khoản không tồn tại',401);const p=r.rows[0];
  const dr=await db.query("SELECT to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as today");const today=dr.rows[0].today;
  if(p.last_checkin?.toISOString?.().slice(0,10)===today || String(p.last_checkin||'').slice(0,10)===today)return {checked:true,already:true,xp:p.xp,streak:p.streak,rank:rankForXp(p.xp)};
  let streak=1;
  if(p.last_checkin){const prev=new Date(String(p.last_checkin?.toISOString?.().slice(0,10)||p.last_checkin).slice(0,10)+'T00:00:00Z');const todayD=new Date(today+'T00:00:00Z');if(Math.round((todayD-prev)/(24*3600000))===1)streak=p.streak+1}
  const earned=awardedAttendance(streak);
  await db.query('INSERT INTO ws_checkins(user_id,day,awarded_xp,streak) VALUES($1,$2,$3,$4)',[a.id,today,earned,streak]);
  await db.query('UPDATE ws_users SET xp=xp+$1,streak=$2,last_checkin=$3 WHERE id=$4',[earned,streak,today,a.id]);
  return {checked:true,already:false,earned,xp:p.xp+earned,streak,rank:rankForXp(p.xp+earned)};
 });
}
async function fetchTopics(includeWords=false){
 if(!includeWords){
  const r=await sql(`SELECT t.id,t.title,t.enabled,
   count(DISTINCT lower(w.english)) FILTER (WHERE w.enabled=true)::int AS word_count,
   count(DISTINCT lower(w.english)) FILTER (WHERE w.enabled=true AND w.cefr_review_status='APPROVED' AND w.cefr_level IN ('A1','A2'))::int AS approved_a2,
   count(DISTINCT lower(w.english)) FILTER (WHERE w.enabled=true AND w.cefr_review_status='APPROVED' AND w.cefr_level IN ('B1','B2'))::int AS approved_bonus,
   count(DISTINCT lower(w.english)) FILTER (WHERE w.enabled=true AND w.cefr_review_status='APPROVED' AND w.cefr_level IN ('C1','C2'))::int AS approved_double
   FROM ws_topics t LEFT JOIN ws_words w ON w.topic_id=t.id
   WHERE t.enabled=true GROUP BY t.id,t.title,t.enabled ORDER BY t.title`);
  return r.rows;
 }
 const r=await sql('SELECT id,title,enabled FROM ws_topics WHERE enabled=true ORDER BY title');
 const words=await sql('SELECT id,topic_id,english,meaning,ipa,example,translation,cefr_level,cefr_review_status FROM ws_words WHERE enabled=true ORDER BY english');
 return r.rows.map(t=>({...t,words:words.rows.filter(w=>w.topic_id===t.id)}));
}
async function audit(db,action,entityId,payload={}){await db.query('INSERT INTO ws_audit(actor,action,entity_id,payload) VALUES($1,$2,$3,$4::jsonb)',['owner',action,entityId,JSON.stringify(payload)])}
function adminInputEvent(b){
 const title=normalizeName(b.title,120);if(title.length<3)throw fail('Tên cuộc thi tối thiểu 3 ký tự');
 if(typeof b.password!=='string'||b.password.length<8)throw fail('Mật khẩu phòng ít nhất 8 ký tự');
 const max=toInt(b.max_players);if(max<2||max>500)throw fail('Giới hạn người chơi: 2–500');
 if(!Array.isArray(b.rounds)||b.rounds.length<1||b.rounds.length>12)throw fail('Cuộc thi phải có 1–12 vòng');
 return {title,password_hash:hashPassword(b.password),max_players:max,rounds:b.rounds.map(normalizeRound)};
}
function codeGen(){const letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:7},()=>letters[randomInt(letters.length)]).join('')}
// Check the active vocabulary in the same DB transaction as event creation/update.
// All Lane Escape questions come ONLY from approved CEFR-labelled cards.
async function approvedCarWordCounts(db,round){
 const q=await db.query(`SELECT
   count(DISTINCT lower(w.english)) FILTER (WHERE w.cefr_level IN ('A1','A2'))::int AS a2,
   count(DISTINCT lower(w.english)) FILTER (WHERE w.cefr_level IN ('B1','B2'))::int AS bonus,
   count(DISTINCT lower(w.english)) FILTER (WHERE w.cefr_level IN ('C1','C2'))::int AS double
  FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id
  WHERE w.enabled=true AND t.enabled=true AND w.cefr_review_status='APPROVED'
    AND ($1::uuid IS NULL OR w.topic_id=$1)`,[round.topic_id||null]);
 const row=q.rows[0]||{};
 return {A2:Number(row.a2||0),BONUS:Number(row.bonus||0),DOUBLE:Number(row.double||0)};
}
// Exactly the same approved, per-tier selection for multiplayer and Solo CAR.
// Capacity is checked before creating any persistent run.
async function selectApprovedCarWords(db,round){
 const need=carWordRequirements(round);
 const cards=await db.query(`SELECT id,english,meaning,cefr_level,tier FROM (
  SELECT w.id,w.english,w.meaning,w.cefr_level,
   CASE WHEN w.cefr_level IN ('A1','A2') THEN 'A2' WHEN w.cefr_level IN ('B1','B2') THEN 'BONUS' ELSE 'DOUBLE' END AS tier,
   row_number() OVER (PARTITION BY CASE WHEN w.cefr_level IN ('A1','A2') THEN 'A2' WHEN w.cefr_level IN ('B1','B2') THEN 'BONUS' ELSE 'DOUBLE' END ORDER BY random()) AS rn
  FROM (
   SELECT DISTINCT ON (lower(w.english)) w.id,w.english,w.meaning,w.cefr_level
   FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id
   WHERE w.enabled=true AND t.enabled=true AND w.cefr_review_status='APPROVED'
    AND w.cefr_level IN ('A1','A2','B1','B2','C1','C2')
    AND ($1::uuid IS NULL OR w.topic_id=$1)
   ORDER BY lower(w.english),w.id
  ) w
 ) pool
 WHERE (tier='A2' AND rn<=$2) OR (tier='BONUS' AND rn<=$3) OR (tier='DOUBLE' AND rn<=$4)`,[round.topic_id||null,need.A2,need.BONUS,need.DOUBLE]);
 const words={A2:[],BONUS:[],DOUBLE:[]};
 for(const card of cards.rows)words[card.tier].push(card);
 const missing=carMissingWords(round,words);
 if(missing.length)throw fail('Không đủ từ CEFR APPROVED cho CAR Solo/vòng thi: '+missing.join('; '),409);
 return words;
}

async function selectMatchWords(db,round){
 const wordLimit=requiredWords(round);
 const data=await db.query(`SELECT id,english,meaning FROM (
   SELECT DISTINCT ON (lower(w.english)) w.id,w.english,w.meaning,w.cefr_level,w.cefr_review_status
   FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id
   WHERE w.enabled=true AND t.enabled=true
     AND ($1::uuid IS NULL OR w.topic_id=$1)
   ORDER BY lower(w.english),
     CASE WHEN w.cefr_review_status='APPROVED' THEN 0 ELSE 1 END,w.id
  ) unique_words
  ORDER BY CASE
   WHEN cefr_review_status='APPROVED' AND (
    ($3='EASY' AND cefr_level IN ('A1','A2')) OR
    ($3='NORMAL' AND cefr_level IN ('B1','B2')) OR
    ($3='HARD' AND cefr_level IN ('C1','C2'))
   ) THEN 0
   WHEN cefr_review_status='APPROVED' AND (
    ($3='EASY' AND cefr_level IN ('B1','B2')) OR
    ($3='NORMAL' AND cefr_level IN ('A1','A2')) OR
    ($3='HARD' AND cefr_level IN ('B1','B2'))
   ) THEN 1
   WHEN cefr_review_status='APPROVED' AND cefr_level IN ('A1','A2','B1','B2','C1','C2') THEN 2
   ELSE 3 END,random() LIMIT $2`,[round.topic_id||null,wordLimit,round.difficulty]);
 assertWordCapacity(round,data.rows.length);
 return data.rows;
}
async function ensureVocabulary(db,rounds){
 for(const round of rounds){
  if(round.mode==='CAR'){
   const r=carWordRequirements(round),got=await approvedCarWordCounts(db,round);
   const missing=Object.entries(r).filter(([name,n])=>got[name]<n)
    .map(([name,n])=>`${name==='BONUS'?'B1–B2':name==='DOUBLE'?'C1–C2':'A1–A2'} ${got[name]}/${n}`);
   if(missing.length)throw fail('Lane Escape thiếu từ CEFR đã duyệt: '+missing.join('; '),400);
   continue;
  }
  const needed=requiredWords(round);
  if(!needed)continue;
  const count=await db.query(`SELECT count(DISTINCT lower(w.english))::int AS n FROM ws_words w
    JOIN ws_topics t ON t.id=w.topic_id WHERE w.enabled=true AND t.enabled=true
    AND ($1::uuid IS NULL OR w.topic_id=$1)`,[round.topic_id||null]);
   const available=Number(count.rows[0]?.n||0);
   if(available<needed)throw fail(`Cần ${needed} từ cho ${round.mode} ${round.difficulty}; hiện có ${available} từ (thiếu ${needed-available} từ).`,400);
 }
}
// Lock referenced events while checking the state to avoid live vocabulary edits.
async function ensureTopicNotLive(db,topicId){
 const active=await db.query("SELECT e.id FROM ws_events e JOIN ws_rounds r ON r.event_id=e.id WHERE (r.topic_id=$1 OR r.topic_id IS NULL) AND e.status IN ('OPEN','LIVE') FOR SHARE OF e",[topicId]);
 if(active.rows.length)throw fail('Không thể sửa hoặc ẩn từ vựng trong chủ đề của cuộc thi đang mở.',409);
}
async function adminCreateEvent(req){mustAdmin(req);const b=adminInputEvent(body(req));return transaction(async db=>{
 await ensureVocabulary(db,b.rounds);
 let code=codeGen();
 const rr=await db.query('INSERT INTO ws_events(title,join_code,password_hash,max_players) VALUES($1,$2,$3,$4) RETURNING id,join_code,status',[b.title,code,b.password_hash,b.max_players]);
 const e=rr.rows[0];await writeRounds(db,e.id,b.rounds);await audit(db,'event.create',e.id,{title:b.title,rounds:b.rounds.length});return e;
 })}
async function writeRounds(db,eventId,rounds){for(let i=0;i<rounds.length;i++){let r=rounds[i];await db.query('INSERT INTO ws_rounds(event_id,position,mode,topic_id,difficulty,duration_seconds,question_count,points_per_correct,penalty,weight,bomb_fall_seconds,bomb_batch_size,bomb_spawn_interval_seconds,car_step_seconds) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[eventId,i+1,r.mode,r.topic_id,r.difficulty,r.duration_seconds,r.question_count,r.points_per_correct,r.penalty,r.weight,r.mode==='BOMB'?r.bomb_fall_seconds:null,r.mode==='BOMB'?r.bomb_batch_size:null,r.mode==='BOMB'?r.bomb_spawn_interval_seconds:null,r.mode==='CAR'?r.car_step_seconds:null])}}
async function adminUpdateEvent(req,id){mustAdmin(req);if(badId(id))throw fail('ID cuộc thi không hợp lệ');let b=body(req);return transaction(async db=>{
 const x=await db.query('SELECT * FROM ws_events WHERE id=$1 FOR UPDATE',[id]);if(!x.rows.length)throw fail('Không tìm thấy cuộc thi',404);
 if(!['DRAFT','OPEN'].includes(x.rows[0].status))throw fail('Cuộc thi đã diễn ra, không thể đổi cấu hình',409);
 const title=b.title?normalizeName(b.title,120):x.rows[0].title;
 const max=b.max_players?toInt(b.max_players):x.rows[0].max_players;
 if(title.length<3||max<2||max>500)throw fail('Cấu hình không hợp lệ');
 if(b.rounds){
  if(!Array.isArray(b.rounds)||b.rounds.length<1||b.rounds.length>12)throw fail('Vòng thi không hợp lệ');
  const rounds=b.rounds.map(normalizeRound);
  await ensureVocabulary(db,rounds);
  await db.query('DELETE FROM ws_rounds WHERE event_id=$1',[id]);
  await writeRounds(db,id,rounds);
 }
 if(b.password && (typeof b.password!=='string'||b.password.length<8))throw fail('Mật khẩu phòng ít nhất 8 ký tự');
 const pw=b.password?hashPassword(b.password):x.rows[0].password_hash;
 await db.query('UPDATE ws_events SET title=$1,max_players=$2,password_hash=$3 WHERE id=$4',[title,max,pw,id]);await audit(db,'event.update',id,{title,max});return {success:true};
 })}
async function adminStatus(req,id,verb){mustAdmin(req);if(badId(id))throw fail('ID cuộc thi không hợp lệ');return transaction(async db=>{
 const a=await db.query('SELECT * FROM ws_events WHERE id=$1 FOR UPDATE',[id]);if(!a.rows.length)throw fail('Không tìm thấy cuộc thi',404);let e=a.rows[0];
 const expected=verb==='open'?['DRAFT']:verb==='start'?['OPEN']:['OPEN','LIVE','DRAFT'];
 if(!expected.includes(e.status))throw fail('Trạng thái cuộc thi không hợp lệ',409);
 if(verb==='open'||verb==='start'){
  const rr=await db.query('SELECT mode,difficulty,question_count,topic_id FROM ws_rounds WHERE event_id=$1 ORDER BY position',[id]);
  if(!rr.rows.length)throw fail('Cuộc thi chưa có vòng chơi');
  await ensureVocabulary(db,rr.rows);
 }
 if(verb==='start'){
  const cnt=await db.query('SELECT count(*)::int n FROM ws_participants WHERE event_id=$1',[id]);if(cnt.rows[0].n<1)throw fail('Cần ít nhất một người tham gia trước khi bắt đầu');
 }
 const newStatus={open:'OPEN',start:'LIVE',finish:'FINISHED'}[verb];
 await db.query(`UPDATE ws_events SET status=$1,started_at=CASE WHEN $1='LIVE' THEN now() ELSE started_at END,completed_at=CASE WHEN $1='FINISHED' THEN now() ELSE completed_at END WHERE id=$2`,[newStatus,id]);await audit(db,'event.'+verb,id);return {success:true,status:newStatus};
 })}
async function adminList(){const e=await sql(`SELECT e.id,e.title,e.join_code,e.status,e.max_players,e.started_at,e.created_at,(SELECT count(*)::int FROM ws_participants p WHERE p.event_id=e.id) participants FROM ws_events e ORDER BY e.created_at DESC LIMIT 100`);const rr=await sql('SELECT * FROM ws_rounds ORDER BY position');return e.rows.map(x=>({...x,rounds:rr.rows.filter(y=>y.event_id===x.id)}))}
async function eventInfo(code){const e=await sql('SELECT id,title,join_code,status,max_players,started_at,completed_at,round_start_overrides FROM ws_events WHERE join_code=$1',[code]);if(!e.rows.length)throw fail('Không tìm thấy phòng thi',404);const rounds=await sql('SELECT id,position,mode,topic_id,difficulty,duration_seconds,question_count,points_per_correct,penalty,weight,bomb_fall_seconds,bomb_batch_size,bomb_spawn_interval_seconds,car_step_seconds FROM ws_rounds WHERE event_id=$1 ORDER BY position',[e.rows[0].id]);const c=await sql('SELECT count(*)::int n FROM ws_participants WHERE event_id=$1',[e.rows[0].id]);return {...e.rows[0],participant_count:c.rows[0].n,rounds: e.rows[0].started_at?roundWindows(e.rows[0].started_at,rounds.rows,e.rows[0].round_start_overrides):rounds.rows}}
async function joinRoom(req,res,code){code=code.toUpperCase();if(!/^[A-Z0-9]{5,12}$/.test(code))throw fail('Mã phòng không hợp lệ');let b=body(req);
 const e=await sql('SELECT * FROM ws_events WHERE join_code=$1',[code]);if(!e.rows.length)throw fail('Phòng không tồn tại',404);const ev=e.rows[0];
 if(ev.status!=='OPEN')throw fail('Phòng hiện chưa nhận người chơi',409);
 const ip=ipOf(req);const failed=await sql("SELECT count(*)::int n FROM ws_join_failures WHERE remote_ip=$1 AND attempted_at>now()-interval '15 minutes'",[ip]);if(failed.rows[0].n>=12)throw fail('Nhập sai mật khẩu quá nhiều. Thử lại sau 15 phút.',429);
 if(!verifyPassword(b.password,ev.password_hash)){await sql('INSERT INTO ws_join_failures(remote_ip) VALUES($1)',[ip]);throw fail('Sai mật khẩu phòng',401)}
 await sql('DELETE FROM ws_join_failures WHERE remote_ip=$1',[ip]);
 const u=actor(req);let display=allowedUser(b.name);const r=await transaction(async db=>{
  const evr=await db.query('SELECT * FROM ws_events WHERE id=$1 FOR UPDATE',[ev.id]);if(evr.rows[0].status!=='OPEN')throw fail('Phòng đã khóa',409);
  if(u?.role==='player'){const existing=await db.query('SELECT id,display_name FROM ws_participants WHERE event_id=$1 AND user_id=$2',[ev.id,u.id]);if(existing.rows.length)return existing.rows[0]}
  const count=await db.query('SELECT count(*)::int n FROM ws_participants WHERE event_id=$1',[ev.id]);if(count.rows[0].n>=ev.max_players)throw fail('Phòng đã đủ số người',409);
  try{const add=await db.query('INSERT INTO ws_participants(event_id,user_id,display_name,entry_secret_hash) VALUES($1,$2,$3,$4) RETURNING id,display_name',[ev.id,u?.role==='player'?u.id:null,display,hashToken(randomToken())]);return add.rows[0]}
  catch(err){if(err.code==='23505')throw fail('Tên người chơi đã tồn tại trong phòng',409);throw err}
 });
 const cook=cookie(guestCookie(code),issueSession({role:'guest',id:r.id,event:ev.id},secret(),48*3600),48*3600);
 res.setHeader('set-cookie',cook);return {success:true,participant_id:r.id,name:r.display_name,code};
}
async function membership(req,event){
 const a=actor(req);if(a?.role==='admin')return {admin:true};
 const g=parseSession(parseCookie(req.headers.cookie,guestCookie(event.join_code)),secret());
 if(!g||g.role!=='guest'||g.event!==event.id||badId(g.id))throw fail('Bạn chưa tham gia phòng này',401);
 const row=await sql('SELECT * FROM ws_participants WHERE id=$1 AND event_id=$2',[g.id,event.id]);if(!row.rows.length)throw fail('Phiên tham gia không hợp lệ',401);
 // Prevent score submissions if another user is logged in after using a different account.
 if(row.rows[0].user_id && a?.id!==row.rows[0].user_id)throw fail('Vui lòng đăng nhập tài khoản đã tham gia phòng',401);
 return row.rows[0];
}
async function standings(eventId){
 const r=await sql(`SELECT p.id,p.display_name,p.joined_at,COALESCE(sum(r.score * rd.weight),0)::int AS total_score,COALESCE(sum(r.correct),0)::int AS correct,
 count(r.id)::int AS started_rounds
 FROM ws_participants p
 LEFT JOIN ws_runs r ON r.participant_id=p.id
 LEFT JOIN ws_rounds rd ON rd.id=r.round_id
 WHERE p.event_id=$1 GROUP BY p.id ORDER BY total_score DESC,correct DESC,p.joined_at ASC LIMIT 500`,[eventId]);
 return r.rows.map((x,i)=>({...x,position:i+1}));
}
async function activeRoom(req,code){const e=await eventInfo(code.toUpperCase());const p=await membership(req,e);const board=await standings(e.id);
 return {event:e,me:p.admin?null:{id:p.id,name:p.display_name},board,serverNow:Date.now()};}
async function startRound(req,code,roundId){const e=await eventInfo(code.toUpperCase());const p=await membership(req,e);
 if(p.admin)throw fail('Admin không tham gia tính điểm',403);
 if(e.status!=='LIVE')throw fail('Cuộc thi chưa bắt đầu',409);
 const round=e.rounds.find(r=>r.id===roundId);if(!round)throw fail('Vòng thi không tồn tại',404);
 const feature=await sql('SELECT enabled FROM ws_features WHERE feature_key=$1',[round.mode]);if(feature.rows[0]?.enabled===false)throw fail('Chế độ chơi hiện đang bị tắt',403);
 const now=Date.now(),start=Date.parse(round.starts_at),ends=Date.parse(round.ends_at);
 if(now<start||now>=ends)throw fail('Chưa đến hoặc đã hết giờ vòng này',409);
 return transaction(async db=>{
  const existed=await db.query('SELECT * FROM ws_runs WHERE round_id=$1 AND participant_id=$2 FOR UPDATE',[roundId,p.id]);
  if(existed.rows.length){const run=existed.rows[0];return {runId:run.id,round,game:publicState(run.state,now)}};
   let words=[];
   if(round.mode==='CAR'){
    words=await selectApprovedCarWords(db,round);
   }else{
    words=await selectMatchWords(db,round);
   }
  const st=createState(round,words,now,ends);
  const saved=await db.query('INSERT INTO ws_runs(participant_id,round_id,state) VALUES($1,$2,$3::jsonb) ON CONFLICT(participant_id,round_id) DO NOTHING RETURNING id,state',[p.id,roundId,JSON.stringify(st)]);
  if(!saved.rows.length){const retry=await db.query('SELECT * FROM ws_runs WHERE participant_id=$1 AND round_id=$2',[p.id,roundId]);return {runId:retry.rows[0].id,round,game:publicState(retry.rows[0].state,now)}};
  return {runId:saved.rows[0].id,round,game:publicState(st,now)};
 })}
// Only after ALL joined players have a persisted terminal run do we shorten the
// next round's start. An event-row lock makes the operation safe with concurrent
// answers and several serverless instances. The earlier rounds retain their rows.
async function shortenRoundWhenEveryoneFinished(eventId,roundId,now=Date.now()){
 return transaction(async db=>{
  const evResult=await db.query('SELECT status,started_at,round_start_overrides FROM ws_events WHERE id=$1 FOR UPDATE',[eventId]);
  const ev=evResult.rows[0];if(!ev||ev.status!=='LIVE'||!ev.started_at)return false;
  const rounds=(await db.query('SELECT id,position,duration_seconds FROM ws_rounds WHERE event_id=$1 ORDER BY position',[eventId])).rows;
  const idx=rounds.findIndex(r=>r.id===roundId);
  if(idx<0||idx>=rounds.length-1)return false;
  const next=rounds[idx+1];const overrides=ev.round_start_overrides||{};
  if(overrides[String(next.position)])return false;
  const windows=roundWindows(ev.started_at,rounds,overrides);
  if(now<Date.parse(windows[idx].starts_at)||now>=Date.parse(windows[idx].ends_at))return false;
  if(now+5000>=Date.parse(windows[idx+1].starts_at))return false;
  const ready=await db.query(`SELECT count(*)::int AS total,
    count(r.id) FILTER(WHERE r.status IN ('COMPLETED','FAILED','TIMEOUT'))::int AS finished
   FROM ws_participants p LEFT JOIN ws_runs r ON r.participant_id=p.id AND r.round_id=$2
   WHERE p.event_id=$1`,[eventId,roundId]);
  const {total,finished}=ready.rows[0];
  if(total<1||finished!==total)return false;
  await db.query(`UPDATE ws_events SET round_start_overrides=jsonb_set(
    coalesce(round_start_overrides,'{}'::jsonb),ARRAY[$2],to_jsonb($3::text),true)
    WHERE id=$1`,[eventId,String(next.position),new Date(now+5000).toISOString()]);
  return true;
 });
}
async function playRound(req,code,runId,answer){const e=await eventInfo(code.toUpperCase());const p=await membership(req,e);if(p.admin)throw fail('Admin không được ghi điểm',403);
 if(badId(runId))throw fail('ID lượt chơi không hợp lệ');
 if(answer&&e.status!=='LIVE')throw fail('Cuộc thi đã đóng, không nhận thêm đáp án',409);
 const response=await transaction(async db=>{
  const q=await db.query('SELECT a.*,r.mode,r.difficulty,r.points_per_correct,r.penalty,r.weight,r.question_count,r.duration_seconds,r.car_step_seconds,r.bomb_fall_seconds,r.bomb_batch_size,r.bomb_spawn_interval_seconds,r.event_id,r.id AS round_id FROM ws_runs a JOIN ws_rounds r ON r.id=a.round_id WHERE a.id=$1 AND a.participant_id=$2 AND r.event_id=$3 FOR UPDATE OF a',[runId,p.id,e.id]);
  if(!q.rows.length)throw fail('Không tìm thấy lượt chơi',404);const rec=q.rows[0];const now=Date.now();let st=rec.state;
  const previous=JSON.stringify(st);let result={};
  if(answer){({state:st,result}=answerQuestion(st,rec,answer,now));}
  else reconcile(st,rec,now);
  if(JSON.stringify(st)!==previous){await db.query('UPDATE ws_runs SET state=$1::jsonb,score=$2,health=$3,correct=$4,mistakes=$5,status=$6,finished_at=CASE WHEN $6=$7 THEN finished_at ELSE coalesce(finished_at,now()) END WHERE id=$8',[JSON.stringify(st),st.score,st.health,st.correct,st.mistakes,st.status,'PLAYING',runId])}
  return {runId,roundId:rec.round_id,game:publicState(st,now),result};
 });
 if(response.game.status!=='PLAYING')await shortenRoundWhenEveryoneFinished(e.id,response.roundId);
 const {roundId,...publicResponse}=response;
 return publicResponse;
}
async function playerStats(req){const user=await playerRow(mustPlayer(req).id);const today=new Date().toISOString().slice(0,10);return {...user,rank:rankForXp(user.xp),today};}
async function globalRank(){const r=await sql('SELECT id,display_name,xp,streak FROM ws_users ORDER BY xp DESC,created_at ASC LIMIT 100');return r.rows.map((u,i)=>({...u,rank:rankForXp(u.xp),position:i+1}))}

function soloRound(mode,input){
 const b=input||{};
 return normalizeRound({
  mode,difficulty:b.difficulty||'EASY',topic_id:b.topic_id||null,
  duration_seconds:b.duration_seconds??90,question_count:b.question_count??(mode==='BOMB'?8:mode==='CAR'?3:6),
  points_per_correct:100,penalty:25,weight:1
 });
}
function soloPublicRound(round,state){
 const out={mode:round.mode,topic_id:round.topic_id,difficulty:round.difficulty,duration_seconds:round.duration_seconds,
  question_count:round.question_count,points_per_correct:round.points_per_correct,penalty:round.penalty};
 if(round.mode==='BOMB'||round.mode==='CAR')Object.assign(out,state?.soloConfig||{});
 return out;
}
function soloGuestIdentity(req,signingSecret){
 const existing=parseSession(parseCookie(req.headers.cookie,SOLO_COOKIE),signingSecret);
 if(existing?.role==='guest'&&existing.scope==='solo'&&/^[0-9a-f]{64}$/i.test(String(existing.token||'')))return {token:existing.token};
 return {token:randomToken()};
}
async function startSolo(req,res,mode){
 if(!['MATCH','BOMB','CAR'].includes(mode))throw fail('Chế độ Solo không hợp lệ');
 const round=soloRound(mode,body(req));
 const signingSecret=secret();if(!signingSecret||signingSecret.length<32)throw fail('Máy chủ chưa cấu hình SESSION_SECRET an toàn',503);
 const owner=actor(req);const identity=soloGuestIdentity(req,signingSecret);const accessHash=hashToken(identity.token);const now=Date.now();
 const fingerprintHash=hashToken(signingSecret+':'+ipOf(req));
 const created=await transaction(async db=>{
  const feature=await db.query('SELECT enabled FROM ws_features WHERE feature_key=$1',[mode]);
  if(feature.rows[0]?.enabled===false)throw fail(`Chế độ ${mode} hiện đang tạm dừng`,403);
  // Serialize the rate-limit check per fingerprint across all serverless instances.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[fingerprintHash]);
  const recent=await db.query("SELECT count(*)::int AS n FROM ws_solo_runs WHERE client_fingerprint_hash=$1 AND started_at>now()-interval '15 minutes'",[fingerprintHash]);
  if(Number(recent.rows[0]?.n||0)>=30)throw fail('Bạn đã tạo quá nhiều lượt Solo. Thử lại sau 15 phút.',429);
  if(round.topic_id){
   const topic=await db.query('SELECT id FROM ws_topics WHERE id=$1 AND enabled=true',[round.topic_id]);
   if(!topic.rows.length)throw fail('Chủ đề không tồn tại hoặc đang bị tắt',404);
  }
  const words=mode==='CAR'?await selectApprovedCarWords(db,round):await selectMatchWords(db,round);
  const state=createState(round,words,now,now+round.duration_seconds*1000);
  if(mode==='BOMB')state.soloConfig={bomb_fall_seconds:round.bomb_fall_seconds,bomb_batch_size:round.bomb_batch_size,bomb_spawn_interval_seconds:round.bomb_spawn_interval_seconds};
  if(mode==='CAR')state.soloConfig={car_step_seconds:round.car_step_seconds};
  state.answerReceipts={};
  const q=await db.query(`INSERT INTO ws_solo_runs(user_id,access_token_hash,client_fingerprint_hash,mode,topic_id,difficulty,duration_seconds,question_count,points_per_correct,penalty,status,score,health,correct,mistakes,state)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
   RETURNING id`,[owner?.role==='player'?owner.id:null,accessHash,fingerprintHash,mode,round.topic_id,round.difficulty,round.duration_seconds,round.question_count,round.points_per_correct,round.penalty,state.status,state.score,state.health,state.correct,state.mistakes,JSON.stringify(state)]);
  return {id:q.rows[0].id,state};
 });
 // This cookie identifies one browser, not one run, so creating a new run never
 // removes access to older runs owned by the same guest identity.
 res.setHeader('set-cookie',cookie(SOLO_COOKIE,issueSession({role:'guest',scope:'solo',token:identity.token},signingSecret,SOLO_COOKIE_MAX_AGE),SOLO_COOKIE_MAX_AGE));
 return {runId:created.id,round:soloPublicRound(round,created.state),game:publicState(created.state,now)};
}
function authorizeSolo(req,run){
 const a=actor(req);
 if(run.user_id){
  if(a?.role==='player'&&a.id===run.user_id)return;
  throw fail('Phiên chơi Solo không thuộc tài khoản hiện tại',401);
 }
 const access=parseSession(parseCookie(req.headers.cookie,SOLO_COOKIE),secret());
 if(!access||access.role!=='guest'||access.scope!=='solo'||hashToken(access.token||'')!==run.access_token_hash)
  throw fail('Phiên chơi Solo không hợp lệ hoặc đã hết hạn',401);
}
const receiptResult=receipt=>receipt?.result??receipt??{};
function soloAttemptContent(mode,answer){
 if(mode==='MATCH')return {leftId:String(answer.leftId||''),rightId:String(answer.rightId||'')};
 if(mode==='BOMB'){
  if(answer.auto!==true||answer.bombId!==undefined)throw fail('BOMB Solo chỉ nhận chế độ tự động theo từ đã nhập');
  return {answer:normalizeAnswer(answer.answer),auto:true};
 }
 if(mode==='CAR'){
  const typed=normalizeAnswer(answer.answer);
  if(typed.length>100)throw fail('Câu trả lời quá dài');
  if(answer.auto===true){
   if(answer.lane!==undefined||!typed)throw fail('CAR tự động chỉ nhận từ tiếng Anh, không nhận làn');
   return {answer:typed,auto:true};
  }
  const lane=Number(answer.lane);
  if(!Number.isInteger(lane)||lane<0||lane>4)throw fail('Làn đường phải từ 1 đến 5');
  return {lane,answer:typed};
 }
 throw fail('Chế độ Solo không hợp lệ',409);
}
function receiptContent(receipt){
 if(receipt?.content)return receipt.content;
 if(receipt?.leftId)return {leftId:receipt.leftId,rightId:receipt.rightId};
 return null;
}
// JSONB can reorder keys. Compare canonical scalar fields.
function sameAttemptContent(a,b){
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))return false;
 const keysA=Object.keys(a).sort(),keysB=Object.keys(b).sort();
 return keysA.length===keysB.length&&keysA.every((key,i)=>key===keysB[i]&&a[key]===b[key]);
}
async function playSolo(req,runId,answer,lookupAttemptId){
 if(badId(runId))throw fail('ID lượt chơi không hợp lệ');
 return transaction(async db=>{
  const q=await db.query(`SELECT id,user_id,access_token_hash,mode,topic_id,difficulty,duration_seconds,question_count,points_per_correct,penalty,state
   FROM ws_solo_runs WHERE id=$1 FOR UPDATE`,[runId]);
  if(!q.rows.length)throw fail('Không tìm thấy lượt chơi Solo',404);
  const rec=q.rows[0];authorizeSolo(req,rec);
  if(answer){
   const feature=await db.query('SELECT enabled FROM ws_features WHERE feature_key=$1',[rec.mode]);
   if(feature.rows[0]?.enabled===false)throw fail(`Chế độ ${rec.mode} hiện đang tạm dừng`,403);
  }
  const now=Date.now();let state=rec.state;const before=JSON.stringify(state);let result={};let duplicate=false;let attempt;
  reconcile(state,rec,now);
  if(lookupAttemptId!==undefined){
   const attemptId=String(lookupAttemptId||'');
   if(!idRegexp.test(attemptId))throw fail('Mã lần trả lời không hợp lệ');
   const receipt=state.answerReceipts?.[attemptId];
   result=receiptResult(receipt);attempt={id:attemptId,applied:!!receipt};
  }
  if(answer){
   const attemptId=String(answer.attemptId||'');
   if(!idRegexp.test(attemptId))throw fail('Mã lần trả lời không hợp lệ');
   const content=soloAttemptContent(rec.mode,answer);
   if(rec.mode==='BOMB'&&!content.answer)throw fail('Nhập câu trả lời tiếng Anh');
   if(rec.mode==='CAR'&&normalizeAnswer(answer.answer)!==content.answer)throw fail('Dữ liệu CAR không hợp lệ');
   const receipt=state.answerReceipts?.[attemptId];
   if(receipt){
    if(receiptContent(receipt)&&!sameAttemptContent(receiptContent(receipt),content))
     throw fail('Mã lần trả lời đã được dùng cho một thao tác khác',409);
    result=receiptResult(receipt);duplicate=true;
   }
   else{
    ({state,result}=answerQuestion(state,rec,answer,now));
    if(!state.answerReceipts||typeof state.answerReceipts!=='object')state.answerReceipts={};
    state.answerReceipts[attemptId]={content,result};
   }
  }
  if(JSON.stringify(state)!==before)await db.query(`UPDATE ws_solo_runs SET state=$1::jsonb,status=$2,score=$3,health=$4,correct=$5,mistakes=$6,
   finished_at=CASE WHEN $2='PLAYING' THEN finished_at ELSE coalesce(finished_at,now()) END WHERE id=$7`,
   [JSON.stringify(state),state.status,state.score,state.health,state.correct,state.mistakes,runId]);
  return {runId,round:soloPublicRound(rec,state),game:publicState(state,now),result,duplicate,...(attempt?{attempt}:{})};
 });
}

export default async function handler(req,res){
 let requestSegments=[];
 try{
  res.setHeader('x-content-type-options','nosniff');
  if(!['GET','POST','PATCH','DELETE'].includes(req.method))return output(res,405,{error:'Phương thức không được hỗ trợ'});
  if(req.method!=='GET'&&!sameOrigin(req))return output(res,403,{error:'Invalid origin'});
  const r=requestSegments=route(req),method=req.method,key=r.join('/');
  if(method==='POST'&&key==='learning/flashcards/reviews'){
    const userId=mustPlayer(req).id,review=body(req);
    // Optional actor pin protects against login/logout between client verification
    // and POST, especially during batch import from local Flashcards.
    if(review.expected_actor_id!==undefined&&review.expected_actor_id!==userId)
      throw fail('Tài khoản đã thay đổi; không gửi tiến độ sang người dùng khác',409);
    return output(res,201,await recordFlashcardReview(userId,review));
  }
  if(method==='GET'&&key==='learning/flashcards/progress')return output(res,200,await getFlashcardProgress(mustPlayer(req).id));
  if(method==='GET'&&key==='learning/flashcards/catalog'){mustPlayer(req);return output(res,200,await getFlashcardCatalog());}
  if(method==='GET'&&key==='health')return output(res,200,{ok:true,service:'wordsky-v4',database:!!process.env.DATABASE_URL});
  if(method==='POST'&&key==='auth/login')return output(res,200,await signIn(req,res));
  if(method==='POST'&&key==='auth/signup')return output(res,201,await signUp(req,res));
  if(method==='POST'&&key==='auth/logout'){res.setHeader('set-cookie',cookie(AUTH_COOKIE,'',0));return output(res,200,{ok:true})}
  if(method==='GET'&&key==='auth/me'){const a=actor(req);return output(res,200,{actor:a?.role==='player'?{...a,profile:await playerRow(a.id)}:a||null})}
  if(method==='POST'&&key==='attendance/checkin')return output(res,200,await checkin(req));
  if(method==='GET'&&key==='attendance/me')return output(res,200,await playerStats(req));
  if(method==='GET'&&key==='rankings')return output(res,200,{players:await globalRank()});
  if(method==='GET'&&key==='topics')return output(res,200,{topics:await fetchTopics(false)});
  if(method==='POST'&&key==='solo/match/start')return output(res,201,await startSolo(req,res,'MATCH'));
  if(method==='POST'&&key==='solo/bomb/start')return output(res,201,await startSolo(req,res,'BOMB'));
  if(method==='POST'&&key==='solo/car/start')return output(res,201,await startSolo(req,res,'CAR'));
  if(method==='GET'&&r[0]==='solo'&&r[1]==='runs'&&r[2]&&r.length===3)return output(res,200,await playSolo(req,r[2]));
  if(method==='GET'&&r[0]==='solo'&&r[1]==='runs'&&r[2]&&r[3]==='attempts'&&r[4]&&r.length===5)return output(res,200,await playSolo(req,r[2],undefined,r[4]));
  if(method==='POST'&&r[0]==='solo'&&r[1]==='runs'&&r[2]&&r[3]==='answer'&&r.length===4)return output(res,200,await playSolo(req,r[2],body(req)));
  if(method==='GET'&&key==='admin/topics'){mustAdmin(req);return output(res,200,{topics:await fetchTopics(true)})}
  if(method==='POST'&&key==='admin/topics'){
   mustAdmin(req);const b=body(req),title=normalizeName(b.title,80);if(title.length<2)throw fail('Tên chủ đề tối thiểu 2 ký tự');
   const d=await sql('INSERT INTO ws_topics(title) VALUES($1) RETURNING id,title',[title]);return output(res,201,d.rows[0]);
  }
  if(method==='PATCH'&&r[0]==='admin'&&r[1]==='topics'&&r.length===3){mustAdmin(req);if(badId(r[2]))throw fail('ID không hợp lệ');const b=body(req);const title=normalizeName(b.title,80);if(title.length<2)throw fail('Tên không hợp lệ');const d=await sql('UPDATE ws_topics SET title=$1 WHERE id=$2 RETURNING id,title',[title,r[2]]);if(!d.rows.length)throw fail('Không tìm thấy',404);return output(res,200,d.rows[0])}
  if(method==='DELETE'&&r[0]==='admin'&&r[1]==='topics'&&r.length===3){
   mustAdmin(req);if(badId(r[2]))throw fail('ID không hợp lệ');
   await transaction(async db=>{await ensureTopicNotLive(db,r[2]);await db.query('UPDATE ws_topics SET enabled=false WHERE id=$1',[r[2]])});
   return output(res,200,{ok:true});
  }
   if(method==='GET'&&key==='admin/cefr/reviews'){
    mustAdmin(req);
    const q=await sql(`SELECT DISTINCT ON (entity_id) entity_id AS word_id,
      payload->>'source_url' AS source_url,created_at
      FROM ws_audit WHERE action='word_cefr_review'
      ORDER BY entity_id,created_at DESC,id DESC`);
    return output(res,200,{reviews:q.rows});
   }
   if(method==='PATCH'&&r[0]==='admin'&&r[1]==='words'&&r[3]==='cefr'&&r.length===4){
    mustAdmin(req);if(badId(r[2]))throw fail('ID không hợp lệ',400);
    const b=body(req),level=b.cefr_level===''||b.cefr_level===null?null:b.cefr_level;
    const status=b.cefr_review_status;
    if(level!==null&&!['A1','A2','B1','B2','C1','C2'].includes(level))throw fail('Cấp CEFR không hợp lệ',400);
    if(!['UNREVIEWED','PROVISIONAL','APPROVED'].includes(status))throw fail('Trạng thái duyệt không hợp lệ',400);
    if(status==='UNREVIEWED'&&level!==null)throw fail('UNREVIEWED phải để CEFR trống',400);
    if(status!=='UNREVIEWED'&&!level)throw fail('Cần chọn cấp CEFR',400);
    const sourceUrl=String(b.source_url||'').trim();
    if(sourceUrl.length>500)throw fail('Link nguồn quá dài',400);
    if(status==='APPROVED'){
     let source;try{source=new URL(sourceUrl)}catch{throw fail('APPROVED cần link nguồn HTTPS',400)}
     if(source.protocol!=='https:'||!source.hostname)throw fail('APPROVED cần link nguồn HTTPS',400);
    }
    const updated=await transaction(async db=>{
     const prev=await db.query('SELECT id,topic_id,english,meaning,cefr_level,cefr_review_status FROM ws_words WHERE id=$1 AND enabled=true FOR UPDATE',[r[2]]);
     if(!prev.rows.length)throw fail('Không tìm thấy từ',404);
     await ensureTopicNotLive(db,prev.rows[0].topic_id);
     const q=await db.query('UPDATE ws_words SET cefr_level=$1,cefr_review_status=$2 WHERE id=$3 RETURNING id,cefr_level,cefr_review_status',[level,status,r[2]]);
     await audit(db,'word_cefr_review',r[2],{
      english:prev.rows[0].english,meaning:prev.rows[0].meaning,
      previous_level:prev.rows[0].cefr_level,previous_status:prev.rows[0].cefr_review_status,
      cefr_level:level,cefr_review_status:status,source_url:sourceUrl,reviewed_by:'owner'
     });
     return q.rows[0];
    });
    return output(res,200,updated);
   }
  if(method==='POST'&&key==='admin/words'){
   mustAdmin(req);const b=body(req);if(badId(b.topic_id))throw fail('Chủ đề không hợp lệ');const english=normalizeName(b.english,80),meaning=normalizeName(b.meaning,180);
   if(!english||!meaning)throw fail('Thiếu từ tiếng Anh hoặc nghĩa');const q=await transaction(async db=>{await ensureTopicNotLive(db,b.topic_id);return db.query('INSERT INTO ws_words(topic_id,english,meaning,ipa,example,translation) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[b.topic_id,english,meaning,normalizeName(b.ipa,80),normalizeName(b.example,250),normalizeName(b.translation,250)])});return output(res,201,q.rows[0]);
  }
  if(method==='PATCH'&&r[0]==='admin'&&r[1]==='words'&&r.length===3){mustAdmin(req);if(badId(r[2]))throw fail('ID không hợp lệ');const b=body(req);const en=normalizeName(b.english,80),vi=normalizeName(b.meaning,180);if(!en||!vi)throw fail('Thiếu từ hoặc nghĩa');const q=await transaction(async db=>{
    const current=await db.query('SELECT topic_id FROM ws_words WHERE id=$1 FOR UPDATE',[r[2]]);if(!current.rows.length)throw fail('Không tìm thấy',404);
    await ensureTopicNotLive(db,current.rows[0].topic_id);
    return db.query(`UPDATE ws_words SET english=$1,meaning=$2,ipa=$3,example=$4,translation=$5,
       cefr_level=CASE WHEN english IS DISTINCT FROM $1 OR meaning IS DISTINCT FROM $2 OR ipa IS DISTINCT FROM $3 OR example IS DISTINCT FROM $4 OR translation IS DISTINCT FROM $5 THEN NULL ELSE cefr_level END,
       cefr_review_status=CASE WHEN english IS DISTINCT FROM $1 OR meaning IS DISTINCT FROM $2 OR ipa IS DISTINCT FROM $3 OR example IS DISTINCT FROM $4 OR translation IS DISTINCT FROM $5 THEN 'UNREVIEWED' ELSE cefr_review_status END
       WHERE id=$6 RETURNING id`,[en,vi,normalizeName(b.ipa,80),normalizeName(b.example,250),normalizeName(b.translation,250),r[2]]);
   });return output(res,200,q.rows[0]);
  }
  if(method==='DELETE'&&r[0]==='admin'&&r[1]==='words'&&r.length===3){
   mustAdmin(req);if(badId(r[2]))throw fail('ID không hợp lệ');
   await transaction(async db=>{const word=await db.query('SELECT topic_id FROM ws_words WHERE id=$1 FOR UPDATE',[r[2]]);if(!word.rows.length)throw fail('Không tìm thấy',404);await ensureTopicNotLive(db,word.rows[0].topic_id);await db.query('UPDATE ws_words SET enabled=false WHERE id=$1',[r[2]])});
   return output(res,200,{ok:true});
  }
  if(method==='GET'&&key==='admin/features'){mustAdmin(req);const features=await sql('SELECT feature_key,enabled,updated_at FROM ws_features ORDER BY feature_key');return output(res,200,{features:features.rows})}
  if(method==='PATCH'&&r[0]==='admin'&&r[1]==='features'&&r[2]&&r.length===3){mustAdmin(req);const key=r[2].toUpperCase();if(!['MATCH','BOMB','CAR','ATTENDANCE','SIGNUP'].includes(key))throw fail('Feature không hợp lệ');const b=body(req);if(typeof b.enabled!=='boolean')throw fail('enabled phải là true hoặc false');const q=await sql('INSERT INTO ws_features(feature_key,enabled) VALUES($1,$2) ON CONFLICT(feature_key) DO UPDATE SET enabled=excluded.enabled,updated_at=now() RETURNING feature_key,enabled',[key,b.enabled]);return output(res,200,q.rows[0])}
  if(method==='GET'&&key==='admin/events'){mustAdmin(req);return output(res,200,{events:await adminList()})}
  if(method==='POST'&&key==='admin/events')return output(res,201,await adminCreateEvent(req));
  if(r[0]==='admin'&&r[1]==='events'&&r[2]){
   if(method==='PATCH'&&r.length===3)return output(res,200,await adminUpdateEvent(req,r[2]));
   if(method==='POST'&&['open','start','finish'].includes(r[3])&&r.length===4)return output(res,200,await adminStatus(req,r[2],r[3]));
  }
  if(method==='GET'&&r[0]==='events'&&r[1]&&r.length===2){const e=await eventInfo(r[1].toUpperCase());return output(res,200,{event:{title:e.title,join_code:e.join_code,status:e.status,max_players:e.max_players,participant_count:e.participant_count,rounds:e.rounds.map(({topic_id,...rest})=>rest)}})}
  if(method==='POST'&&r[0]==='events'&&r[1]&&r[2]==='join')return output(res,200,await joinRoom(req,res,r[1]));
  if(method==='GET'&&r[0]==='rooms'&&r[1]&&r.length===2)return output(res,200,await activeRoom(req,r[1]));
  if(method==='POST'&&r[0]==='rooms'&&r[1]&&r[2]==='rounds'&&r[3]&&r[4]==='start')return output(res,200,await startRound(req,r[1],r[3]));
  if(method==='GET'&&r[0]==='rooms'&&r[1]&&r[2]==='runs'&&r[3])return output(res,200,await playRound(req,r[1],r[3]));
  if(method==='POST'&&r[0]==='rooms'&&r[1]&&r[2]==='runs'&&r[3]&&r[4]==='answer')return output(res,200,await playRound(req,r[1],r[3],body(req)));
  return output(res,404,{error:'API không tồn tại'});
 }catch(e){
  if(e.code==='42P01'&&requestSegments[0]==='learning')return output(res,503,{error:'Đồng bộ tài khoản chưa được bật trên database này.'});
  if(e.code==='23505')return output(res,409,{error:'Dữ liệu đã tồn tại'});
  if(e.code==='23503')return output(res,400,{error:'Chủ đề hoặc dữ liệu tham chiếu không tồn tại'});
  const status=Number(e.status)||500;if(status>=500)console.error('WordSky API internal error',e?.message);
  return output(res,status,{error:status>=500?'Lỗi máy chủ. Kiểm tra cấu hình hoặc thử lại sau.':e.message});
 }
}
