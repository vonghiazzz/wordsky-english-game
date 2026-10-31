/* UX43C isolated PostgreSQL17 + Chromium/Firefox Preview-pilot acceptance.
 * Never run on Vercel or Production; disposable accounts and curation only.
 */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const BASE='http://localhost:3000';
const PASSWORD='TemporaryQaRecall2026!';
const target=new URL(process.env.DATABASE_URL||'http://invalid');
assert.equal(target.protocol,'postgresql:');
assert.equal(target.hostname,'127.0.0.1');
assert.equal(target.port,'5547');
assert.equal(target.pathname,'/wordsky_v6_test');
assert.equal(target.username,'wordsky_test');
assert.equal(process.env.WORDSKY_RECALL_PREVIEW_ENABLED,'true');
assert.notEqual(process.env.VERCEL_ENV,'production');
const db=new pg.Pool({connectionString:target.toString(),ssl:false});
let a,b,promptId,chrome,fox;
const contexts=[];
const post=(ctx,path,data,origin=BASE,method='POST')=>
 ctx.request.fetch(BASE+'/api/learning/recall/'+path,{
  method,headers:origin===null?{}:{origin,'content-type':'application/json'},
  data:JSON.stringify(data)
 });
async function login(ctx,name){
 const response=await ctx.request.post(BASE+'/api/auth/login',{
  headers:{origin:BASE},data:{username:name,password:PASSWORD}
 });
 assert.equal(response.status(),200);
}
const pin=(id,rest={})=>({expected_actor_id:id,...rest});
try{
 assert.equal((await db.query('SELECT current_database() AS db')).rows[0].db,'wordsky_v6_test');
 const word=(await db.query(
  "SELECT w.id,w.english FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id "+
  "WHERE w.enabled=true AND t.enabled=true AND w.english ~ '^[A-Za-z]{3,20}$' "+
  "ORDER BY w.english LIMIT 1"
 )).rows[0];
 assert.ok(word,'Seeded QA requires a simple alphabetic vocabulary word');
 const curated=(await db.query(
  'INSERT INTO ws_recall_curated_prompts '+
  '(word_id,prompt_vi,accepted_english,answer_revision,curator,approved,active) '+
  'VALUES($1,$2,$3,$4,$5,true,true) RETURNING id',
  [word.id,'Hãy trả lời từ tiếng Anh cho nghĩa QA giả lập',
   [word.english],'ux43c-synthetic-fixture','owner']
 )).rows[0];
 promptId=curated.id;
 const suffix=randomBytes(5).toString('hex');
 const nameA='qa43ca'+suffix,nameB='qa43cb'+suffix;
 const userA=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash,xp,streak) '+
  'VALUES($1,$2,$3,12,2) RETURNING id',
  [nameA,'UX43C QA A',hashPassword(PASSWORD)]);
 const userB=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) '+
  'VALUES($1,$2,$3) RETURNING id',
  [nameB,'UX43C QA B',hashPassword(PASSWORD)]);
 a={id:userA.rows[0].id,name:nameA};
 b={id:userB.rows[0].id,name:nameB};
 chrome=await chromium.launch({headless:true});
 fox=await firefox.launch({headless:true});
 const one=await chrome.newContext({viewport:{width:360,height:780}});
 const two=await fox.newContext({viewport:{width:390,height:780}});
 const guest=await chrome.newContext();
 contexts.push(one,two,guest);

 const unauth=await guest.request.get(BASE+'/api/learning/recall/status');
 assert.equal(unauth.status(),401);
 const g=await guest.newPage();
 await g.goto(BASE+'/recall.html');
 await g.locator('#ws43cGuest').waitFor({state:'visible'});
 assert.equal(await g.locator('#ws43cExercise').isVisible(),false);
 console.log('PASS: UX43C guest cannot read account recall or start test');

 await login(one,nameA);
 await login(two,nameB);
 const statusA=await one.request.get(BASE+'/api/learning/recall/status');
 assert.equal(statusA.status(),200);
 const before=await statusA.json();
 assert.equal(before.consent_active,false);
 assert.ok(before.curated_prompts>=1);
 assert.equal(before.schedule_unchanged,true);
 assert.equal((await post(one,'trials',pin(a.id))).status(),403);
 assert.equal((await post(one,'consent',pin(a.id,{agree:true,consent_version:'ux43b-opt-in-v1'}),null)).status(),403);
 assert.equal((await post(one,'consent',pin(b.id,{agree:true,consent_version:'ux43b-opt-in-v1'}))).status(),409);

 const page=await one.newPage();
 await page.goto(BASE+'/recall.html');
 await page.locator('#ws43cOptIn').waitFor({state:'visible'});
 const mobileOverflow=await page.evaluate(()=>
  document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(mobileOverflow<=1,'UX43C 360px overflow: '+mobileOverflow);
 await page.locator('#ws43cConsentCheck').check();
 await page.locator('#ws43cAgree').click();
 await page.locator('#ws43cExercise').waitFor({state:'visible'});
 await page.locator('#ws43cNext').click();
 await page.locator('#ws43cAnswerForm').waitFor({state:'visible'});
 assert.ok((await page.locator('#ws43cPrompt').textContent()).includes('QA giả lập'));
 const field=await page.locator('#ws43cAnswer').inputValue();
 assert.equal(field,'');
 const html=await page.locator('#ws43cExercise').textContent();
 assert.equal(html.includes(word.english),false,'English answer leaked in prompt');
 await page.locator('#ws43cAnswer').fill(word.english);
 await page.locator('#ws43cSubmit').click();
 await page.locator('#ws43cResult').waitFor({state:'visible'});
 assert.equal((await page.locator('#ws43cResult').getAttribute('data-correct')),'true');
 console.log('PASS: UX43C opt-in Chrome 360px first-attempt typed grading');

 const original=(await db.query(
  'SELECT e.trial_id::text,e.request_id::text,e.result '+
  'FROM ws_recall_evidence e WHERE e.user_id=$1',
  [a.id])).rows;
 assert.equal(original.length,1);
 assert.equal(original[0].result,'correct');
 const replay=await post(one,'submit',pin(a.id,{
  trial_id:original[0].trial_id,request_id:original[0].request_id,response:word.english
 }));
 assert.equal(replay.status(),200);
 assert.equal((await replay.json()).replayed,true);
 const replayConflict=await post(one,'submit',pin(a.id,{
  trial_id:original[0].trial_id,request_id:randomUUID(),response:word.english
 }));
 assert.equal(replayConflict.status(),409);
 console.log('PASS: UX43C lost-response replay exact request; new request cannot double-count');

 await post(two,'consent',pin(b.id,{agree:true,consent_version:'ux43b-opt-in-v1'}));
 const foreign=await post(two,'submit',pin(b.id,{
  trial_id:original[0].trial_id,request_id:randomUUID(),response:word.english
 }));
 assert.equal(foreign.status(),404,'B must never submit or inspect A trial');
 const foreignStatus=await two.request.get(BASE+'/api/learning/recall/status');
 assert.equal((await foreignStatus.json()).consent_active,true);
 const pageB=await two.newPage();
 await pageB.goto(BASE+'/recall.html');
 await pageB.locator('#ws43cExercise').waitFor({state:'visible'});
 const overflowB=await pageB.evaluate(()=>
  document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflowB<=1,'UX43C 390px overflow: '+overflowB);
 console.log('PASS: UX43C Firefox 390px, second user isolation');

 const newTrial=await post(one,'trials',pin(a.id));
 assert.equal(newTrial.status(),201);
 const t=(await newTrial.json()).trial;
 assert.deepEqual(Object.keys(t).sort(),['expires_at','prompt_kind','prompt_vi','trial_id']);
 const wrong=await post(one,'submit',pin(a.id,{
  trial_id:t.trial_id,request_id:randomUUID(),response:'this_answer_is_wrong'
 }));
 assert.equal(wrong.status(),200);
 assert.equal((await wrong.json()).correct,false);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM ws_recall_evidence WHERE user_id=$1',[a.id])).rows[0].n,2);
 const repeated=(await db.query('SELECT count(*)::int AS n FROM ws_learning_flashcard_reviews WHERE user_id=$1',[a.id])).rows[0].n;
 assert.equal(repeated,0,'Typed test must not create a remembered decision');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM ws_user_srs_schedules WHERE user_id=$1',[a.id])).rows[0].n,0);
 const aInfo=(await db.query('SELECT xp,streak FROM ws_users WHERE id=$1',[a.id])).rows[0];
 assert.equal(aInfo.xp,12);
 assert.equal(aInfo.streak,2);
 console.log('PASS: UX43C wrong response independently graded, learning/SRS/XP unchanged');

 await page.locator('#ws43cWithdrawCheck').check();
 await page.locator('#ws43cWithdraw').click();
 await page.locator('#ws43cOptIn').waitFor({state:'visible'});
 const counts=await db.query(
  'SELECT (SELECT count(*)::int FROM ws_recall_consents WHERE user_id=$1) AS consent,'+
  '(SELECT count(*)::int FROM ws_recall_trials WHERE user_id=$1) AS trials,'+
  '(SELECT count(*)::int FROM ws_recall_evidence WHERE user_id=$1) AS evidence',[a.id]);
 assert.deepEqual(counts.rows[0],{consent:0,trials:0,evidence:0});
 assert.equal((await db.query('SELECT count(*)::int AS n FROM ws_recall_consents WHERE user_id=$1',[b.id])).rows[0].n,1);
 assert.equal((await post(one,'trials',pin(a.id))).status(),403);
 console.log('PASS: UX43C withdrawal deletes A research records, preserves B and vocabulary');
 console.log('UX43C ISOLATED TYPED RECALL E2E: PASS');
}catch(error){
 console.error('UX43C ISOLATED TYPED RECALL E2E: FAIL',error?.stack||error);
 process.exitCode=1;
}finally{
 await Promise.allSettled(contexts.map(c=>c.close()));
 await Promise.allSettled([chrome?.close(),fox?.close()]);
 try{
  if(a)await db.query('DELETE FROM ws_users WHERE id=$1',[a.id]);
  if(b)await db.query('DELETE FROM ws_users WHERE id=$1',[b.id]);
  if(promptId)await db.query('DELETE FROM ws_recall_curated_prompts WHERE id=$1',[promptId]);
 }catch(error){console.error('UX43C isolated cleanup failed:',error?.code||'unknown');process.exitCode=1;}
 await db.end();
 console.log('UX43C QA cleanup completed');
}
