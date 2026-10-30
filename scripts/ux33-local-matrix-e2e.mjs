/* UX33 MATRIX Solo acceptance on isolated PostgreSQL17 only.
 * Never connect to Supabase Production. QA players and runs are disposed.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';

const BASE='http://localhost:3000';
const url=new URL(process.env.DATABASE_URL||'');
assert.equal(url.hostname,'127.0.0.1');
assert.equal(url.port,'5547');
assert.equal(url.pathname,'/wordsky_v6_test');
const db=new pg.Pool({connectionString:url.toString(),ssl:false});
const runIds=[],userIds=[];
let chrome,fox;
const pass=message=>console.log('PASS: UX33 '+message);
const getRun=async page=>{
 const id=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('wordsky_ux33_matrix_run')||'null'));
 assert.match(id,/^[a-f0-9-]{36}$/i);runIds.push(id);
 return id;
};
async function newGame(page,size){
 // Do not restore a still-playing old run when switching QA grid sizes.
 // Only remove the per-tab pointer; all runs are cleaned up on the isolated DB.
 if(page.url().startsWith(BASE+'/matrix.html')){
  await page.evaluate(()=>{
   sessionStorage.removeItem('wordsky_ux33_matrix_run');
   sessionStorage.removeItem('wordsky_ux33_matrix_pending');
  });
 }
 await page.goto(BASE+'/matrix.html');
 await page.locator('#matrixSize').selectOption(String(size));
 await page.locator('#matrixStart').click();
 const tileCount=2*Math.floor(size*size/2);
 await page.locator('.matrix-card').first().waitFor({state:'visible'});
 assert.equal(await page.locator('.matrix-card').count(),tileCount);
 assert.equal(await page.locator('.matrix-card--en').count(),tileCount/2);
 assert.equal(await page.locator('.matrix-card-space').count(),size%2);
 assert.equal(await page.locator('.matrix-card--vi').count(),tileCount/2);
 return getRun(page);
}
async function clickPair(page,a,b){
 await page.locator('[data-matrix-id="'+a+'"]').click();
 await page.locator('[data-matrix-id="'+b+'"]').click();
}
try{
 assert.equal((await db.query('SELECT current_database() AS db')).rows[0].db,'wordsky_v6_test');
 const capacity=await db.query(
  "SELECT count(DISTINCT lower(btrim(meaning)))::int AS n FROM ws_words WHERE enabled AND btrim(meaning)<>''"
 );
 assert.ok(capacity.rows[0].n>=72,'isolated vocabulary needs 72 distinct Vietnamese labels');
 const feature=await db.query("SELECT enabled FROM ws_features WHERE feature_key='MATRIX'");
 assert.equal(feature.rows.length,1,'UX33 isolated migration missing');
 assert.equal(feature.rows[0].enabled,false,'MATRIX must start disabled by default');
 await db.query("UPDATE ws_features SET enabled=true WHERE feature_key='MATRIX'");
 chrome=await chromium.launch({headless:true});
 fox=await firefox.launch({headless:true});
 const guest=await chrome.newContext({viewport:{width:375,height:812}});
 const page=await guest.newPage();
 const run6=await newGame(page,6);
 const started=await db.query('SELECT state FROM ws_solo_runs WHERE id=$1',[run6]);
 const p=started.rows[0].state.pairs[0];
 await clickPair(page,p.enId,p.viId);
 await page.waitForFunction(()=>document.getElementById('matrixScore')?.textContent==='100');
 assert.match(await page.locator('#matrixCorrect').textContent(),/^1\/18$/);
 assert.equal(await page.locator('.matrix-card.is-matched').count(),2);
 pass('6x6 grades correct pair on server and locks two matching cards');
 await page.reload();
 await page.locator('.matrix-card').first().waitFor({state:'visible'});
 assert.equal(await page.locator('#matrixScore').textContent(),'100');
 assert.equal(await page.locator('.matrix-card.is-matched').count(),2);
 pass('sessionStorage run-ID recovery retains server score and matched state');
 const pairs=started.rows[0].state.pairs;
 for(let i=0;i<3;i++){
  await clickPair(page,pairs[1].enId,pairs[2].viId);
  if(i===2)await page.locator('#matrixResult').waitFor({state:'visible'});
  else await page.waitForFunction(expected=>document.getElementById('matrixHearts')?.textContent===('❤️'.repeat(expected)+'🖤'.repeat(3-expected)),2-i);
 }
 assert.match(await page.locator('#matrixResultTitle').textContent(),/Hết 3 tim/);
 assert.equal((await db.query('SELECT state FROM ws_solo_runs WHERE id=$1',[run6])).rows[0].state.mistakes,3);
 pass('third incorrect pair ends the game without exposing answers');
 const run4=await newGame(page,4);
 assert.equal((await db.query('SELECT question_count FROM ws_solo_runs WHERE id=$1',[run4])).rows[0].question_count,8);
 const run5=await newGame(page,5);
 assert.equal((await db.query('SELECT question_count FROM ws_solo_runs WHERE id=$1',[run5])).rows[0].question_count,12);
 assert.equal(await page.locator('.matrix-card-space').count(),1);
 // 6x6 is still scrollable at narrow mobile widths.
 await newGame(page,6);
 const scrollable=await page.locator('#matrixScroll').evaluate(node=>({
  x:node.scrollWidth>node.clientWidth,y:node.scrollHeight>node.clientHeight
 }));
 assert.deepEqual(scrollable,{x:true,y:true});
 assert.equal(await page.evaluate(()=>window.WordSkyAudio?.getState().scene),'MATRIX');
 pass('4x4, 5x5 centre gap and 6x6 work on a narrow mobile viewport');
 const username='qa33'+randomBytes(6).toString('hex'),password='MatrixSafePassword2026!';
 const account=await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
  [username,'UX33 Test Learner',hashPassword(password)]
 );
 const userId=account.rows[0].id;userIds.push(userId);
 const player=await fox.newContext({viewport:{width:390,height:844}});
 const login=await player.request.post(BASE+'/api/auth/login',{
  headers:{origin:BASE},data:{username,password}
 });
 assert.equal(login.status(),200,await login.text());
 const playerPage=await player.newPage(),personalRun=await newGame(playerPage,6);
 const personal=await db.query('SELECT state FROM ws_solo_runs WHERE id=$1',[personalRun]);
 const one=personal.rows[0].state.pairs[0],two=personal.rows[0].state.pairs[1];
 for(let i=0;i<3;i++){
  await clickPair(playerPage,one.enId,two.viId);
  if(i===2)await playerPage.locator('#matrixResult').waitFor({state:'visible'});
  else await playerPage.waitForFunction(n=>document.getElementById('matrixHearts')?.textContent===('❤️'.repeat(n)+'🖤'.repeat(3-n)),2-i);
 }
 // UX27 auto-review is idempotently triggered as soon as the terminal result is committed.
 const reviews=await db.query(
  'SELECT word_id FROM ws_learning_flashcard_reviews WHERE user_id=$1',[userId]
 );
 assert.equal(reviews.rows.length,2);
 assert.deepEqual(new Set(reviews.rows.map(r=>r.word_id)),
  new Set([one.id,two.id]));
 const progress=await db.query(
  'SELECT word_id,remembered FROM ws_learning_word_progress WHERE user_id=$1',[userId]
 );
 assert.equal(progress.rows.length,2);
 assert.ok(progress.rows.every(r=>r.remembered===false));
 const srs=await db.query(
  'SELECT count(*)::int AS n FROM ws_user_srs_schedules WHERE user_id=$1',[userId]
 );
 assert.ok(srs.rows[0].n>=2);
 pass('Firefox signed-in wrong pair auto-enqueues words to shared reviews and SRS');

 // UX34 face-down board: server reveals one tile at a time, wrong pairs
 // return to face-down after the brief memorization window, no heart loss.
 const memoryFlag=await db.query("SELECT enabled FROM ws_features WHERE feature_key='MEMORY'");
 assert.equal(memoryFlag.rows.length,1,'UX34 migration must create MEMORY feature');
 assert.equal(memoryFlag.rows[0].enabled,false,'MEMORY remains disabled by default');
 await db.query("UPDATE ws_features SET enabled=true WHERE feature_key='MEMORY'");
 const memoryPage=await guest.newPage();
 await memoryPage.goto(BASE+'/memory.html');
 await memoryPage.locator('#matrixSize').selectOption('6');
 await memoryPage.locator('#matrixStart').click();
 await memoryPage.locator('.matrix-card').first().waitFor({state:'visible'});
 assert.equal(await memoryPage.locator('.matrix-card').count(),36);
 assert.equal(await memoryPage.locator('.matrix-card--hidden').count(),36);
 const memoryRun=await memoryPage.evaluate(()=>JSON.parse(sessionStorage.getItem('wordsky_ux34_memory_run')||'null'));
 assert.match(memoryRun,/^[a-f0-9-]{36}$/i);runIds.push(memoryRun);
 const row=(await db.query('SELECT state,duration_seconds FROM ws_solo_runs WHERE id=$1',[memoryRun])).rows[0];
 assert.equal(row.duration_seconds,180);
 const p0=row.state.pairs[0],p1=row.state.pairs[1];
 await memoryPage.locator('[data-matrix-id="'+p0.enId+'"]').click();
 await memoryPage.waitForFunction(id=>document.querySelector('[data-matrix-id="'+id+'"]')?.classList.contains('is-flipped'),p0.enId);
 assert.equal(await memoryPage.locator('.matrix-card--hidden').count(),35);
 await memoryPage.locator('[data-matrix-id="'+p1.viId+'"]').click();
 await memoryPage.waitForFunction(()=>document.getElementById('matrixHearts')?.textContent?.includes('1 lần sai'));
 await memoryPage.waitForFunction(()=>document.querySelectorAll('.matrix-card--hidden').length===36);
 assert.equal((await db.query('SELECT health FROM ws_solo_runs WHERE id=$1',[memoryRun])).rows[0].health,3);
 await memoryPage.locator('[data-matrix-id="'+p0.enId+'"]').click();
 await memoryPage.waitForFunction(id=>document.querySelector('[data-matrix-id="'+id+'"]')?.classList.contains('is-flipped'),p0.enId);
 await memoryPage.locator('[data-matrix-id="'+p0.viId+'"]').click();
 await memoryPage.waitForFunction(()=>document.getElementById('matrixScore')?.textContent==='100');
 assert.equal(await memoryPage.locator('.matrix-card.is-matched').count(),2);
 assert.equal(await memoryPage.evaluate(()=>window.WordSkyAudio?.getState().scene),'MEMORY');
 pass('MEMORY 6x6 face-down, private reveal, auto flip-back, no heart loss, and correct pair lock');

 // 5x5 MEMORY: 24 hidden cards and one stable, inert centre slot.
 await memoryPage.evaluate(()=>{
  sessionStorage.removeItem('wordsky_ux34_memory_run');
  sessionStorage.removeItem('wordsky_ux34_memory_pending');
 });
 await memoryPage.goto(BASE+'/memory.html');
 await memoryPage.locator('#matrixSize').selectOption('5');
 await memoryPage.locator('#matrixStart').click();
 await memoryPage.locator('.matrix-card--hidden').first().waitFor({state:'visible'});
 assert.equal(await memoryPage.locator('.matrix-card--hidden').count(),24);
 assert.equal(await memoryPage.locator('.matrix-card-space').count(),1);
 const memory5=await memoryPage.evaluate(()=>JSON.parse(sessionStorage.getItem('wordsky_ux34_memory_run')||'null'));
 assert.match(memory5,/^[a-f0-9-]{36}$/i);runIds.push(memory5);
 pass('MEMORY 5x5: 24 private hidden cards and one inert centre slot');
 console.log('UX35 MATRIX + MEMORY SOLO LOCAL E2E: PASS');
}finally{
 for(const browser of [chrome,fox])if(browser)await browser.close().catch(()=>{});
 for(const userId of userIds){
  await db.query('DELETE FROM ws_learning_review_requests WHERE user_id=$1',[userId]).catch(()=>{});
  await db.query('DELETE FROM ws_learning_flashcard_reviews WHERE user_id=$1',[userId]).catch(()=>{});
  await db.query('DELETE FROM ws_learning_word_progress WHERE user_id=$1',[userId]).catch(()=>{});
  await db.query('DELETE FROM ws_user_srs_schedules WHERE user_id=$1',[userId]).catch(()=>{});
 }
 if(runIds.length)await db.query('DELETE FROM ws_solo_runs WHERE id=ANY($1::uuid[])',[runIds]).catch(()=>{});
 for(const userId of userIds)await db.query('DELETE FROM ws_users WHERE id=$1',[userId]).catch(()=>{});
 await db.query("UPDATE ws_features SET enabled=false WHERE feature_key='MATRIX'").catch(()=>{});
 await db.query("UPDATE ws_features SET enabled=false WHERE feature_key='MEMORY'").catch(()=>{});
 await db.end();
}
