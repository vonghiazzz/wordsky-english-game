/* UX28.1 CI: one My Learning CTA launches exactly the selected account SRS group.
 * Strictly isolated PostgreSQL17 and disposable users; never touch Production.
 */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const BASE='http://localhost:3000';
const url=new URL(process.env.DATABASE_URL||'');
assert.equal(url.hostname,'127.0.0.1');
assert.equal(url.port,'5547');
assert.equal(url.pathname,'/wordsky_v6_test');
const db=new pg.Pool({connectionString:url.toString(),ssl:false});
const users=[],runs=[];
let chrome,fox;
const pass=msg=>console.log('PASS: UX28.1 '+msg);

async function account(){
 const username='qa281'+randomBytes(6).toString('hex'),password=randomBytes(16).toString('hex');
 const row=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
  [username,'UX28.1 account QA',hashPassword(password)]);
 const user={id:row.rows[0].id,username,password};
 users.push(user.id);return user;
}
async function run(userId,wordIds,mode='MATCH'){
 const state={mode,status:'FAILED',health:0,score:0,correct:0,mistakes:1,
  wrongWordIds:wordIds,startedAt:Date.now()-60000,endsAt:Date.now()-30000,
  pairs:[],distractors:[],bombs:[],levels:[],index:0};
 const row=await db.query(
  'INSERT INTO ws_solo_runs(user_id,access_token_hash,client_fingerprint_hash,'+
  'mode,difficulty,duration_seconds,question_count,points_per_correct,penalty,'+
  'status,health,score,correct,mistakes,state,finished_at) '+
  "VALUES($1,$2,$3,$4,'EASY',90,3,100,25,'FAILED',0,0,0,1,$5::jsonb,now()) RETURNING id",
  [userId,randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),
   mode,JSON.stringify(state)]);
 runs.push(row.rows[0].id);return row.rows[0].id;
}
async function login(ctx,user){
 const response=await ctx.request.post(BASE+'/api/auth/login',{
  headers:{origin:BASE},data:{username:user.username,password:user.password}
 });
 assert.equal(response.status(),200,await response.text());
 const me=await ctx.request.get(BASE+'/api/auth/me');
 assert.equal((await me.json()).actor?.id,user.id);
}
async function progress(user,wordId,source='shared'){
 const table=source==='shared'?'ws_learning_word_progress':'ws_personal_card_progress';
 const idcol=source==='shared'?'word_id':'personal_word_id';
 const row=await db.query(
  'SELECT remembered,review_count FROM '+table+' WHERE user_id=$1 AND '+idcol+'=$2',
  [user.id,wordId]);
 return row.rows[0]||null;
}
async function reviewCount(user,wordId){
 const row=await db.query(
  'SELECT count(*)::int n FROM ws_learning_review_requests WHERE user_id=$1 AND word_id=$2',
  [user.id,wordId]);
 return row.rows[0].n;
}
async function waitProgress(user,wordId,n,source='shared'){
 const end=Date.now()+12000;
 while(Date.now()<end){
  const row=await progress(user,wordId,source);
  if(row?.review_count===n)return row;
  await new Promise(resolve=>setTimeout(resolve,125));
 }
 throw Error('Timed out waiting for '+source+' review count '+n);
}
async function group(page,status,topic=''){
 await page.goto(BASE+'/progress.html');
 await page.locator('#ws24Srs').waitFor({state:'visible'});
 await page.locator('#ws24Status').selectOption(status);
 if(topic){
  await page.locator('#ws24Topic option').filter({hasText:topic}).first().waitFor();
  await page.locator('#ws24Topic').selectOption({label:topic});
 }
 await page.locator('#ws24Practice').waitFor({state:'visible'});
 await page.waitForFunction(()=>{
  const button=document.getElementById('ws24Practice');
  return button&&!button.disabled;
 });
}
async function launch(page,status,topic=''){
 await group(page,status,topic);
 await page.locator('#ws24Practice').click();
 await page.waitForURL(url=>url.pathname==='/practice.html');
 const target=new URL(page.url());
 assert.equal(target.searchParams.get('status'),status);
 assert.equal(target.searchParams.get('topic'),topic);
 await page.locator('#ws28Play').waitFor({state:'visible'});
}

try{
 const dbName=(await db.query('SELECT current_database() AS db')).rows[0].db;
 assert.equal(dbName,'wordsky_v6_test');
 const vocab=(await db.query(
  "SELECT id,english,meaning FROM ws_words WHERE enabled=true AND trim(meaning)<>'' ORDER BY id LIMIT 3"
 )).rows;
 assert.equal(vocab.length,3);
 const [one,two,three]=vocab;
 const owner=await account(),other=await account();
 const runOwner=await run(owner.id,[one.id,two.id]);
 const runOther=await run(other.id,[three.id],'BOMB');
 const personalTopic='UX28 QA Personal';
 const personal=(await db.query(
  'INSERT INTO ws_personal_cards(user_id,topic,english,meaning) VALUES($1,$2,$3,$4) RETURNING id',
  [owner.id,personalTopic,'observation','sự quan sát']
 )).rows[0];

 chrome=await chromium.launch({headless:true});
 fox=await firefox.launch({headless:true});
 const ctxA=await chrome.newContext({viewport:{width:360,height:800}});
 const ctxA2=await fox.newContext({viewport:{width:390,height:844}});
 const ctxB=await chrome.newContext({viewport:{width:390,height:844}});
 const ctxGuest=await fox.newContext();
 await Promise.all([login(ctxA,owner),login(ctxA2,owner),login(ctxB,other)]);

 const guest=await ctxGuest.newPage();
 await guest.goto(BASE+'/practice.html');
 await guest.locator('#ws28Guest').waitFor({state:'visible'});
 assert.equal(await guest.locator('#ws28Play').isVisible(),false);
 pass('guest cannot read private SRS practice');

 for(const [ctx,runId] of [[ctxA,runOwner],[ctxB,runOther]]){
  const resp=await ctx.request.get(BASE+'/api/solo/runs/'+runId);
  assert.equal(resp.status(),200,await resp.text());
  assert.equal((await resp.json()).reviewSync?.status,'synced');
 }
 const pA=await ctxA.newPage();
 const pA2=await ctxA2.newPage();
 const pB=await ctxB.newPage();
 await Promise.all([
  pA2.goto(BASE+'/practice.html?status=due'),
  pB.goto(BASE+'/practice.html?status=due')
 ]);
 await pA2.locator('#ws28Play').waitFor({state:'visible'});
 await pB.locator('#ws28Play').waitFor({state:'visible'});
 assert.equal(await pA2.locator('#ws28Position').textContent(),'1 / 2');
 assert.equal(await pB.locator('#ws28Position').textContent(),'1 / 1');
 assert.equal((await pB.locator('body').textContent()).includes(one.english),false);
 pass('same account has identical queue; different account is isolated');

 await group(pA,'due');
 const toolbar=await pA.evaluate(()=>{
  const refresh=document.querySelector('#ws24Reload').getBoundingClientRect();
  const practice=document.querySelector('#ws24Practice').getBoundingClientRect();
  return {yDiff:Math.abs(refresh.y-practice.y),overflow:
    document.documentElement.scrollWidth-document.documentElement.clientWidth};
 });
 assert.ok(toolbar.yDiff<=12,'Practice not next to Refresh at 360px: '+JSON.stringify(toolbar));
 assert.ok(toolbar.overflow<=1,'My Learning overflows on mobile: '+JSON.stringify(toolbar));
 assert.equal(await pA.locator('a[href="/practice.html"]').count(),0);
 assert.equal(await pA.locator('a[href="/mistakes.html"]').count(),0);
 pass('one Luyện từ beside Làm mới lịch; no duplicate navigation on 360px');

 await pA.locator('#ws24Practice').click();
 await pA.waitForURL(url=>url.pathname==='/practice.html');
 assert.equal(new URL(pA.url()).searchParams.get('status'),'due');
 await pA.locator('#ws28Play').waitFor({state:'visible'});
 assert.equal(await pA.locator('#ws28Position').textContent(),'1 / 2');
 const mobile=await pA.evaluate(()=>({
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
 }));
 assert.ok(mobile.overflow<=1,'UX28 mobile overflow '+JSON.stringify(mobile));
 const map=new Map(vocab.map(v=>[v.meaning,v]));
 const first=map.get(await pA.locator('#ws28Meaning').textContent());
 assert.ok(first&&[one.id,two.id].includes(first.id));
 assert.equal(await pA.locator('#ws28Feedback').isVisible(),false,
  'English answer leaked before submitting');
 pass('selected Due group opens directly in recall quiz without setup or duplicate counters');

 let lost=false;
 await pA.route('**/api/learning/reviews',async route=>{
  if(!lost){
   lost=true;
   const saved=await route.fetch();
   assert.ok([200,201].includes(saved.status()));
   await route.abort('failed');
  }else await route.continue();
 });
 await pA.locator('#ws28Skip').click();
 await pA.locator('#ws28Retry').waitFor({state:'visible'});
 await pA.locator('#ws28Retry').click();
 await pA.locator('#ws28Next').waitFor({state:'visible'});
 assert.equal(await reviewCount(owner,first.id),2);
 assert.equal((await waitProgress(owner,first.id,2)).remembered,false);
 pass('lost response replays same request ID, no duplicate review');

 await pA.locator('#ws28Next').click();
 const second=map.get(await pA.locator('#ws28Meaning').textContent());
 assert.ok(second&&second.id!==first.id);
 await pA.locator('#ws28Answer').fill('  '+second.english.toUpperCase()+'  ');
 await pA.locator('#ws28Check').click();
 await pA.locator('#ws28Next').waitFor({state:'visible'});
 assert.equal((await waitProgress(owner,second.id,2)).remembered,true);
 await pA.locator('#ws28Next').click();
 await pA.locator('#ws28Done').waitFor({state:'visible'});
 assert.equal(await pA.locator('#ws28CorrectCount').textContent(),'1');
 assert.equal(await pA.locator('#ws28DoneTotal').textContent(),'2');
 pass('typed recall writes correct/incorrect results to shared SRS and summary');

 const due=await ctxA2.request.get(BASE+'/api/learning/srs/queue?status=due&page=0&size=100');
 const up=await ctxA2.request.get(BASE+'/api/learning/srs/queue?status=upcoming&page=0&size=100');
 assert.equal(due.status(),200);
 assert.equal(up.status(),200);
 const dueWords=(await due.json()).words,upcomingWords=(await up.json()).words;
 assert.ok(dueWords.some(w=>w.id===first.id));
 assert.ok(upcomingWords.some(w=>w.id===second.id));
 pass('SRS group updates sync to second browser; schedule separation preserved');

 await launch(pA,'new',personalTopic);
 assert.equal(await pA.locator('#ws28Meaning').textContent(),'sự quan sát');
 assert.equal(await pA.locator('#ws28Position').textContent(),'1 / 1');
 await pA.locator('#ws28Answer').fill('OBSERVATION');
 await pA.locator('#ws28Check').click();
 await pA.locator('#ws28Next').waitFor({state:'visible'});
 assert.equal((await waitProgress(owner,personal.id,1,'personal')).remembered,true);
 pass('New topic filter and personal vocabulary use same account review API');

 const shadow=(await db.query(
  'SELECT source,word_id::text,review_count FROM ws_user_srs_schedules '+
  'WHERE user_id=$1 AND word_id=ANY($2::uuid[])',
  [owner.id,[one.id,two.id,personal.id]])).rows;
 assert.equal(shadow.length,3);
 assert.ok(shadow.some(w=>w.source==='personal'&&w.word_id===personal.id));
 pass('shared and personal SRS shadow align to persisted reviews');

 // A stale device cannot overwrite an intervening review by another device.
 await pA.goto(BASE+'/practice.html?status=due');
 await pA.locator('#ws28Play').waitFor({state:'visible'});
 assert.equal(await pA.locator('#ws28Meaning').textContent(),first.meaning);
 const concurrent=await ctxA2.request.post(BASE+'/api/learning/reviews',{
  headers:{origin:BASE},
  data:{request_id:randomUUID(),source:'shared',word_id:first.id,
   remembered:false,expected_review_count:2,expected_actor_id:owner.id}
 });
 assert.equal(concurrent.status(),201,await concurrent.text());
 await pA.locator('#ws28Answer').fill(first.english);
 await pA.locator('#ws28Check').click();
 await pA.locator('#ws28Play').waitFor({state:'visible'});
 const changed=await waitProgress(owner,first.id,3);
 assert.equal(changed.remembered,false);
 assert.equal(await reviewCount(owner,first.id),3);
 pass('concurrent 409 triggers safe reload; older quiz never overwrites review');

 // Reloading the practice page after login swap must not show the old actor.
 await login(ctxA,other);
 await pA.goto(BASE+'/practice.html?status=due');
 await pA.locator('#ws28Play').waitFor({state:'visible'});
 assert.equal(await pA.locator('#ws28Position').textContent(),'1 / 1');
 assert.equal(await pA.locator('#ws28Meaning').textContent(),three.meaning);
 pass('login switch isolates SRS queue and clears previous account question bank');

 await Promise.allSettled([ctxA.close(),ctxA2.close(),ctxB.close(),ctxGuest.close()]);
 console.log('\nUX28.1 SINGLE ENTRY ACCOUNT SRS E2E: PASS');
}catch(error){
 console.error('\nUX28.1 SINGLE ENTRY ACCOUNT SRS E2E: FAIL\n'+(error.stack||error));
 process.exitCode=1;
}finally{
 await Promise.allSettled([chrome?.close(),fox?.close()]);
 if(runs.length){
  try{await db.query('DELETE FROM ws_solo_runs WHERE id=ANY($1::uuid[])',[runs])}
  catch(error){console.error('UX28.1 run cleanup',error.message);process.exitCode=1;}
 }
 if(users.length){
  try{await db.query('DELETE FROM ws_users WHERE id=ANY($1::uuid[])',[users])}
  catch(error){console.error('UX28.1 account cleanup',error.message);process.exitCode=1;}
 }
 await db.end();
 console.log('UX28.1 isolated QA cleanup completed');
}
