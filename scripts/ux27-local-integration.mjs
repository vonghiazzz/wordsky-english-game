/* UX27 isolated account & browser E2E. NEVER connect to remote DB or Production.
 * The CI server is http://localhost:3000 backed by wordsky_v6_test PostgreSQL.
 */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const BASE='http://localhost:3000';
const dbURL=new URL(process.env.DATABASE_URL||'');
assert.equal(dbURL.hostname,'127.0.0.1');
assert.equal(dbURL.port,'5547');
assert.equal(dbURL.pathname,'/wordsky_v6_test');
const db=new pg.Pool({connectionString:dbURL.toString(),ssl:false});
const users=[],runs=[];
let chrome,fox;

async function createUser(){
 const name='qa27'+randomBytes(6).toString('hex');
 const secret=randomBytes(15).toString('hex');
 const row=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
  [name,'UX27 CI',hashPassword(secret)]
 );
 const user={id:row.rows[0].id,name,secret};
 users.push(user.id);
 return user;
}
async function createRun(userId,ids,mode='MATCH'){
 const state={mode,status:'FAILED',score:0,health:0,correct:0,mistakes:1,
   wrongWordIds:ids,startedAt:Date.now()-60000,endsAt:Date.now()-30000,
   pairs:[],distractors:[]};
 const row=await db.query(
  'INSERT INTO ws_solo_runs(user_id,access_token_hash,client_fingerprint_hash,'+
  'mode,difficulty,duration_seconds,question_count,points_per_correct,penalty,'+
  'status,health,score,correct,mistakes,state,finished_at) '+
  "VALUES($1,$2,$3,$4,'EASY',90,3,100,25,'FAILED',0,0,0,1,$5::jsonb,now()) RETURNING id",
  [userId,randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),mode,JSON.stringify(state)]
 );
 runs.push(row.rows[0].id);
 return row.rows[0].id;
}
async function signIn(context,user){
 const result=await context.request.post(BASE+'/api/auth/login',{
  headers:{origin:BASE},
  data:{username:user.name,password:user.secret}
 });
 assert.equal(result.status(),200,await result.text());
 const me=await context.request.get(BASE+'/api/auth/me');
 assert.equal((await me.json()).actor?.id,user.id);
}
async function getNotebook(context){
 const res=await context.request.get(BASE+'/api/learning/game-mistakes');
 assert.equal(res.status(),200,await res.text());
 return res.json();
}
async function wait(fn){
 const until=Date.now()+10000;
 while(Date.now()<until){
  if(await fn())return;
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 throw Error('Timed out waiting for local PostgreSQL review');
}
const pass=msg=>console.log('PASS: UX27 '+msg);

try {
 const count=await db.query('SELECT current_database() AS name');
 assert.equal(count.rows[0].name,'wordsky_v6_test');
 const vocab=await db.query(
  'SELECT id,english FROM ws_words WHERE enabled=true ORDER BY id LIMIT 3'
 );
 assert.equal(vocab.rows.length,3);
 const [wordA,wordB,wordC]=vocab.rows;
 const userA=await createUser(),userB=await createUser();
 const runA=await createRun(userA.id,[wordA.id]);
 await createRun(userA.id,[wordA.id]);
 await createRun(userB.id,[wordB.id],'BOMB');
 await createRun(null,[wordC.id],'CAR');

 chrome=await chromium.launch({headless:true});
 fox=await firefox.launch({headless:true});
 const owner1=await chrome.newContext();
 const owner2=await fox.newContext();
 const other=await chrome.newContext();
 await signIn(owner1,userA);
 await signIn(owner2,userA);
 await signIn(other,userB);
 const unauth=await chrome.newContext();

 const noAuth=await unauth.request.get(BASE+'/api/learning/game-mistakes');
 assert.equal(noAuth.status(),401);
 pass('notebook rejects guests');

 const a=await getNotebook(owner1),a2=await getNotebook(owner2),b=await getNotebook(other);
 assert.equal(a.actor_id,userA.id);
 assert.deepEqual(a.words.map(w=>w.word_id),[wordA.id]);
 assert.equal(a.words[0].mistake_runs,2);
 assert.deepEqual(a2.words.map(w=>w.word_id),[wordA.id]);
 assert.deepEqual(b.words.map(w=>w.word_id),[wordB.id]);
 pass('two browsers see one account, other actor cannot see their words');

 const queryAttack=await other.request.get(
  BASE+'/api/learning/game-mistakes?user_id='+userA.id
 );
 assert.deepEqual((await queryAttack.json()).words.map(w=>w.word_id),[wordB.id]);
 pass('query user_id cannot override signed-in actor');

 const ownRun=await owner2.request.get(BASE+'/api/solo/runs/'+runA);
 assert.equal(ownRun.status(),200,await ownRun.text());
 const ownResult=await ownRun.json();
 assert.deepEqual(ownResult.reviewWords.map(w=>w.word_id),[wordA.id]);
 const steal=await other.request.get(BASE+'/api/solo/runs/'+runA);
 assert.equal(steal.status(),401);
 pass('run details are private to the correct account');

 const page1=await owner1.newPage(),page2=await owner2.newPage(),pageB=await other.newPage();
 await Promise.all([page1.goto(BASE+'/mistakes.html'),page2.goto(BASE+'/mistakes.html'),pageB.goto(BASE+'/mistakes.html')]);
 for(const p of [page1,page2]){
  await p.locator('#ws27Account').waitFor({state:'visible'});
  await p.locator('[data-word-id="'+wordA.id+'"]').waitFor();
  assert.equal(await p.locator('[data-word-id="'+wordB.id+'"]').count(),0);
 }
 await pageB.locator('#ws27Account').waitFor({state:'visible'});
 assert.equal(await pageB.locator('[data-word-id="'+wordA.id+'"]').count(),0);
 await pageB.locator('[data-word-id="'+wordB.id+'"]').waitFor();
 pass('Chromium/Firefox account notebook UI stays isolated across devices');

 for (const width of [360,390]) {
  await page1.setViewportSize({width,height:800});
  const metrics=await page1.evaluate(()=>{
   const element=document.querySelector('#ws27Account .ws27-word');
   const box=element.getBoundingClientRect();
   return {
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    left:box.left,right:box.right
   };
  });
  assert.ok(metrics.overflow<=1,
    'UX27 mobile horizontal overflow at '+width+'px: '+JSON.stringify(metrics));
  assert.ok(metrics.left>=-1&&metrics.right<=width+1,'UX27 card clipped at '+width+'px');
 }
 await page1.locator('#ws27Mode').selectOption('CAR');
 assert.equal(await page1.locator('[data-word-id="'+wordA.id+'"]').count(),0);
 await page1.locator('#ws27Mode').selectOption('MATCH');
 await page1.locator('#ws27Search').fill(wordA.english);
 await page1.locator('[data-word-id="'+wordA.id+'"]').waitFor({state:'visible'});
 await page1.locator('#ws27Search').fill('');
 pass('mobile layout at 360/390px and mode/search filters');

 await page1.locator('[data-word-id="'+wordA.id+'"] [data-review-word]').click();
 await wait(async()=>{
  const p=await db.query('SELECT review_count,remembered FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',
   [userA.id,wordA.id]);
  return p.rows[0]?.review_count===1&&p.rows[0]?.remembered===false;
 });
 await page2.locator('#ws27Reload').click();
 await page2.waitForFunction(id=>{
  const card=document.querySelector('[data-word-id="'+id+'"]');
  return card?.textContent?.includes('Đã ôn 1 lần');
 },wordA.id);
 pass('explicit Need Review updates account history and appears on second browser');

 const ledger=await db.query('SELECT count(*)::int n FROM ws_learning_review_requests WHERE user_id=$1',[userA.id]);
 assert.equal(ledger.rows[0].n,1);
 const foreignCommand=await other.request.post(BASE+'/api/learning/reviews',{
  headers:{origin:BASE},
  data:{
   request_id:randomUUID(),source:'shared',word_id:wordA.id,remembered:false,
   expected_review_count:0,expected_actor_id:userA.id
  }
 });
 assert.equal(foreignCommand.status(),409);
 const otherProgress=await db.query('SELECT count(*)::int AS n FROM ws_learning_word_progress WHERE user_id=$1',
  [userB.id]);
 assert.equal(otherProgress.rows[0].n,0);
 pass('actor pin rejects cross-account writes before SRS history is created');

 await Promise.all([owner1.close(),owner2.close(),other.close(),unauth.close()]);
 console.log('\nUX27 LOCAL ACCOUNT / BROWSER QA: PASS');
} catch(err) {
 console.error('\nUX27 LOCAL ACCOUNT / BROWSER QA: FAIL\n'+(err.stack||err));
 process.exitCode=1;
} finally {
 await Promise.allSettled([chrome?.close(),fox?.close()]);
 if(runs.length){
  try{await db.query('DELETE FROM ws_solo_runs WHERE id=ANY($1::uuid[])',[runs])}
  catch(e){console.error('Failed to remove UX27 QA runs',e.message);process.exitCode=1}
 }
 if(users.length){
  try{await db.query('DELETE FROM ws_users WHERE id=ANY($1::uuid[])',[users])}
  catch(e){console.error('Failed to remove UX27 QA accounts',e.message);process.exitCode=1}
 }
 await db.end();
 console.log('UX27 temporary QA data cleanup attempted');
}
