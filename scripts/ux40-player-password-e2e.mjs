/* UX40 isolated PostgreSQL17 + Chromium/Firefox account security acceptance.
 * Data writes are confined to 127.0.0.1:5547/wordsky_v6_test.
 * Never exercise this script against a Vercel or Production database.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const BASE='http://localhost:3000';
const OLD_A='OldPlayerPassword2026!';
const NEW_A='NewPlayerPassword2027!';
const OLD_B='OtherPlayerPassword2026!';
const url=new URL(process.env.DATABASE_URL||'http://invalid');
assert.equal(url.hostname,'127.0.0.1');
assert.equal(url.port,'5547');
assert.equal(url.pathname,'/wordsky_v6_test');
const pool=new pg.Pool({connectionString:url.toString(),ssl:false});
let chromiumBrowser,firefoxBrowser,accountA,accountB;
const contexts=[];
const pass=message=>console.log('PASS: UX40 '+message);
async function signin(ctx,user,password,status=200){
 const result=await ctx.request.post(BASE+'/api/auth/login',{
  headers:{origin:BASE},data:{username:user,password}
 });
 assert.equal(result.status(),status,'Unexpected login status for QA account');
 return result;
}
async function change(ctx,body,origin=BASE){
 const headers=origin===null?{}:{origin};
 return ctx.request.post(BASE+'/api/auth/change-password',{headers,data:body});
}
const post=(current=OLD_A,next=NEW_A,identity=accountA?.id)=>({
 expected_actor_id:identity,current_password:current,
 new_password:next,confirm_password:next
});
try{
 const dbName=(await pool.query('SELECT current_database() AS db')).rows[0].db;
 assert.equal(dbName,'wordsky_v6_test');
 const suffix=randomBytes(6).toString('hex');
 const nameA='qa40a'+suffix,nameB='qa40b'+suffix;
 const a=await pool.query(
  'INSERT INTO ws_users(username,display_name,password_hash,xp,streak) '+
  'VALUES($1,$2,$3,$4,$5) RETURNING id',
  [nameA,'UX40 Test Player A',hashPassword(OLD_A),135,3]);
 accountA={id:a.rows[0].id,username:nameA};
 const b=await pool.query(
  'INSERT INTO ws_users(username,display_name,password_hash) '+
  'VALUES($1,$2,$3) RETURNING id',
  [nameB,'UX40 Test Player B',hashPassword(OLD_B)]);
 accountB={id:b.rows[0].id,username:nameB};
 const word=await pool.query('SELECT id FROM ws_words WHERE enabled=true LIMIT 1');
 assert.equal(word.rows.length,1,'Seeded vocabulary is required for preservation test');
 await pool.query(
  'INSERT INTO ws_learning_word_progress(user_id,word_id,remembered,review_count) VALUES($1,$2,true,2)',
  [accountA.id,word.rows[0].id]);

 chromiumBrowser=await chromium.launch({headless:true});
 firefoxBrowser=await firefox.launch({headless:true});
 const chrome=await chromiumBrowser.newContext({viewport:{width:360,height:780}});
 const fox=await firefoxBrowser.newContext({viewport:{width:390,height:780}});
 const other=await chromiumBrowser.newContext({viewport:{width:390,height:780}});
 const guest=await firefoxBrowser.newContext();
 contexts.push(chrome,fox,other,guest);

 const guestPage=await guest.newPage();
 assert.equal((await guestPage.goto(BASE+'/account.html')).status(),200);
 await guestPage.locator('#ws40Guest').waitFor({state:'visible'});
 assert.equal(await guestPage.locator('#ws40Form').isVisible(),false);
 assert.equal((await change(guest,post())).status(),401);
 pass('guests cannot change password or see private account form');

 await signin(chrome,nameA,OLD_A);
 await signin(fox,nameA,OLD_A);
 await signin(other,nameB,OLD_B);
 const meA=await chrome.request.get(BASE+'/api/auth/me');
 assert.equal((await meA.json()).actor?.id,accountA.id);
 const meB=await other.request.get(BASE+'/api/auth/me');
 assert.equal((await meB.json()).actor?.id,accountB.id);

 const page=await chrome.newPage();
 await page.goto(BASE+'/account.html');
 await page.locator('#ws40Form').waitFor({state:'visible'});
 assert.equal(await page.locator('#ws40Username').inputValue(),nameA);
 assert.ok((await page.locator('#ws40Identity').textContent()).includes(nameA));
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<=1,'Account form overflows 360px viewport '+overflow);
 const page2=await fox.newPage();
 await page2.goto(BASE+'/account.html');
 await page2.locator('#ws40Form').waitFor({state:'visible'});
 assert.equal(await page2.locator('#ws40Username').inputValue(),nameA);
 const overflow2=await page2.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow2<=1,'Account form overflows 390px viewport '+overflow2);
 pass('Chromium/Firefox mobile account form and owner identity');

 // Existing second player's login must not authorize changing the first player's password.
 assert.equal((await change(other,post(OLD_B,NEW_A,accountA.id))).status(),409);
 assert.equal((await change(chrome,post(),null)).status(),403);
 assert.equal((await change(chrome,post(),'https://attacker.example')).status(),403);
 assert.equal((await change(chrome,{...post(),confirm_password:'mismatch'})).status(),400);
 assert.equal((await change(chrome,post('wrongcurrentpassword'))).status(),403);
 let v=(await pool.query('SELECT session_version FROM ws_users WHERE id=$1',[accountA.id])).rows[0].session_version;
 assert.equal(v,0);
 assert.equal((await (await chrome.request.get(BASE+'/api/auth/me')).json()).actor?.id,accountA.id);
 pass('actor pin, strict Origin, password confirmation and wrong-current protection');

 // Change password through the real visible form, not just API client.
 await page.locator('#ws40Current').fill(OLD_A);
 await page.locator('#ws40New').fill(NEW_A);
 await page.locator('#ws40Confirm').fill(NEW_A);
 await page.locator('#ws40Submit').click();
 await page.locator('#ws40Done').waitFor({state:'visible'});
 assert.equal(await page.locator('#ws40Form').isVisible(),false);
 assert.equal(await page.locator('#ws40Current').inputValue(),'');
 assert.equal((await (await chrome.request.get(BASE+'/api/auth/me')).json()).actor,null);
 assert.equal((await (await fox.request.get(BASE+'/api/auth/me')).json()).actor,null);
 assert.equal((await fox.request.get(BASE+'/api/learning/flashcards/progress')).status(),401);
 assert.equal((await change(fox,post())).status(),401);
 assert.equal((await (await other.request.get(BASE+'/api/auth/me')).json()).actor.id,accountB.id);
 pass('new password revokes both old browser sessions, not another user');

 assert.equal((await signin(guest,nameA,OLD_A,401)).status(),401);
 await signin(guest,nameA,NEW_A);
 const newActor=(await (await guest.request.get(BASE+'/api/auth/me')).json()).actor;
 assert.equal(newActor?.id,accountA.id);
 const dbRow=(await pool.query(
  'SELECT xp,streak,session_version,password_changed_at FROM ws_users WHERE id=$1',
  [accountA.id])).rows[0];
 assert.equal(dbRow.session_version,1);
 assert.ok(dbRow.password_changed_at);
 assert.equal(dbRow.xp,135);
 assert.equal(dbRow.streak,3);
 const saved=(await pool.query(
  'SELECT remembered,review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',
  [accountA.id,word.rows[0].id])).rows[0];
 assert.deepEqual(saved,{remembered:true,review_count:2});
 pass('old password rejected; new password accepted; XP/streak/learning retained');

 // A separate registered account can access the account page and log out as usual.
 await page2.goto(BASE+'/account.html');
 await page2.locator('#ws40Guest').waitFor({state:'visible'});
 await page2.locator('#ws40Guest a').click();
 assert.equal(new URL(page2.url()).pathname,'/');
 console.log('\nUX40 ISOLATED PLAYER PASSWORD CHANGE E2E: PASS');
}catch(error){
 console.error('\nUX40 ISOLATED PLAYER PASSWORD CHANGE E2E: FAIL\n'+(error.stack||error));
 process.exitCode=1;
}finally{
 await Promise.allSettled(contexts.map(ctx=>ctx.close()));
 await Promise.allSettled([chromiumBrowser?.close(),firefoxBrowser?.close()]);
 try{
  if(accountA)await pool.query('DELETE FROM ws_users WHERE id=$1',[accountA.id]);
  if(accountB)await pool.query('DELETE FROM ws_users WHERE id=$1',[accountB.id]);
 }catch(e){console.error('UX40 disposable player cleanup failed',e.message);process.exitCode=1;}
 await pool.end();
 console.log('UX40 isolated QA cleanup completed');
}
