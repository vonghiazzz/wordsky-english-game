import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {hashPassword,verifyPassword} from '../lib/security.js';
import {
 createPlayerPasswordService,PlayerPasswordError,assertPlayerPasswordOrigin
} from '../lib/player-password-service.js';
import {isSessionVersionCurrent} from '../lib/admin-users-service.js';

const id=randomUUID(),actor={role:'player',id,session_version:0};
const oldPassword='ExistingPlayerPassword2026!';
const newPassword='AnotherStrongPass2027!';
const input=()=>({
 expected_actor_id:id,current_password:oldPassword,
 new_password:newPassword,confirm_password:newPassword
});
const req=(user=actor,origin='http://localhost:3000')=>({
 actor:user,headers:origin===null?{}:{origin}
});
function mockDb(){
 const user={id,username:'player_40',session_version:0,
  password_hash:hashPassword(oldPassword),password_changed_at:null,
  xp:75,streak:2};
 const calls=[],attempts=new Map();
 let snapshot;
 const query=async(sql,params=[])=>{
  calls.push({sql,params});
  if(sql==='BEGIN'){
   snapshot={...user};return {rows:[]};
  }
  if(sql==='ROLLBACK'){
   Object.assign(user,snapshot);return {rows:[]};
  }
  if(sql==='COMMIT')return {rows:[]};
  if(sql.includes('FROM public.ws_users')&&sql.includes('FOR UPDATE'))
   return {rows:[{username:user.username,password_hash:user.password_hash,
    session_version:user.session_version}]};
  if(sql.includes('UPDATE public.ws_users')){
   assert.equal(params[0],id);
   user.password_hash=params[1];user.session_version++;
   user.password_changed_at=new Date();
   return {rows:[{session_version:user.session_version}]};
  }
  throw Error('Unexpected SQL: '+sql);
 };
 return {user,calls,attempts,connect:async()=>({query,release(){}})};
}
function service(db){
 return createPlayerPasswordService({
  db,requirePlayer:async request=>request.actor,
  hashPassword,verifyPassword,expectedOrigin:'http://localhost:3000',
  getIp:()=> '203.0.113.17',
  throttle:async ip=>{
   if((db.attempts.get(ip)||0)>=10)
    throw new PlayerPasswordError('Thử lại sau 15 phút',429);
  },
  recordFailure:async ip=>{db.attempts.set(ip,(db.attempts.get(ip)||0)+1)},
  clearFailures:async ip=>{db.attempts.delete(ip)}
 });
}

test('UX40 requires signed-in player, a strong Origin and unspoofed actor ID',async()=>{
 const db=mockDb(),api=service(db);
 for(const request of [
  req(null),req({role:'guest',id}),req({role:'admin',id:'owner'}),
  req({...actor,session_version:undefined})
 ]){
  await assert.rejects(()=>api.changePassword(request,input()),e=>e.status===401);
 }
 for(const request of [req(actor,null),req(actor,'https://evil.example')]){
  await assert.rejects(()=>api.changePassword(request,input()),e=>e.status===403);
 }
 await assert.rejects(
  ()=>api.changePassword(req(),{...input(),expected_actor_id:randomUUID()}),
  e=>e.status===409);
 assert.equal(db.calls.length,0);
 assert.throws(()=>assertPlayerPasswordOrigin(req(actor,null),null),e=>e.status===403);
});

test('UX40 rejects empty, weak, username-containing, unchanged and mismatched passwords',async()=>{
 const db=mockDb(),api=service(db);
 for(const invalid of [
  {...input(),current_password:''},
  {...input(),new_password:newPassword,confirm_password:'DIFFERENT1234'},
  {...input(),new_password:'short123',confirm_password:'short123'},
  {...input(),new_password:'NoNumbersHere!',confirm_password:'NoNumbersHere!'},
  {...input(),new_password:'player_40PASS2027',confirm_password:'player_40PASS2027'},
  {...input(),new_password:oldPassword,confirm_password:oldPassword},
  {...input(),new_password:'a'.repeat(129)+'7',confirm_password:'a'.repeat(129)+'7'}
 ]){
  await assert.rejects(()=>api.changePassword(req(),invalid));
 }
 assert.equal(db.user.session_version,0);
 assert.ok(db.calls.every(c=>!c.sql.startsWith('UPDATE public.ws_users')));
});

test('UX40 wrong current password rolls back without updating hash, and is rate limited',async()=>{
 const db=mockDb(),api=service(db);
 for(let i=0;i<10;i++)
  await assert.rejects(
   ()=>api.changePassword(req(),{...input(),current_password:'IncorrectTestPassword!'}),
   e=>e.status===403);
 await assert.rejects(()=>api.changePassword(req(),input()),e=>e.status===429);
 assert.equal(db.user.session_version,0);
 assert.equal(verifyPassword(oldPassword,db.user.password_hash),true);
 assert.equal(db.calls.filter(x=>x.sql==='ROLLBACK').length,10);
 assert.ok(db.calls.every(c=>!c.sql.startsWith('UPDATE public.ws_users')));
});

test('UX40 password change is transactional, revokes all devices, and never touches learning records',async()=>{
 const db=mockDb(),api=service(db);
 const ack=await api.changePassword(req(),input());
 assert.deepEqual(ack,{ok:true,sessions_revoked:true,reauth_required:true});
 assert.equal(verifyPassword(oldPassword,db.user.password_hash),false);
 assert.equal(verifyPassword(newPassword,db.user.password_hash),true);
 assert.equal(db.user.session_version,1);
 assert.ok(db.user.password_changed_at instanceof Date);
 assert.deepEqual([db.user.xp,db.user.streak],[75,2]);
 assert.equal(isSessionVersionCurrent(actor,db.user),false);
 assert.equal(isSessionVersionCurrent({...actor,session_version:1},db.user),true);
 assert.equal(db.calls.filter(x=>x.sql==='COMMIT').length,1);
 assert.ok(db.calls.find(c=>c.sql.includes('FOR UPDATE')));
 assert.ok(db.calls.find(c=>c.sql.includes('session_version=session_version+1')));
 assert.equal(db.calls.some(c=>/ws_learning|ws_srs|ws_solo|ws_words/i.test(c.sql)),false);
 assert.doesNotMatch(JSON.stringify(ack),/password|scrypt|player_40/i);
});

test('UX40 a stale session cannot overwrite an intervening Admin password reset',async()=>{
 const db=mockDb(),api=service(db);
 db.user.session_version=1;
 await assert.rejects(()=>api.changePassword(req(),input()),e=>e.status===401);
 assert.equal(db.calls.filter(c=>c.sql==='ROLLBACK').length,1);
 assert.equal(db.user.session_version,1);
 assert.equal(verifyPassword(oldPassword,db.user.password_hash),true);
});

test('UX40 integration contract: bound actor, strict origin, cookie cleared and no duplicate global nav',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const gui=readFileSync(new URL('../public/account.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../public/shared-nav.js',import.meta.url),'utf8');
 const learning=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 assert.match(api,/key==='auth\/change-password'/);
 assert.match(api,/playerPasswordService\(\)\.changePassword\(req,body\(req,4096\)\)/);
 assert.match(api,/res\.setHeader\('set-cookie',cookie\(AUTH_COOKIE,'',0\)\)/);
 assert.match(gui,/expected_actor_id:actorId/);
 assert.match(gui,/credentials:'same-origin'/);
 assert.match(gui,/form\.reset\(\)/);
 assert.doesNotMatch(gui,/localStorage|sessionStorage|console\.|innerHTML|sendBeacon/);
 for(const field of ['ws40Current','ws40New','ws40Confirm'])
  assert.match(html,new RegExp('id="'+field+'"'));
 assert.match(html,/autocomplete="current-password"/);
 assert.match(html,/autocomplete="new-password"/);
 assert.match(html,/id="ws40Logout"/);
 assert.match(html,/data-ws-page="account"/);
 assert.match(nav,/isAccount/);
 assert.match(learning,/href="\/account\.html"/);
 assert.doesNotMatch(api,/password_changed_at[^\n]*RETURNING password_hash/);
});
