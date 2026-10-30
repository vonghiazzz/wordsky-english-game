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
 const memory=mode==='MEMORY';
 const status=memory?'TIMEOUT':'FAILED';
 const health=memory?3:0;
 const questions=['MATRIX','MEMORY'].includes(mode)?8:3;
 const state={mode,status,score:0,health,correct:0,mistakes:1,
   wrongWordIds:ids,startedAt:Date.now()-60000,endsAt:Date.now()-30000,
   pairs:[],distractors:[]};
 const row=await db.query(
  'INSERT INTO ws_solo_runs(user_id,access_token_hash,client_fingerprint_hash,'+
  'mode,difficulty,duration_seconds,question_count,points_per_correct,penalty,'+
  'status,health,score,correct,mistakes,state,finished_at) '+
  "VALUES($1,$2,$3,$4,'EASY',90,$5,100,25,$6,$7,0,0,1,$8::jsonb,now()) RETURNING id",
  [userId,randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),
   mode,questions,status,health,JSON.stringify(state)]
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
  'SELECT id,english FROM ws_words WHERE enabled=true ORDER BY id LIMIT 6'
 );
 assert.equal(vocab.rows.length,6);
 const [wordA,wordB,wordC,wordD,wordE,wordF]=vocab.rows;
 const userA=await createUser(),userB=await createUser();
 const runA=await createRun(userA.id,[wordA.id]);
 await createRun(userA.id,[wordA.id]);
 // One MATRIX mismatch has two vocabulary candidates; MEMORY has its own.
 // These are terminal disposable CI runs, never real account data.
 await createRun(userA.id,[wordD.id,wordE.id],'MATRIX');
 await createRun(userA.id,[wordF.id],'MEMORY');
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
 const noAuthSync=await unauth.request.post(BASE+'/api/learning/game-mistakes/sync',{
   headers:{origin:BASE},data:{expected_actor_id:userA.id}
 });
 assert.equal(noAuthSync.status(),401);
 pass('notebook rejects guests');

 const a=await getNotebook(owner1),a2=await getNotebook(owner2),b=await getNotebook(other);
 assert.equal(a.actor_id,userA.id);
 assert.deepEqual(a.words.map(w=>w.word_id).sort(),
  [wordA.id,wordD.id,wordE.id,wordF.id].sort());
 assert.equal(a.words.find(w=>w.word_id===wordA.id).mistake_runs,2);
 assert.deepEqual(a2.words.map(w=>w.word_id).sort(),
  [wordA.id,wordD.id,wordE.id,wordF.id].sort());
 assert.deepEqual(a.words.find(w=>w.word_id===wordD.id).modes,['MATRIX']);
 assert.deepEqual(a.words.find(w=>w.word_id===wordF.id).modes,['MEMORY']);
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
 assert.equal(ownResult.reviewSync.status,'synced');
 await wait(async()=>{
   const rows=await db.query('SELECT remembered,review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',[userA.id,wordA.id]);
   return rows.rows[0]?.remembered===false&&rows.rows[0]?.review_count===1;
 });
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
 for(const p of [page1,page2]){
  for(const id of [wordD.id,wordE.id,wordF.id])
   await p.locator('[data-word-id="'+id+'"]').waitFor({state:'visible'});
 }
 for(const id of [wordD.id,wordE.id,wordF.id])
  assert.equal(await pageB.locator('[data-word-id="'+id+'"]').count(),0);
 assert.equal(await page1.locator('#ws27Total').textContent(),'4');
 assert.equal(await page1.locator('#ws27Misses').textContent(),'5');
 pass('Chromium/Firefox account notebook UI stays isolated across devices');
 for(const page of [page1,page2,pageB]){
   assert.equal(await page.locator('[data-review-word]').count(),0,'no manual per-word review buttons');
   assert.equal(await page.locator('.ws27-crumb').count(),0,'no raw breadcrumb links below navigation');
 }
 await page1.locator('[data-word-id="'+wordA.id+'"] .ws27-state-due').waitFor();
 await pageB.locator('[data-word-id="'+wordB.id+'"] .ws27-state-due').waitFor();
 pass('auto-queued Need Review on both signed-in accounts without clicks');


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
 for(const p of [page1,page2]){
  await p.locator('#ws27Mode').selectOption('MATRIX');
  for(const id of [wordD.id,wordE.id])
   await p.locator('[data-word-id="'+id+'"]').waitFor({state:'visible'});
  assert.equal(await p.locator('[data-word-id="'+wordA.id+'"]').count(),0);
  assert.equal(await p.locator('[data-word-id="'+wordF.id+'"]').count(),0);
  await p.locator('#ws27Mode').selectOption('MEMORY');
  await p.locator('[data-word-id="'+wordF.id+'"]').waitFor({state:'visible'});
  assert.equal(await p.locator('[data-word-id="'+wordD.id+'"]').count(),0);
  await p.locator('#ws27Mode').selectOption('');
 }
 await page1.locator('#ws27Mode').selectOption('CAR');
 assert.equal(await page1.locator('[data-word-id="'+wordA.id+'"]').count(),0);
 await page1.locator('#ws27Mode').selectOption('MATCH');
 await page1.locator('#ws27Search').fill(wordA.english);
 await page1.locator('[data-word-id="'+wordA.id+'"]').waitFor({state:'visible'});
 await page1.locator('#ws27Search').fill('');
 pass('mobile layout at 360/390px and mode/search filters');

 // The notebook reconciles unfinished historical enrollments automatically,
 // and repeated GET/POST requests must not append duplicate learning events.
 const replays=await Promise.all([owner1.request.post(BASE+'/api/learning/game-mistakes/sync',{
   headers:{origin:BASE},data:{expected_actor_id:userA.id}
 }),owner2.request.post(BASE+'/api/learning/game-mistakes/sync',{
   headers:{origin:BASE},data:{expected_actor_id:userA.id}
 })]);
 for(const response of replays){
   assert.equal(response.status(),200,await response.text());
   assert.equal((await response.json()).newly_queued,0);
 }
 await page2.locator('#ws27Reload').click();
 await page2.locator('[data-word-id="'+wordA.id+'"] .ws27-state-due').waitFor();
 pass('no manual action, account SRS is visible on both browsers and replays are idempotent');

 const ledger=await db.query('SELECT count(*)::int n FROM ws_learning_review_requests WHERE user_id=$1',[userA.id]);
 assert.equal(ledger.rows[0].n,4,
  'two MATCH runs dedupe A; MATRIX adds D/E and MEMORY adds F once');
 const history=await db.query('SELECT count(*)::int n FROM ws_learning_flashcard_reviews WHERE user_id=$1 AND word_id=$2',[userA.id,wordA.id]);
 assert.equal(history.rows[0].n,1);
 const newWords=await db.query(
  'SELECT word_id::text AS id,remembered,review_count FROM ws_learning_word_progress '+
  'WHERE user_id=$1 AND word_id=ANY($2::uuid[])',
  [userA.id,[wordD.id,wordE.id,wordF.id]]
 );
 assert.equal(newWords.rows.length,3);
 for(const word of newWords.rows){
  assert.equal(word.remembered,false);
  assert.equal(word.review_count,1,'MATRIX/MEMORY must not double-queue review');
 }
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
 assert.equal(otherProgress.rows[0].n,1,'other account has its own automatic word B, not user A');
 pass('actor pin rejects cross-account writes');
 const foreignSync=await other.request.post(BASE+'/api/learning/game-mistakes/sync',{
  headers:{origin:BASE},data:{expected_actor_id:userA.id}
 });
 assert.equal(foreignSync.status(),409);

 // After a learner explicitly marks a word remembered, a replay of their older
 // completed game must NOT force it back into "needs review".
 const remember=await owner1.request.post(BASE+'/api/learning/reviews',{
   headers:{origin:BASE},
   data:{request_id:randomUUID(),source:'shared',word_id:wordA.id,
     remembered:true,expected_review_count:1,expected_actor_id:userA.id}
 });
 assert.equal(remember.status(),201,await remember.text());
 const replayRun=await owner1.request.get(BASE+'/api/solo/runs/'+runA);
 assert.equal(replayRun.status(),200);
 const progress=await db.query(
   'SELECT review_count,remembered FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',
   [userA.id,wordA.id]
 );
 assert.deepEqual({n:progress.rows[0].review_count,remembered:progress.rows[0].remembered},
   {n:2,remembered:true});
 pass('a newer learner review wins over replaying an older game');

 // A real PLAYING-to-TIMEOUT transition through the authorized Solo route
 // must queue another word without visiting the notebook or clicking anything.
 const {createState}=await import('../lib/game.js');
 const state=createState({
   mode:'MATCH',difficulty:'EASY',question_count:3,duration_seconds:20,
   points_per_correct:100,penalty:25
 },[...vocab.rows].map(w=>({...w,meaning:'Test'})),Date.now()-40000,Date.now()-1000);
 state.wrongWordIds=[wordC.id];
 const pendingRun=await createRun(userA.id,[]);
 await db.query(
   "UPDATE ws_solo_runs SET status='PLAYING',finished_at=NULL,state=$1::jsonb WHERE id=$2",
   [JSON.stringify(state),pendingRun]
 );
 const terminal=await owner1.request.get(BASE+'/api/solo/runs/'+pendingRun);
 assert.equal(terminal.status(),200,await terminal.text());
 const result=await terminal.json();
 assert.equal(result.game.status,'TIMEOUT');
 assert.equal(result.reviewSync.status,'synced');
 assert.equal(result.reviewSync.newly_queued,1);
 await wait(async()=>{
   const p=await db.query('SELECT remembered,review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',[userA.id,wordC.id]);
   return p.rows[0]?.remembered===false&&p.rows[0]?.review_count===1;
 });
 pass('Solo server terminal GET auto-enqueues newly missed word without a client confirmation');

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
