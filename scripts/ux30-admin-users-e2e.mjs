/* UX30 browser acceptance: disposable PostgreSQL17 and Chromium/Firefox.
 * This never connects to Supabase Production or exposes password values.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const BASE='http://localhost:3000';
const ADMIN_PASSWORD='WordSkyAdminQa_2026!';
const OLD_PASSWORD='OldUserPassword2026!';
const NEW_PASSWORD='NewUserPassword2026!';
const dbUrl=new URL(process.env.DATABASE_URL||'');
assert.equal(dbUrl.hostname,'127.0.0.1');
assert.equal(dbUrl.port,'5547');
assert.equal(dbUrl.pathname,'/wordsky_v6_test');
const db=new pg.Pool({connectionString:dbUrl.toString(),ssl:false});
let chrome,fox,targetId;
const pass=message=>console.log('PASS: UX30 '+message);
async function login(ctx,username,password,status=200){
 const resp=await ctx.request.post(BASE+'/api/auth/login',{
  data:{username,password},headers:{origin:BASE}
 });
 assert.equal(resp.status(),status,await resp.text());
 return resp;
}
async function reset(ctx,id,password=NEW_PASSWORD,extras={}){
 return ctx.request.post(BASE+'/api/admin/users/'+id+'/reset-password',{
  headers:{origin:BASE},data:{
   confirm_username:extras.username||extras.accountName,
   new_password:password,
   confirm_password:extras.confirm_password||password,
   admin_password:extras.admin_password||ADMIN_PASSWORD
  }
 });
}
try{
 assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name,'wordsky_v6_test');
 const username='qa30'+randomBytes(5).toString('hex');
 const created=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
  [username,'UX30 QA Learner',hashPassword(OLD_PASSWORD)]
 );
 targetId=created.rows[0].id;
 const envHasSchema=await db.query(
  "SELECT session_version FROM ws_users WHERE id=$1",[targetId]);
 assert.equal(envHasSchema.rows[0].session_version,0);
 const adminAudit=await db.query(
  "SELECT to_regclass('public.ws_admin_password_reset_audit')::text AS name");
 assert.equal(adminAudit.rows[0].name,'ws_admin_password_reset_audit');

 chrome=await chromium.launch({headless:true});
 fox=await firefox.launch({headless:true});
 const adminCtx=await chrome.newContext({viewport:{width:360,height:780}});
 const playerCtx=await fox.newContext({viewport:{width:390,height:780}});
 const guestCtx=await fox.newContext();
 const guest=await guestCtx.request.get(BASE+'/api/admin/users?q='+username);
 assert.equal(guest.status(),401);
 await login(playerCtx,username,OLD_PASSWORD);
 const playerListing=await playerCtx.request.get(BASE+'/api/admin/users');
 assert.equal(playerListing.status(),401);
 const guestHistory=await guestCtx.request.get(BASE+'/api/admin/users/reset-history?q='+username);
 const playerHistory=await playerCtx.request.get(BASE+'/api/admin/users/reset-history?q='+username);
 assert.equal(guestHistory.status(),401);
 assert.equal(playerHistory.status(),401);
 pass('guests and players cannot read Admin account list or security history');

 const signin=await login(adminCtx,'owner',ADMIN_PASSWORD);
 assert.equal((await signin.json()).role,'admin');
 const list=await adminCtx.request.get(BASE+'/api/admin/users?q='+username+'&page=0&size=20');
 assert.equal(list.status(),200,await list.text());
 const data=await list.json();
 assert.equal(data.total,1);
 assert.equal(data.users.length,1);
 assert.equal(data.users[0].username,username);
 assert.equal('password_hash' in data.users[0],false);
 assert.equal('session_version' in data.users[0],false);
 const beforeHistory=await adminCtx.request.get(BASE+'/api/admin/users/reset-history?q='+username+'&page=0&size=20');
 assert.equal(beforeHistory.status(),200,await beforeHistory.text());
 assert.equal((await beforeHistory.json()).total,0);
 pass('Admin can search account without exposing credential fields');

 const page=await adminCtx.newPage();
 await page.goto(BASE+'/admin-users.html');
 await page.locator('#auApp').waitFor({state:'visible'});
 await page.locator('#auSearch').fill(username);
 await page.locator('#auSearchForm button[type=submit]').click();
 await page.locator('.au-user').waitFor({state:'visible'});
 assert.equal(await page.locator('.au-user').count(),1);
 const screen=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(screen<=1,'Admin 360px overflow '+screen);
 await page.locator('.au-user button').click();
 await page.locator('#auDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#auConfirmUsername').inputValue(),'');
 await page.locator('#auCancel').click();
 pass('mobile Admin search and reset confirmation render without overflow');

 const denied=await reset(playerCtx,targetId,undefined,{username});
 assert.equal(denied.status(),401);
 const wrongAdmin=await reset(adminCtx,targetId,NEW_PASSWORD,{username,admin_password:'wrong'});
 assert.equal(wrongAdmin.status(),403);
 const noOrigin=await adminCtx.request.post(BASE+'/api/admin/users/'+targetId+'/reset-password',{
  data:{confirm_username:username,new_password:NEW_PASSWORD,confirm_password:NEW_PASSWORD,admin_password:ADMIN_PASSWORD}
 });
 assert.equal(noOrigin.status(),403);
 const mismatched=await reset(adminCtx,targetId,NEW_PASSWORD,{username,confirm_password:'not the same'});
 assert.equal(mismatched.status(),400);
 const short=await reset(adminCtx,targetId,'short12',{username});
 assert.equal(short.status(),400);
 const wrongName=await reset(adminCtx,targetId,NEW_PASSWORD,{username:'somebodyelse'});
 assert.equal(wrongName.status(),400);
 assert.equal((await db.query('SELECT session_version FROM ws_users WHERE id=$1',[targetId])).rows[0].session_version,0);
 pass('origin, step-up Admin proof, username and password policy fail closed');

 const before=await playerCtx.request.get(BASE+'/api/auth/me');
 assert.equal((await before.json()).actor?.profile?.username,username);
 const result=await reset(adminCtx,targetId,NEW_PASSWORD,{username});
 assert.equal(result.status(),200,await result.text());
 const ack=await result.json();
 assert.deepEqual(ack,{ok:true,username,sessions_revoked:true});
 assert.equal((await db.query('SELECT session_version FROM ws_users WHERE id=$1',[targetId])).rows[0].session_version,1);
 const after=await playerCtx.request.get(BASE+'/api/auth/me');
 assert.equal((await after.json()).actor,null);
 const oldPrivate=await playerCtx.request.get(BASE+'/api/learning/flashcards/progress');
 assert.equal(oldPrivate.status(),401);
 const oldSolo=await playerCtx.request.post(BASE+'/api/solo/match/start',{
  headers:{origin:BASE},data:{difficulty:'EASY',question_count:3,duration_seconds:90}
 });
 // Solo is playable by guests. A revoked login must NOT re-attribute a run to the old account.
 if(oldSolo.status()===201){
  const runId=(await oldSolo.json()).runId;
  const row=await db.query('SELECT user_id FROM ws_solo_runs WHERE id=$1',[runId]);
  assert.equal(row.rows[0].user_id,null);
  await db.query('DELETE FROM ws_solo_runs WHERE id=$1',[runId]);
 }
 pass('password reset atomically revokes old player session and protected endpoints');

 const oldPasswordLogin=await login(await fox.newContext(),username,OLD_PASSWORD,401);
 assert.equal(oldPasswordLogin.status(),401);
 const freshCtx=await chrome.newContext();
 await login(freshCtx,username,NEW_PASSWORD);
 const freshMe=await freshCtx.request.get(BASE+'/api/auth/me');
 assert.equal((await freshMe.json()).actor?.profile?.username,username);
 const audit=await db.query(
  'SELECT admin_username,target_user_id FROM ws_admin_password_reset_audit WHERE target_user_id=$1',[targetId]);
 assert.equal(audit.rows.length,1);
 assert.equal(audit.rows[0].admin_username,'owner');
 pass('old password denied; new password accepted; audit entry contains no secrets');

 const historyResponse=await adminCtx.request.get(
  BASE+'/api/admin/users/reset-history?q='+username+'&page=0&size=20');
 assert.equal(historyResponse.status(),200,await historyResponse.text());
 const history=await historyResponse.json();
 assert.equal(history.total,1);
 assert.equal(history.events.length,1);
 assert.equal(history.events[0].target_username,username);
 assert.equal(history.events[0].admin_username,'owner');
 assert.ok(history.events[0].created_at);
 assert.doesNotMatch(JSON.stringify(history),/password_hash|new_password|admin_password|session_version/);
 await page.locator('#auHistorySection').waitFor({state:'visible'});
 await page.locator('#auHistorySearch').fill(username);
 await page.locator('#auHistoryForm button[type=submit]').click();
 await page.locator('.au-history-item').waitFor({state:'visible'});
 assert.ok((await page.locator('.au-history-item').first().innerText()).includes(username));
 assert.ok((await page.locator('.au-history-item').first().innerText()).includes('owner'));
 const historyOverflow=await page.evaluate(
  ()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(historyOverflow<=1,'Admin audit history 360px overflow '+historyOverflow);
 pass('Admin read-only audit history, isolated search and mobile rendering');
 await Promise.allSettled([adminCtx.close(),playerCtx.close(),guestCtx.close(),freshCtx.close()]);
 console.log('\nUX30 ISOLATED ADMIN USERS / PASSWORD RESET E2E: PASS');
}catch(error){
 console.error('\nUX30 ISOLATED ADMIN USERS / PASSWORD RESET E2E: FAIL\n'+(error.stack||error));
 process.exitCode=1;
}finally{
 await Promise.allSettled([chrome?.close(),fox?.close()]);
 if(targetId){
  try{await db.query('DELETE FROM ws_users WHERE id=$1',[targetId])}
  catch(error){console.error('UX30 account cleanup failed',error.message);process.exitCode=1}
 }
 await db.end();
 console.log('UX30 isolated QA cleanup completed');
}
