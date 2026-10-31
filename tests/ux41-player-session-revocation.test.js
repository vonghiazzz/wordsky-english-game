import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {hashPassword,verifyPassword} from '../lib/security.js';
import {createPlayerPasswordService} from '../lib/player-password-service.js';
import {isSessionVersionCurrent} from '../lib/admin-users-service.js';

const userId=randomUUID(),origin='http://localhost:3000';
const knownPassword='QaCurrentPassword2026!';
const actor={id:userId,role:'player',session_version:2};
const request=(person=actor,site=origin)=>({
 actor:person,headers:site===null?{}:{origin:site}
});
const input=(person=userId)=>({
 expected_actor_id:person,current_password:knownPassword,confirm_revoke_all:true
});
function fixture(){
 const passwordHash=hashPassword(knownPassword);
 const row={id:userId,password_hash:passwordHash,session_version:2,
  password_changed_at:null,xp:145,streak:5};
 const attempts=new Map(),queries=[];
 let before;
 const query=async(sql,params=[])=>{
  queries.push({sql,params});
  if(sql==='BEGIN'){before={...row};return {rows:[]};}
  if(sql==='ROLLBACK'){Object.assign(row,before);return {rows:[]};}
  if(sql==='COMMIT')return {rows:[]};
  if(sql.includes('FROM public.ws_users')&&sql.includes('FOR UPDATE')){
   assert.equal(params[0],userId);
   return {rows:[{password_hash:row.password_hash,session_version:row.session_version}]};
  }
  if(sql.includes('UPDATE public.ws_users')){
   assert.equal(params[0],userId);
   assert.equal(params.length,1,'revoke action must not update password hashes');
   row.session_version++;
   return {rows:[{session_version:row.session_version}]};
  }
  throw Error('Unexpected query: '+sql);
 };
 const db={connect:async()=>({query,release(){}})};
 const service=createPlayerPasswordService({
  db,hashPassword,verifyPassword,
  requirePlayer:async req=>req.actor,
  expectedOrigin:origin,getIp:()=> '203.0.113.24',
  throttle:async ip=>{
   if((attempts.get(ip)||0)>=10)throw Object.assign(Error('Rate limited'),{status:429});
  },
  recordFailure:async ip=>{attempts.set(ip,(attempts.get(ip)||0)+1);},
  clearFailures:async ip=>attempts.delete(ip)
 });
 return {service,row,queries,attempts,passwordHash};
}

test('UX41 guest/admin/stale identity, foreign actor and cross-origin cannot revoke',async()=>{
 const f=fixture();
 for(const person of [null,{role:'guest',id:userId},{role:'admin',id:userId},
  {...actor,session_version:undefined}]){
  await assert.rejects(()=>f.service.revokeSessions(request(person),input()),e=>e.status===401);
 }
 await assert.rejects(
  ()=>f.service.revokeSessions(request(actor,null),input()),e=>e.status===403);
 await assert.rejects(
  ()=>f.service.revokeSessions(request(actor,'https://attacker.example'),input()),
  e=>e.status===403);
 await assert.rejects(
  ()=>f.service.revokeSessions(request(),input(randomUUID())),e=>e.status===409);
 assert.equal(f.queries.length,0);
});

test('UX41 requires explicit all-device confirmation and a plausible current password',async()=>{
 const f=fixture();
 for(const invalid of [
  {...input(),confirm_revoke_all:false},
  {...input(),confirm_revoke_all:'true'},
  {...input(),current_password:''},
  {...input(),current_password:'A'.repeat(1025)},
  null,[]
 ])await assert.rejects(()=>f.service.revokeSessions(request(),invalid));
 assert.equal(f.row.session_version,2);
 assert.equal(f.queries.length,0);
});

test('UX41 wrong password records failed attempts with transaction rollback and throttles',async()=>{
 const f=fixture();
 for(let i=0;i<10;i++)
  await assert.rejects(
   ()=>f.service.revokeSessions(request(),{...input(),current_password:'Incorrect!'}),
   e=>e.status===403);
 await assert.rejects(()=>f.service.revokeSessions(request(),input()),e=>e.status===429);
 assert.equal(f.row.session_version,2);
 assert.equal(f.queries.filter(q=>q.sql==='ROLLBACK').length,10);
 assert.ok(f.queries.every(q=>!q.sql.includes('UPDATE public.ws_users')));
 assert.equal(f.attempts.get('203.0.113.24'),10);
});

test('UX41 revokes all devices but preserves password, password-change date, XP and streak',async()=>{
 const f=fixture();
 const reply=await f.service.revokeSessions(request(),input());
 assert.deepEqual(reply,{
  ok:true,sessions_revoked:true,reauth_required:true,password_unchanged:true
 });
 assert.equal(f.row.session_version,3);
 assert.equal(f.row.password_hash,f.passwordHash);
 assert.equal(verifyPassword(knownPassword,f.row.password_hash),true);
 assert.equal(f.row.password_changed_at,null);
 assert.equal(f.row.xp,145);
 assert.equal(f.row.streak,5);
 assert.equal(isSessionVersionCurrent(actor,f.row),false);
 assert.equal(isSessionVersionCurrent({...actor,session_version:3},f.row),true);
 assert.equal(f.queries.filter(q=>q.sql==='COMMIT').length,1);
 assert.ok(f.queries.some(q=>q.sql.includes('FOR UPDATE')));
 assert.ok(f.queries.some(q=>q.sql.includes('session_version=session_version+1')));
 assert.ok(f.queries.every(q=>!/ws_learning|ws_srs|ws_solo_runs|ws_words|password_changed_at=|SET password_hash=/.test(q.sql)));
 assert.equal(f.attempts.size,0);
 assert.doesNotMatch(JSON.stringify(reply),/scrypt|hash|secret|token|username/);
});

test('UX41 stale token is rejected under row lock if another device has already revoked',async()=>{
 const f=fixture();f.row.session_version=3;
 await assert.rejects(()=>f.service.revokeSessions(request(),input()),e=>e.status===401);
 assert.equal(f.row.session_version,3);
 assert.equal(f.queries.filter(q=>q.sql==='ROLLBACK').length,1);
 assert.equal(f.queries.some(q=>q.sql.includes('UPDATE public.ws_users')),false);
});

test('UX41 route and UI preserve the shared account security and logout contract',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../lib/player-password-service.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
 const gui=readFileSync(new URL('../public/account.js',import.meta.url),'utf8');
 assert.match(api,/key==='auth\/revoke-sessions'/);
 assert.match(api,/playerPasswordService\(\)\.revokeSessions\(req,body\(req,2048\)\)/);
 assert.match(api,/res\.setHeader\('set-cookie',cookie\(AUTH_COOKIE,'',0\)\)/);
 assert.match(service,/assertPlayerPasswordOrigin\(req,expectedOrigin\)/);
 assert.match(service,/WHERE id=\$1::uuid FOR UPDATE/);
 assert.match(gui,/expected_actor_id:actorId/);
 assert.match(gui,/confirm_revoke_all:true/);
 assert.match(gui,/password_unchanged!==true/);
 assert.match(html,/id="ws41Form"/);
 assert.match(html,/id="ws41Current"/);
 assert.match(html,/id="ws41Confirm"[^>]*required/);
 assert.match(html,/autocomplete="current-password"/);
 assert.match(html,/id="ws41Done"/);
 assert.match(html,/id="ws40Form"/);
 assert.doesNotMatch(gui,/localStorage|sessionStorage|innerHTML|sendBeacon/);
});
