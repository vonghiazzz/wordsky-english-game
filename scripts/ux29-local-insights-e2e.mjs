/* UX29 isolated analytics E2E. Only 127.0.0.1:5547/wordsky_v6_test.
 * All generated QA accounts, solo runs and review events are disposed.
 */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const BASE='http://localhost:3000';
const url=new URL(process.env.DATABASE_URL||'');
assert.equal(url.hostname,'127.0.0.1');
assert.equal(url.port,'5547');
assert.equal(url.pathname,'/wordsky_v6_test');
const db=new pg.Pool({connectionString:url.toString(),ssl:false});
const createdUsers=[],createdRuns=[];
let chrome,fox;
const pass=msg=>console.log('PASS: UX29 '+msg);

async function account(){
 const username='qa29'+randomBytes(6).toString('hex');
 const password=randomBytes(14).toString('hex');
 const row=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
  [username,'UX29 isolated QA',hashPassword(password)]
 );
 const user={id:row.rows[0].id,username,password};
 createdUsers.push(user.id);
 return user;
}
async function login(ctx,user){
 const response=await ctx.request.post(BASE+'/api/auth/login',{
  headers:{origin:BASE},data:{username:user.username,password:user.password}
 });
 assert.equal(response.status(),200,await response.text());
 const me=await ctx.request.get(BASE+'/api/auth/me');
 assert.equal((await me.json()).actor?.id,user.id);
}
async function save(ctx,user,source,wordId,remembered,count){
 const response=await ctx.request.post(BASE+'/api/learning/reviews',{
  headers:{origin:BASE},
  data:{source,word_id:wordId,remembered,request_id:randomUUID(),
   expected_actor_id:user.id,expected_review_count:count}
 });
 assert.equal(response.status(),201,await response.text());
}
async function solo(userId,mode){
 const state={mode,status:'FAILED',health:0,score:0,correct:0,mistakes:1,
  wrongWordIds:[],startedAt:Date.now()-30000,endsAt:Date.now()-10000,
  pairs:[],distractors:[],bombs:[],levels:[],index:0};
 const r=await db.query(
  'INSERT INTO ws_solo_runs(user_id,access_token_hash,client_fingerprint_hash,'+
  'mode,difficulty,duration_seconds,question_count,points_per_correct,penalty,'+
  'status,health,score,correct,mistakes,state,finished_at) '+
  "VALUES($1,$2,$3,$4,'EASY',90,3,100,25,'FAILED',0,0,0,1,$5::jsonb,now()) RETURNING id",
  [userId,randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),
   mode,JSON.stringify(state)]
 );
 createdRuns.push(r.rows[0].id);
 return r.rows[0].id;
}

try{
 const name=(await db.query('SELECT current_database() AS name')).rows[0].name;
 assert.equal(name,'wordsky_v6_test');
 const words=(await db.query(
  "SELECT id,english,meaning FROM ws_words WHERE enabled=true AND trim(meaning)<>'' ORDER BY id LIMIT 3"
 )).rows;
 assert.equal(words.length,3);
 const [wordA,wordB,wordC]=words;
 const owner=await account(),other=await account();
 const personal=(await db.query(
  "INSERT INTO ws_personal_cards(user_id,topic,english,meaning) VALUES($1,$2,$3,$4) RETURNING id",
  [owner.id,'UX29 Insights Private','observation','sự quan sát']
 )).rows[0];

 chrome=await chromium.launch({headless:true});
 fox=await firefox.launch({headless:true});
 const ctxA=await chrome.newContext({viewport:{width:360,height:780}});
 const ctxA2=await fox.newContext({viewport:{width:390,height:844}});
 const ctxB=await chrome.newContext({viewport:{width:390,height:844}});
 const ctxGuest=await fox.newContext();
 await Promise.all([login(ctxA,owner),login(ctxA2,owner),login(ctxB,other)]);

 const guestApi=await ctxGuest.request.get(BASE+'/api/learning/insights?days=7');
 assert.equal(guestApi.status(),401);
 for(const value of ['999','0','07','30%20','-1']){
  const res=await ctxA.request.get(BASE+'/api/learning/insights?days='+value);
  assert.equal(res.status(),400);
 }
 const guestPage=await ctxGuest.newPage();
 await guestPage.goto(BASE+'/progress.html');
 assert.equal(await guestPage.locator('#ws29Insights').isVisible(),false);
 pass('unauthenticated analytics denied, window allowlist enforced');

 await save(ctxA,owner,'shared',wordA.id,false,0);
 await save(ctxA,owner,'shared',wordA.id,false,1);
 await save(ctxA,owner,'shared',wordB.id,true,0);
 await save(ctxA,owner,'personal',personal.id,false,0);
 await save(ctxB,other,'shared',wordC.id,true,0);
 await solo(owner.id,'MATCH');
 await solo(other.id,'BOMB');

 const apiA=await ctxA.request.get(BASE+'/api/learning/insights?days=7');
 const apiB=await ctxB.request.get(BASE+'/api/learning/insights?days=7&user_id='+owner.id);
 assert.equal(apiA.status(),200,await apiA.text());
 assert.equal(apiB.status(),200,await apiB.text());
 const dataA=await apiA.json(),dataB=await apiB.json();
 assert.equal(dataA.actor_id,owner.id);
 assert.equal(dataB.actor_id,other.id);
 assert.equal(dataA.scope,'account-learning-insights');
 assert.equal(dataA.time_zone,'Asia/Ho_Chi_Minh');
 assert.equal(dataA.daily.length,7);
 assert.equal(dataA.daily.at(-1).day,dataA.period.to);
 assert.deepEqual({
  reviews:dataA.summary.reviews,markedRemembered:dataA.summary.marked_remembered,
  markRate:dataA.summary.remembered_mark_rate,activeDays:dataA.summary.active_days,
  need:dataA.summary.current_need_review,known:dataA.summary.current_known,
  solo:dataA.summary.solo_runs
 },{reviews:4,markedRemembered:1,markRate:25,activeDays:1,need:2,known:1,solo:1});
 assert.equal(dataA.focus_words[0].word_id,wordA.id);
 assert.equal(dataA.focus_words[0].need_review_marks,2);
 assert.ok(dataA.focus_words.some(w=>w.word_id===personal.id&&w.source==='personal'));
 assert.ok(dataB.focus_words.every(w=>w.word_id!==wordA.id&&w.word_id!==personal.id));
 assert.equal(dataB.summary.reviews,1);
 assert.equal(dataB.summary.current_known,1);
 assert.equal(dataB.summary.current_need_review,0);
 assert.deepEqual(dataA.solo_modes.map(x=>x.runs),[1,0,0]);
 assert.deepEqual(dataB.solo_modes.map(x=>x.runs),[0,1,0]);
 pass('PostgreSQL truth: two source histories, weak words and Solo are actor-scoped');

 const A=await ctxA.newPage(),A2=await ctxA2.newPage(),B=await ctxB.newPage();
 await Promise.all([
  A.goto(BASE+'/progress.html'),A2.goto(BASE+'/progress.html'),
  B.goto(BASE+'/progress.html')
 ]);
 for(const page of [A,A2,B])
  await page.locator('#ws29Insights').waitFor({state:'visible'});
 assert.equal(await A.locator('#ws29Reviews').textContent(),'4');
 assert.equal(await A2.locator('#ws29Reviews').textContent(),'4');
 assert.equal(await B.locator('#ws29Reviews').textContent(),'1');
 assert.match(await A.locator('#ws29Words').textContent(),/observation/);
 assert.doesNotMatch(await B.locator('#ws29Words').textContent(),/observation/);
 assert.equal(await A.locator('#ws29Chart [role="listitem"]').count(),7);
 assert.equal(await A.locator('a[href="/mistakes.html"],a[href="/practice.html"]').count(),0);
 const mobile=await A.evaluate(()=>({
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  chartRegion:document.getElementById('ws29Chart').parentElement.clientWidth
 }));
 assert.ok(mobile.overflow<=1,'insights page overflows at 360px: '+JSON.stringify(mobile));
 assert.ok(mobile.chartRegion>0);
 pass('Chromium/Firefox identical account analytics; another account never sees private words');

 await A.locator('#ws29Days30').click();
 await A.locator('#ws29Chart [role="listitem"]').last().waitFor();
 await A.waitForFunction(()=>document.querySelectorAll('#ws29Chart [role="listitem"]').length===30);
 assert.equal(await A.locator('#ws29Days30').getAttribute('aria-pressed'),'true');
 assert.equal(await A.locator('#ws29Chart [role="listitem"]').count(),30);
 assert.equal(await A.locator('#ws29Reviews').textContent(),'4');
 const mobile30=await A.evaluate(()=>({
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  scrollable:document.getElementById('ws29Chart').scrollWidth >
             document.getElementById('ws29Chart').parentElement.clientWidth
 }));
 assert.ok(mobile30.overflow<=1,'30-day chart causes horizontal page scroll');
 assert.equal(mobile30.scrollable,true);
 pass('7/30 day switch and horizontal chart scroll work at 360px');

 await save(ctxA2,owner,'shared',wordA.id,true,2);
 await A.reload();
 await A.locator('#ws29Insights').waitFor({state:'visible'});
 await A.locator('#ws29Reviews').getByText('5').waitFor({state:'visible'});
 assert.equal(await A.locator('#ws29CurrentNeed').textContent(),'1');
 assert.equal(await A.locator('#ws29Remembered').textContent(),'40%');
 assert.equal((await A.locator('#ws29Words').textContent()).includes(wordA.english),false);
 assert.match(await A.locator('#ws29Words').textContent(),/observation/);
 pass('new review on Firefox updates Chromium stats, focus and current progress');

 // Re-authenticate the same browser as another user. A stale panel must not
 // reveal data for the old actor after navigation or tab reactivation.
 await login(ctxA,other);
 await A.reload();
 await A.locator('#ws29Insights').waitFor({state:'visible'});
 assert.equal(await A.locator('#ws29Reviews').textContent(),'1');
 assert.equal((await A.locator('#ws29Words').textContent()).includes('observation'),false);
 assert.equal(await A.locator('#ws29CurrentNeed').textContent(),'0');
 pass('login switch clears all previous account report state');

 const history=(await db.query('SELECT count(*)::int n FROM ws_learning_review_requests WHERE user_id=$1',[owner.id])).rows[0].n;
 assert.equal(history,5,'insights did not write additional review events');
 pass('analytics GET never mutates ledger or progress');
 await Promise.allSettled([ctxA.close(),ctxA2.close(),ctxB.close(),ctxGuest.close()]);
 console.log('\nUX29 LOCAL LEARNING INSIGHTS QA: PASS');
}catch(error){
 console.error('\nUX29 LOCAL LEARNING INSIGHTS QA: FAIL\n'+(error.stack||error));
 process.exitCode=1;
}finally{
 await Promise.allSettled([chrome?.close(),fox?.close()]);
 if(createdRuns.length){
  try{await db.query('DELETE FROM ws_solo_runs WHERE id=ANY($1::uuid[])',[createdRuns]);}
  catch(error){console.error('UX29 solo cleanup failed',error.message);process.exitCode=1;}
 }
 if(createdUsers.length){
  try{await db.query('DELETE FROM ws_users WHERE id=ANY($1::uuid[])',[createdUsers]);}
  catch(error){console.error('UX29 actor cleanup failed',error.message);process.exitCode=1;}
 }
 await db.end();
 console.log('UX29 isolated QA cleanup completed');
}
