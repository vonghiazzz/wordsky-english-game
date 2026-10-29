import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {hashPassword,verifyPassword} from '../lib/security.js';
import {
 createAdminUsersService,validAdminResetPassword,isSessionVersionCurrent,AdminUsersError
} from '../lib/admin-users-service.js';

const id=randomUUID();
const admin={role:'admin',id:'owner',username:'owner'};
const request={headers:{origin:'http://localhost:3000'}};
const data=()=>({
 confirm_username:'learner_29',
 new_password:'OnlyNewPassword2026!',
 confirm_password:'OnlyNewPassword2026!',
 admin_password:'CorrectAdminPassword2026!'
});
function fakeDb(){
 const user={id,username:'learner_29',display_name:'Learner',session_version:0,
  password_hash:hashPassword('OldPassword2025!'),created_at:new Date()};
 const calls=[],audit=[];
 const query=async(sql,params=[])=>{
  calls.push({sql,params});
  if(sql.includes('SELECT id::text AS id,username,display_name,created_at'))
   return {rows:[{id:user.id,username:user.username,display_name:user.display_name,created_at:user.created_at}]};
  if(sql.includes('count(*)::int AS total FROM public.ws_users'))
   return {rows:[{total:1}]};
  if(sql.includes('FOR UPDATE'))
   return {rows:[{id:user.id,username:user.username,password_hash:user.password_hash}]};
  if(sql.includes('count(*)::int AS count FROM public.ws_admin_password_reset_audit'))
   return {rows:[{count:audit.length}]};
  if(sql.includes('UPDATE public.ws_users')){
   user.password_hash=params[1];user.session_version++;
   return {rows:[{username:user.username,session_version:user.session_version}]};
  }
  if(sql.includes('INSERT INTO public.ws_admin_password_reset_audit')){
   audit.push({actor:params[0],target:params[1]});return {rows:[]};
  }
  return {rows:[]};
 };
 const client={query,release(){calls.push({sql:'RELEASE'})}};
 return {query,connect:async()=>client,user,calls,audit};
}
function service(db,actor=admin,expectedOrigin='http://localhost:3000'){
 return createAdminUsersService({
  db,hashPassword,verifyPassword,expectedOrigin,
  requireAdmin:async()=>actor,
  verifyAdminPassword:async(_actor,password)=>password==='CorrectAdminPassword2026!'
 });
}
test('UX30 Admin lists account data without hashes or secrets',async()=>{
 const db=fakeDb(),response=await service(db).listUsers(request,{q:'learner',size:20,page:0});
 assert.equal(response.total,1);
 assert.equal(response.users[0].username,'learner_29');
 assert.equal('password_hash' in response.users[0],false);
 assert.equal(JSON.stringify(response).includes('OldPassword2025'),false);
 assert.ok(db.calls.every(call=>!call.sql.includes('SELECT id::text AS id,username,display_name,created_at,password_hash')));
});
test('UX30 prevents player from listing or resetting accounts',async()=>{
 const db=fakeDb(),api=service(db,{role:'player',username:'learner_29'});
 await assert.rejects(()=>api.listUsers(request),e=>e.status===403);
 await assert.rejects(()=>api.resetPassword(request,id,data()),e=>e.status===403);
 assert.equal(db.audit.length,0);
});
test('UX30 requires same Origin and fresh Admin password',async()=>{
 const db=fakeDb(),api=service(db);
 for(const req of [{headers:{}},{headers:{origin:'https://another.example'}}]){
  await assert.rejects(()=>api.resetPassword(req,id,data()),e=>e.status===403);
 }
 await assert.rejects(()=>api.resetPassword(request,id,{...data(),admin_password:'wrong'}),e=>e.status===403);
 await assert.rejects(()=>service(db,admin,null).resetPassword(request,id,data()),e=>e.status===403);
 assert.equal(db.calls.filter(c=>c.sql==='BEGIN').length,0);
});
test('UX30 validates new password and double confirmation before any update',async()=>{
 const db=fakeDb(),api=service(db);
 for(const body of [
  {...data(),new_password:'short99',confirm_password:'short99'},
  {...data(),new_password:'onlylettersnever123',confirm_password:'mismatch'},
  {...data(),confirm_username:'wrong'},
  {...data(),new_password:'learner_29-X2026',confirm_password:'learner_29-X2026'},
  {...data(),new_password:'OldPassword2025!',confirm_password:'OldPassword2025!'}
 ])await assert.rejects(()=>api.resetPassword(request,id,body));
 assert.equal(db.audit.length,0);
 assert.equal(db.user.session_version,0);
 assert.throws(()=>validAdminResetPassword('a'.repeat(130)+'1','learn'));
});
test('UX30 transactional reset uses scrypt, revokes old session and writes audit',async()=>{
 const db=fakeDb(),api=service(db);
 const oldSession={role:'player',id,session_version:0};
 assert.equal(isSessionVersionCurrent(oldSession,db.user),true);
 const response=await api.resetPassword(request,id,data());
 assert.deepEqual(response,{ok:true,username:'learner_29',sessions_revoked:true});
 assert.equal(verifyPassword(data().new_password,db.user.password_hash),true);
 assert.equal(verifyPassword('OldPassword2025!',db.user.password_hash),false);
 assert.match(db.user.password_hash,/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
 assert.equal(db.user.session_version,1);
 assert.equal(isSessionVersionCurrent(oldSession,db.user),false);
 assert.equal(isSessionVersionCurrent({...oldSession,session_version:1},db.user),true);
 assert.equal(db.calls.filter(x=>x.sql==='COMMIT').length,1);
 assert.equal(db.audit.length,1);
 assert.equal(db.audit[0].actor,'owner');
 assert.equal(JSON.stringify(db.audit).includes(data().new_password),false);
 assert.equal(JSON.stringify(response).includes(data().new_password),false);
});
test('UX30 rate limits fourth reset within an hour',async()=>{
 const db=fakeDb(),api=service(db);
 await api.resetPassword(request,id,data());
 await api.resetPassword(request,id,{...data(),new_password:'DifferentPassword2027!',confirm_password:'DifferentPassword2027!'});
 await api.resetPassword(request,id,{...data(),new_password:'DifferentPassword2028!',confirm_password:'DifferentPassword2028!'});
 await assert.rejects(
  ()=>api.resetPassword(request,id,{...data(),new_password:'DifferentPassword2029!',confirm_password:'DifferentPassword2029!'}),
  e=>e.status===429
 );
 assert.equal(db.audit.length,3);
});
test('UX30 account reset is isolated to Admin route; app checks player cookie version for every user action',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const gui=readFileSync(new URL('../public/ux06-admin.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/admin-users.html',import.meta.url),'utf8');
 const db=readFileSync(new URL('../db/migrations/20261029_ux30_admin_users_password_reset.sql',import.meta.url),'utf8');
 assert.match(api,/key==='admin\/users'/);
 assert.match(api,/r\[3\]==='reset-password'/);
 assert.match(api,/verifyPassword\(pass,process\.env\.ADMIN_PASSWORD_HASH\)/);
 assert.match(api,/const a=actor\(req\)/);
 assert.match(api,/function mustPlayer\(req\)/);
 assert.match(api,/session_version:sessionVersion/);
 assert.match(api,/req\._wsPlayerSessionValid=isSessionVersionCurrent|req\._wsPlayerSessionValid=Boolean/);
 assert.match(api,/function authorizeSolo/);
 assert.match(gui,/href="\/admin-users\.html"/);
 assert.match(html,/id="auAdminPassword"/);
 assert.match(html,/id="auConfirmUsername"/);
 assert.match(db,/ALTER TABLE public\.ws_users/);
 assert.match(db,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(readFileSync(new URL('../public/admin-users.js',import.meta.url),'utf8'),/localStorage|sessionStorage|innerHTML/);
});
