/* UX28 real account practice acceptance against ISOLATED PostgreSQL only.
 * Reject non-local DB URL before connecting. Never use Production credentials.
 */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const ORIGIN='http://localhost:3000';
const url=new URL(process.env.DATABASE_URL||'');
assert.equal(url.hostname,'127.0.0.1');
assert.equal(url.port,'5547');
assert.equal(url.pathname,'/wordsky_v6_test');
const db=new pg.Pool({connectionString:url.toString(),ssl:false});
const createdUsers=[],createdRuns=[];
let chrome,fox;
const pass=what=>console.log('PASS: UX28 '+what);

async function createAccount(){
 const username='qa28'+randomBytes(6).toString('hex'),password=randomBytes(16).toString('hex');
 const r=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
  [username,'UX28 isolated test',hashPassword(password)]
 );
 const account={id:r.rows[0].id,username,password};
 createdUsers.push(account.id);
 return account;
}
async function createFinishedRun(userId,ids,mode){
 const state={mode,status:'FAILED',score:0,health:0,correct:0,mistakes:1,
  wrongWordIds:ids,startedAt:Date.now()-60000,endsAt:Date.now()-30000,
  pairs:[],distractors:[]};
 const r=await db.query(
  'INSERT INTO ws_solo_runs (user_id,access_token_hash,client_fingerprint_hash,'+
  'mode,difficulty,duration_seconds,question_count,points_per_correct,penalty,'+
  'status,health,score,correct,mistakes,state,finished_at) '+
  "VALUES($1,$2,$3,$4,'EASY',90,3,100,25,'FAILED',0,0,0,1,$5::jsonb,now()) RETURNING id",
  [userId,randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),mode,JSON.stringify(state)]
 );
 createdRuns.push(r.rows[0].id);
 return r.rows[0].id;
}
async function login(context,user){
 const response=await context.request.post(ORIGIN+'/api/auth/login',{
  headers:{origin:ORIGIN},data:{username:user.username,password:user.password}
 });
 assert.equal(response.status(),200,await response.text());
 const me=await context.request.get(ORIGIN+'/api/auth/me');
 assert.equal((await me.json()).actor?.id,user.id);
}
async function getProgress(user,wordId){
 const r=await db.query(
  'SELECT remembered,review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',
  [user.id,wordId]
 );
 return r.rows[0]||null;
}
async function getCount(user,wordId){
 const r=await db.query(
  'SELECT count(*)::int AS n FROM ws_learning_review_requests WHERE user_id=$1 AND word_id=$2',
  [user.id,wordId]
 );
 return r.rows[0].n;
}
async function awaitProgress(user,wordId,count){
 const deadline=Date.now()+12000;
 while(Date.now()<deadline){
  const p=await getProgress(user,wordId);
  if(p?.review_count===count)return p;
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 throw new Error('Review count not committed for '+wordId+' count '+count);
}

try{
 const dbName=await db.query('SELECT current_database() AS name');
 assert.equal(dbName.rows[0].name,'wordsky_v6_test');
 const rows=await db.query(
  "SELECT id,english,meaning FROM ws_words WHERE enabled=true AND length(trim(meaning))>0 "+
  'ORDER BY id LIMIT 3'
 );
 assert.equal(rows.rows.length,3);
 const [first,second,third]=rows.rows;
 const byMeaning=new Map(rows.rows.map(w=>[w.meaning,w]));
 const userA=await createAccount(),userB=await createAccount();
 const runA=await createFinishedRun(userA.id,[first.id,second.id],'MATCH');
 const runB=await createFinishedRun(userB.id,[third.id],'BOMB');
 chrome=await chromium.launch({headless:true});
 fox=await firefox.launch({headless:true});
 const contextA=await chrome.newContext({viewport:{width:360,height:800}});
 const contextA2=await fox.newContext({viewport:{width:390,height:844}});
 const contextB=await chrome.newContext({viewport:{width:390,height:844}});
 const guest=await fox.newContext();
 await Promise.all([login(contextA,userA),login(contextA2,userA),login(contextB,userB)]);

 const guestPage=await guest.newPage();
 await guestPage.goto(ORIGIN+'/practice.html');
 await guestPage.locator('#ws28Guest').waitFor({state:'visible'});
 assert.equal(await guestPage.locator('#ws28Setup').isVisible(),false);
 pass('guests cannot access private recall cards');

 for(const [context,run] of [[contextA,runA],[contextB,runB]]){
  const response=await context.request.get(ORIGIN+'/api/solo/runs/'+run);
  assert.equal(response.status(),200,await response.text());
  assert.equal((await response.json()).reviewSync?.status,'synced');
 }
 const pA=await contextA.newPage();
 const pA2=await contextA2.newPage();
 const pB=await contextB.newPage();
 await Promise.all([
  pA.goto(ORIGIN+'/practice.html'),pA2.goto(ORIGIN+'/practice.html'),
  pB.goto(ORIGIN+'/practice.html')
 ]);
 for(const p of [pA,pA2,pB])
  await p.locator('#ws28Setup').waitFor({state:'visible'});
 assert.equal(await pA.locator('#ws28Total').textContent(),'2');
 assert.equal(await pA2.locator('#ws28Total').textContent(),'2');
 assert.equal(await pB.locator('#ws28Total').textContent(),'1');
 pass('same account syncs between Chromium and Firefox; other account isolated');

 const inaccessible=await contextB.newPage();
 await inaccessible.goto(ORIGIN+'/practice.html?word='+first.id);
 await inaccessible.locator('#ws28Setup').waitFor({state:'visible'});
 await inaccessible.locator('#ws28NoWords').waitFor({state:'visible'});
 assert.equal((await inaccessible.locator('body').textContent()).includes(first.english),false);
 pass('direct word link never reveals a foreign account word');

 await pA.locator('#ws28Start').click();
 await pA.locator('#ws28Play').waitFor({state:'visible'});
 let box=await pA.evaluate(()=>({
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  progress:document.querySelector('#ws28Progress').getAttribute('aria-valuemax')
 }));
 assert.ok(box.overflow<=1,'UX28 360px setup or play overflowing: '+JSON.stringify(box));
 assert.equal(box.progress,'2');
 const seen=[];
 // Simulate a lost response after the server successfully commits a review.
 let lost=false;
 await pA.route('**/api/learning/reviews',async route=>{
  if(!lost){
    lost=true;
    const saved=await route.fetch();
    assert.ok([200,201].includes(saved.status()),'the first server review must commit');
    await route.abort('failed');
  }else await route.continue();
 });
 const firstMeaning=await pA.locator('#ws28Meaning').textContent();
 const expectedFirst=byMeaning.get(firstMeaning);
 assert.ok(expectedFirst);
 assert.equal((await pA.locator('#ws28Question').count()),0);
 assert.equal((await pA.locator('#ws28Feedback').isVisible()),false,
   'answer feedback must be hidden before the learner attempts recall');
 seen.push(expectedFirst.id);
 await pA.locator('#ws28Skip').click();
 await pA.locator('#ws28Retry').waitFor({state:'visible'});
 assert.equal((await pA.locator('#ws28Notice').textContent()).includes('Chưa xác nhận lưu'),true);
 await pA.locator('#ws28Retry').click();
 await pA.locator('#ws28Next').waitFor({state:'visible'});
 assert.equal(await getCount(userA,expectedFirst.id),2,
   'one auto game review + one practice retry, never duplicate the lost response');
 const afterMiss=await awaitProgress(userA,expectedFirst.id,2);
 assert.equal(afterMiss.remembered,false);
 pass('lost HTTP response retries the same review ID exactly once');

 await pA.locator('#ws28Next').click();
 const secondMeaning=await pA.locator('#ws28Meaning').textContent();
 const expectedSecond=byMeaning.get(secondMeaning);
 assert.ok(expectedSecond&&!seen.includes(expectedSecond.id));
 seen.push(expectedSecond.id);
 await pA.locator('#ws28Answer').fill('  '+expectedSecond.english.toUpperCase()+'  ');
 await pA.locator('#ws28Check').click();
 await pA.locator('#ws28Next').waitFor({state:'visible'});
 const afterCorrect=await awaitProgress(userA,expectedSecond.id,2);
 assert.equal(afterCorrect.remembered,true);
 await pA.locator('#ws28Next').click();
 await pA.locator('#ws28Done').waitFor({state:'visible'});
 assert.equal(await pA.locator('#ws28CorrectCount').textContent(),'1');
 assert.equal(await pA.locator('#ws28DoneTotal').textContent(),'2');
 const summary=await pA.evaluate(()=>({
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
 }));
 assert.ok(summary.overflow<=1,'UX28 360px result overflow');
 pass('native keyboard recall correct/incorrect commits SRS and mobile UI stays usable');

 await pA2.goto(ORIGIN+'/mistakes.html');
 await pA2.locator('#ws27Account').waitFor({state:'visible'});
 await pA2.locator('#ws27Reload').click();
 await pA2.locator('[data-word-id="'+expectedFirst.id+'"] .ws27-state-due').waitFor();
 const otherCard=await pA2.locator('[data-word-id="'+expectedSecond.id+'"]').textContent();
 assert.match(otherCard,/Đã nhớ sau lần ôn/);
 pass('new reviews are visible on the second browser through one database');

 const srs=await db.query(
  "SELECT word_id::text,review_count,remembered FROM ws_user_srs_schedules "+
  "WHERE user_id=$1 AND source='shared' AND word_id=ANY($2::uuid[])",
  [userA.id,seen]
 );
 assert.equal(srs.rows.length,2);
 assert.ok(srs.rows.every(w=>w.review_count===2),'SRS schedule reflects each accepted review');
 pass('SRS shadow projection tracks the exact account review ledger');

 // Cross-device update after the question is displayed: the stale
 // expected_review_count must be rejected, not silently overwrite it.
 await pA.goto(ORIGIN+'/practice.html?word='+expectedSecond.id);
 await pA.locator('#ws28Setup').waitFor({state:'visible'});
 await pA.locator('#ws28Start').click();
 await pA.locator('#ws28Play').waitFor({state:'visible'});
 const concurrent=await contextA2.request.post(ORIGIN+'/api/learning/reviews',{
  headers:{origin:ORIGIN},
  data:{request_id:randomUUID(),source:'shared',word_id:expectedSecond.id,
    remembered:false,expected_review_count:2,expected_actor_id:userA.id}
 });
 assert.equal(concurrent.status(),201,await concurrent.text());
 await pA.locator('#ws28Answer').fill(expectedSecond.english);
 await pA.locator('#ws28Check').click();
 await pA.locator('#ws28Setup').waitFor({state:'visible'});
 const afterConflict=await getProgress(userA,expectedSecond.id);
 assert.equal(afterConflict.review_count,3);
 assert.equal(afterConflict.remembered,false);
 pass('stale browser gets 409 and never overwrites the newer account review');

 // Reauth in another tab invalidates the old actor-scoped screen.
 await login(contextA,userB);
 await pA.goto(ORIGIN+'/practice.html');
 await pA.locator('#ws28Setup').waitFor({state:'visible'});
 assert.equal(await pA.locator('#ws28Total').textContent(),'1');
 pass('account switch clears the previous account question bank');

 await Promise.allSettled([
  contextA.close(),contextA2.close(),contextB.close(),guest.close()
 ]);
 console.log('\nUX28 LOCAL BROWSER & SRS QA: PASS');
}catch(error){
 console.error('\nUX28 LOCAL BROWSER & SRS QA: FAIL\n'+(error.stack||error));
 process.exitCode=1;
}finally{
 await Promise.allSettled([chrome?.close(),fox?.close()]);
 if(createdRuns.length){
  try{await db.query('DELETE FROM ws_solo_runs WHERE id=ANY($1::uuid[])',[createdRuns])}
  catch(error){console.error('UX28 run cleanup failed:',error.message);process.exitCode=1}
 }
 if(createdUsers.length){
  try{await db.query('DELETE FROM ws_users WHERE id=ANY($1::uuid[])',[createdUsers])}
  catch(error){console.error('UX28 account cleanup failed:',error.message);process.exitCode=1}
 }
 await db.end();
 console.log('UX28 isolated QA cleanup completed');
}
