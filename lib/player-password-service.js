/* UX40: authenticated player self-service password change.
 * Reuse the Admin password policy and WordSky session-version revocation.
 * No secrets, passwords or hashes appear in responses or application logs.
 */
import {validAdminResetPassword,isSessionVersionCurrent} from './admin-users-service.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class PlayerPasswordError extends Error {
 constructor(message,status=400){super(message);this.status=status}
}
export function assertPlayerPasswordOrigin(req,expectedOrigin){
 let trusted;
 try{
  if(typeof expectedOrigin!=='string'||!/^https?:\/\//i.test(expectedOrigin))
   throw Error('Missing trusted origin');
  trusted=new URL(expectedOrigin).origin;
 }catch{throw new PlayerPasswordError('Không thể xác minh nguồn yêu cầu',403)}
 if(typeof req?.headers?.origin!=='string'||req.headers.origin!==trusted)
  throw new PlayerPasswordError('Nguồn yêu cầu không hợp lệ',403);
}

export function createPlayerPasswordService({
 db,requirePlayer,hashPassword,verifyPassword,expectedOrigin,
 getIp,throttle,recordFailure,clearFailures
}){
 if(!db?.connect||typeof requirePlayer!=='function'||
    typeof hashPassword!=='function'||typeof verifyPassword!=='function'||
    typeof getIp!=='function'||typeof throttle!=='function'||
    typeof recordFailure!=='function'||typeof clearFailures!=='function')
  throw Error('Player password service requires verified WordSky adapters');

 async function changePassword(req,input){
  // Caller must own a currently valid server-checked player session.
  const actor=await requirePlayer(req);
  if(actor?.role!=='player'||!UUID.test(String(actor.id||''))||
     !Number.isSafeInteger(actor.session_version)||actor.session_version<0)
   throw new PlayerPasswordError('Đăng nhập học viên để tiếp tục',401);
  assertPlayerPasswordOrigin(req,expectedOrigin);
  if(!input||typeof input!=='object'||Array.isArray(input))
   throw new PlayerPasswordError('Dữ liệu không hợp lệ');
  if(input.expected_actor_id!==undefined&&input.expected_actor_id!==actor.id)
   throw new PlayerPasswordError('Tài khoản đăng nhập đã thay đổi',409);
  if(typeof input.current_password!=='string'||
     input.current_password.length===0||input.current_password.length>1024)
   throw new PlayerPasswordError('Mật khẩu hiện tại không hợp lệ');
  if(typeof input.new_password!=='string'||
     typeof input.confirm_password!=='string'||
     input.new_password!==input.confirm_password)
   throw new PlayerPasswordError('Hai mật khẩu mới chưa trùng khớp');

  const ip=getIp(req);
  await throttle(ip); // existing durable IP-based auth attempt limiter
  const client=await db.connect();
  let committed=false,wrongCurrent=false;
  try{
   await client.query('BEGIN');
   const found=await client.query(
    'SELECT username,password_hash,session_version FROM public.ws_users '+
    'WHERE id=$1::uuid FOR UPDATE',[actor.id]);
   const user=found.rows[0];
   if(!user||!isSessionVersionCurrent(actor,user))
    throw new PlayerPasswordError('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại',401);
   if(!verifyPassword(input.current_password,user.password_hash)){
    wrongCurrent=true;
    throw new PlayerPasswordError('Mật khẩu hiện tại không đúng',403);
   }
   validAdminResetPassword(input.new_password,user.username);
   if(verifyPassword(input.new_password,user.password_hash))
    throw new PlayerPasswordError('Mật khẩu mới phải khác mật khẩu hiện tại');
   const hash=hashPassword(input.new_password);
   if(!/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(String(hash)))
    throw Error('Invalid WordSky password hash');
   const saved=await client.query(
    'UPDATE public.ws_users SET password_hash=$2,session_version=session_version+1,'+
    'password_changed_at=now() WHERE id=$1::uuid RETURNING session_version',
    [actor.id,hash]);
   if(!Number.isSafeInteger(saved.rows[0]?.session_version)||
       saved.rows[0].session_version!==user.session_version+1)
    throw Error('Player password version update failed');
   await client.query('COMMIT');
   committed=true;
  }catch(error){
   if(!committed)await client.query('ROLLBACK').catch(()=>{});
   // Log wrong current-password attempts outside the rolled-back transaction.
   if(wrongCurrent)await recordFailure(ip);
   throw error;
  }finally{client.release();}
  // A failure to clear old IP attempts must not undo a committed change.
  await Promise.resolve().then(()=>clearFailures(ip)).catch(()=>{});
  return {ok:true,sessions_revoked:true,reauth_required:true};
 }

 // UX41: explicitly revoke every player login token without changing the password.
 // Reuses the exact security boundary, durable throttle and versioned session model.
 async function revokeSessions(req,input){
  const actor=await requirePlayer(req);
  if(actor?.role!=='player'||!UUID.test(String(actor.id||''))||
     !Number.isSafeInteger(actor.session_version)||actor.session_version<0)
   throw new PlayerPasswordError('Đăng nhập học viên để tiếp tục',401);
  assertPlayerPasswordOrigin(req,expectedOrigin);
  if(!input||typeof input!=='object'||Array.isArray(input)||
     input.confirm_revoke_all!==true)
   throw new PlayerPasswordError('Hãy xác nhận đăng xuất khỏi tất cả thiết bị');
  if(input.expected_actor_id!==undefined&&input.expected_actor_id!==actor.id)
   throw new PlayerPasswordError('Tài khoản đăng nhập đã thay đổi',409);
  if(typeof input.current_password!=='string'||
     input.current_password.length===0||input.current_password.length>1024)
   throw new PlayerPasswordError('Mật khẩu hiện tại không hợp lệ');

  const ip=getIp(req);
  await throttle(ip);
  const client=await db.connect();
  let committed=false,wrongCurrent=false;
  try{
   await client.query('BEGIN');
   const found=await client.query(
    'SELECT password_hash,session_version FROM public.ws_users '+
    'WHERE id=$1::uuid FOR UPDATE',[actor.id]);
   const user=found.rows[0];
   if(!user||!isSessionVersionCurrent(actor,user))
    throw new PlayerPasswordError('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại',401);
   if(!verifyPassword(input.current_password,user.password_hash)){
    wrongCurrent=true;
    throw new PlayerPasswordError('Mật khẩu hiện tại không đúng',403);
   }
   const updated=await client.query(
    'UPDATE public.ws_users SET session_version=session_version+1 '+
    'WHERE id=$1::uuid RETURNING session_version',[actor.id]);
   if(!Number.isSafeInteger(updated.rows[0]?.session_version)||
      updated.rows[0].session_version!==user.session_version+1)
    throw Error('Session revocation version update failed');
   await client.query('COMMIT');
   committed=true;
  }catch(error){
   if(!committed)await client.query('ROLLBACK').catch(()=>{});
   if(wrongCurrent)await recordFailure(ip);
   throw error;
  }finally{client.release();}
  await Promise.resolve().then(()=>clearFailures(ip)).catch(()=>{});
  return {ok:true,sessions_revoked:true,reauth_required:true,password_unchanged:true};
 }
 return {changePassword,revokeSessions};
}
