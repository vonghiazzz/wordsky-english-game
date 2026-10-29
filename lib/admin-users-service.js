/* UX30: account administration. No password values or hashes ever leave the API. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class AdminUsersError extends Error {
 constructor(message,status=400){super(message);this.status=status}
}
const forbidden=()=>{throw new AdminUsersError('Không có quyền quản trị',403)};
const sane=value=>typeof value==='string'&&value.trim().length>0;
export function validAdminResetPassword(password,username){
 if(typeof password!=='string'||password.length<12||password.length>128)
  throw new AdminUsersError('Mật khẩu mới cần 12–128 ký tự.');
 if(!/[a-z]/i.test(password)||!/[0-9]/.test(password))
  throw new AdminUsersError('Mật khẩu mới phải có cả chữ và số.');
 if(sane(username)&&password.toLowerCase().includes(username.toLowerCase()))
  throw new AdminUsersError('Mật khẩu không được chứa tên đăng nhập.');
 return true;
}
export function isSessionVersionCurrent(claim,user){
 return Number.isSafeInteger(claim?.session_version)&&
  Number.isSafeInteger(user?.session_version)&&
  claim.session_version===user.session_version;
}
export function assertPasswordResetOrigin(req,expectedOrigin){
 if(!expectedOrigin||!/^https?:\/\//i.test(expectedOrigin))forbidden();
 const actual=req?.headers?.origin;
 if(typeof actual!=='string'||actual!==new URL(expectedOrigin).origin)forbidden();
}
export function createAdminUsersService({db,requireAdmin,verifyAdminPassword,hashPassword,verifyPassword,expectedOrigin}){
 if(!db?.query||!db?.connect||typeof requireAdmin!=='function'||
    typeof verifyAdminPassword!=='function'||typeof hashPassword!=='function'||
    typeof verifyPassword!=='function')throw Error('Admin service requires verified WordSky adapters');

 async function authorize(req,stepped=false,credential=''){
  const actor=await requireAdmin(req);
  if(!actor||actor.role!=='admin'||!sane(actor.username))forbidden();
  if(stepped){
   assertPasswordResetOrigin(req,expectedOrigin);
   if(!sane(credential)||credential.length>1024||
      !(await verifyAdminPassword(actor,credential,req)))forbidden();
  }
  return actor;
 }
 async function listUsers(req,{q='',page=0,size=20}={}){
  await authorize(req);
  if(typeof q!=='string'||q.length>64||!Number.isSafeInteger(page)||
    page<0||page>10000||!Number.isSafeInteger(size)||size<1||size>50)
   throw new AdminUsersError('Bộ lọc tài khoản không hợp lệ');
  const term=q.trim();
  const where="WHERE ($1::text='' OR position(lower($1) in lower(username))>0 OR position(lower($1) in lower(display_name))>0)";
  const [results,count]=await Promise.all([
   db.query("SELECT id::text AS id,username,display_name,created_at "+
    "FROM public.ws_users "+where+" ORDER BY username ASC LIMIT $2 OFFSET $3",
    [term,size,page*size]),
   db.query("SELECT count(*)::int AS total FROM public.ws_users "+where,[term])
  ]);
  return {users:results.rows,total:Number(count.rows[0]?.total||0),page,size};
 }
 async function resetPassword(req,userId,input){
  if(typeof userId!=='string'||!UUID.test(userId))
   throw new AdminUsersError('ID người dùng không hợp lệ');
  if(!input||typeof input!=='object'||Array.isArray(input))
   throw new AdminUsersError('Dữ liệu không hợp lệ');
  const actor=await authorize(req,true,input.admin_password);
  if(input.new_password!==input.confirm_password)
   throw new AdminUsersError('Mật khẩu xác nhận không trùng khớp');
  if(!sane(input.confirm_username))
   throw new AdminUsersError('Cần nhập tên tài khoản để xác nhận');
  const dbClient=await db.connect();
  let committed=false;
  try{
   await dbClient.query('BEGIN');
   const r=await dbClient.query(
    'SELECT id::text AS id, username, password_hash FROM public.ws_users WHERE id=$1::uuid FOR UPDATE',
    [userId]);
   const user=r.rows[0];
   if(!user)throw new AdminUsersError('Không tìm thấy tài khoản',404);
   if(user.username!==input.confirm_username.trim())
    throw new AdminUsersError('Tên tài khoản xác nhận không đúng');
   validAdminResetPassword(input.new_password,user.username);
   if(verifyPassword(input.new_password,user.password_hash))
    throw new AdminUsersError('Mật khẩu mới phải khác mật khẩu hiện tại');
   const recent=await dbClient.query(
    "SELECT count(*)::int AS count FROM public.ws_admin_password_reset_audit "+
    "WHERE target_user_id=$1::uuid AND created_at>now()-interval '1 hour'",[userId]);
   if(Number(recent.rows[0]?.count||0)>=3)
    throw new AdminUsersError('Tài khoản đã được đặt lại quá 3 lần trong một giờ',429);
   const hash=hashPassword(input.new_password);
   if(!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(String(hash)))
    throw Error('Invalid WordSky password hash');
   const saved=await dbClient.query(
    'UPDATE public.ws_users SET password_hash=$2,session_version=session_version+1,'+
    'password_changed_at=now() WHERE id=$1::uuid RETURNING username,session_version',
    [userId,hash]);
   await dbClient.query(
    'INSERT INTO public.ws_admin_password_reset_audit(admin_username,target_user_id) VALUES($1,$2::uuid)',
    [actor.username,userId]);
   await dbClient.query('COMMIT');
   committed=true;
   return {ok:true,username:saved.rows[0].username,sessions_revoked:true};
  }catch(error){
   if(!committed)await dbClient.query('ROLLBACK').catch(()=>{});
   throw error;
  }finally{
   dbClient.release();
  }
 }
 return {listUsers,resetPassword};
}
