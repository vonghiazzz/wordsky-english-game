/* UX43E1 — isolated PostgreSQL17, Chromium/Firefox, 360/390px Admin draft QA.
 * Never use Production credentials, databases or real learner data.
 * Every prompt inserted here stays approved=false,active=false.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {chromium,firefox} from 'playwright';
import {hashPassword} from '../lib/security.js';
const BASE='http://localhost:3000';
const ADMIN_PASSWORD='WordSkyAdminQa_2026!';
const PLAYER_PASSWORD='Qa43e1Only2026!';
const dbUrl=new URL(process.env.DATABASE_URL||'http://invalid');
assert.equal(dbUrl.protocol,'postgresql:');
assert.equal(dbUrl.hostname,'127.0.0.1');
assert.equal(dbUrl.port,'5547');
assert.equal(dbUrl.pathname,'/wordsky_v6_test');
assert.equal(dbUrl.username,'wordsky_test');
assert.equal(process.env.WORDSKY_RECALL_PREVIEW_ENABLED,'true');
assert.notEqual(process.env.VERCEL_ENV,'production');
const db=new pg.Pool({connectionString:dbUrl.toString(),ssl:false});
let browserA,browserB,draftId,userId;
const contexts=[];
const pass=text=>console.log('PASS: UX43E1 '+text);
async function login(ctx,name,password){
 const response=await ctx.request.post(BASE+'/api/auth/login',{
  headers:{origin:BASE},data:{username:name,password}
 });
 assert.equal(response.status(),200,await response.text());
}
const url=path=>BASE+'/api/admin/recall/'+path;
const send=(ctx,path,body,origin=BASE,method='POST')=>ctx.request.fetch(url(path),{
 method,headers:origin===null?{'content-type':'application/json'}:{origin,'content-type':'application/json'},
 data:JSON.stringify(body)
});
try{
 assert.equal((await db.query('SELECT current_database() AS name')).rows[0].name,'wordsky_v6_test');
 const word=(await db.query(
  "SELECT w.id::text,w.english,w.meaning "+
  "FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id "+
  "WHERE w.enabled=true AND t.enabled=true "+
  "AND w.english ~ '^[A-Za-z]{3,15}$' ORDER BY w.english LIMIT 1"
 )).rows[0];
 assert.ok(word,'QA requires an enabled alphabetic word');
 const allActiveBefore=(await db.query(
  'SELECT count(*)::int AS n FROM ws_recall_curated_prompts WHERE approved=true AND active=true'
 )).rows[0].n;
 const name='qa43e1'+randomBytes(5).toString('hex');
 const player=(await db.query(
  'INSERT INTO ws_users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id',
  [name,'UX43E1 disposable player',hashPassword(PLAYER_PASSWORD)]
 )).rows[0];
 userId=player.id;
 const revision='qa43e1-'+randomBytes(7).toString('hex');
 const cue='Giải nghĩa tiếng Việt được soạn riêng cho kiểm thử';
 const input={
  word_id:word.id,prompt_vi:cue,accepted_english:[word.english],
  answer_revision:revision,admin_password:ADMIN_PASSWORD
 };
 browserA=await chromium.launch({headless:true});
 browserB=await firefox.launch({headless:true});
 const adminA=await browserA.newContext({viewport:{width:360,height:780}});
 const adminB=await browserB.newContext({viewport:{width:390,height:780}});
 const playerCtx=await browserB.newContext();
 const guestCtx=await browserA.newContext();
 contexts.push(adminA,adminB,playerCtx,guestCtx);
 assert.equal((await guestCtx.request.get(url('words'))).status(),401);
 await login(playerCtx,name,PLAYER_PASSWORD);
 assert.equal((await playerCtx.request.get(url('words'))).status(),401);
 assert.equal((await send(playerCtx,'drafts',input)).status(),401);
 pass('guest and signed-in player cannot read or create Admin drafts');

 await login(adminA,'owner',ADMIN_PASSWORD);
 await login(adminB,'owner',ADMIN_PASSWORD);
 const list=await adminA.request.get(url('words?q='+encodeURIComponent(word.english)+'&page=0&size=20'));
 assert.equal(list.status(),200,await list.text());
 const found=await list.json();
 assert.ok(found.words.some(x=>x.id===word.id));
 assert.equal((await send(adminA,'drafts',input,null)).status(),403);
 assert.equal((await send(adminA,'drafts',{...input,admin_password:'wrong'})).status(),403);
 assert.equal((await send(adminA,'drafts',{...input,approved:true})).status(),400);
 assert.equal((await send(adminA,'drafts',{...input,active:true})).status(),400);
 const before=(await db.query('SELECT count(*)::int AS n FROM ws_recall_curated_prompts WHERE answer_revision=$1',[revision])).rows[0].n;
 assert.equal(before,0);
 pass('strict Origin, Admin password step-up and no injected approval/activation');

 const page=await adminA.newPage();
 await page.goto(BASE+'/admin-recall.html');
 await page.locator('#rcApp').waitFor({state:'visible'});
 await page.locator('#rcWordSearch').fill(word.english);
 await page.locator('#rcFindWord button[type=submit]').click();
 await page.locator('#rcWords .au-user button').first().waitFor({state:'visible'});
 await page.locator('#rcWords .au-user button').first().click();
 assert.equal(await page.locator('#rcSelectedWordId').inputValue(),word.id);
 await page.locator('#rcPrompt').fill(cue);
 await page.locator('#rcAnswers').fill(word.english);
 await page.locator('#rcRevision').fill(revision);
 await page.locator('#rcPassword').fill(ADMIN_PASSWORD);
 await page.locator('#rcSave').click();
 await page.locator('#rcDrafts .rc-draft').first().waitFor({state:'visible',timeout:15000});
 assert.match(await page.locator('#rcSaveStatus').textContent(),/Đã lưu bản nháp/);
 assert.equal(await page.locator('#rcPassword').inputValue(),'');
 const overflow=await page.evaluate(()=>
  document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<=1,'Admin 360px overflow '+overflow);
 const stored=(await db.query(
  'SELECT id::text,approved,active,curator,answer_revision FROM ws_recall_curated_prompts WHERE answer_revision=$1',
  [revision]
 )).rows;
 assert.equal(stored.length,1);
 draftId=stored[0].id;
 assert.equal(stored[0].approved,false);
 assert.equal(stored[0].active,false);
 assert.equal(stored[0].curator,'owner');
 assert.equal((await db.query(
  'SELECT count(*)::int AS n FROM ws_recall_curated_prompts WHERE approved=true AND active=true'
 )).rows[0].n,allActiveBefore);
 pass('mobile Chromium creates exactly one disabled/unapproved prompt; no activation');

 const duplicate=await send(adminA,'drafts',input);
 assert.equal(duplicate.status(),409,'Same catalog word and version cannot be inserted twice');
 const otherOrigin=await send(adminA,'drafts',{
  ...input,answer_revision:revision+'-another'
 },'https://attacker.invalid');
 assert.equal(otherOrigin.status(),403);
 const adminBResults=await adminB.request.get(url('drafts?q='+encodeURIComponent(word.english)));
 assert.equal(adminBResults.status(),200);
 const listing=await adminBResults.json();
 assert.equal(listing.approval_available,false);
 const expected=listing.drafts.find(x=>x.id===draftId);
 assert.ok(expected);
 assert.equal(expected.approved,false);
 assert.equal(expected.active,false);
 assert.equal(expected.prompt_vi,cue);
 assert.equal((await send(adminA,'drafts/'+draftId,{
  admin_password:ADMIN_PASSWORD,confirm_revision:'wrong-version'
 },BASE,'DELETE')).status(),409);
 pass('Firefox Admin sees durable draft; duplicate versions and wrong discard confirmation blocked');

 const ff=await adminB.newPage();
 await ff.goto(BASE+'/admin-recall.html');
 await ff.locator('#rcApp').waitFor({state:'visible'});
 await ff.locator('#rcDraftSearch').fill(word.english);
 await ff.locator('#rcFindDraft button[type=submit]').click();
 await ff.locator('#rcDrafts .rc-remove').first().waitFor({state:'visible'});
 await ff.locator('#rcDrafts .rc-remove').first().click();
 await ff.locator('#rcDeleteDialog').waitFor({state:'visible'});
 await ff.locator('#rcConfirmRevision').fill(revision);
 await ff.locator('#rcDeletePassword').fill(ADMIN_PASSWORD);
 await ff.locator('#rcConfirmDelete').click();
 await ff.locator('#rcDeleteDialog').waitFor({state:'hidden',timeout:15000});
 const overflowB=await ff.evaluate(()=>
  document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflowB<=1,'Admin Firefox 390px overflow '+overflowB);
 assert.equal((await db.query(
  'SELECT count(*)::int AS n FROM ws_recall_curated_prompts WHERE id=$1',[draftId]
 )).rows[0].n,0);
 draftId=null;
 assert.equal((await db.query(
  'SELECT count(*)::int AS n FROM ws_recall_curated_prompts WHERE approved=true AND active=true'
 )).rows[0].n,allActiveBefore);
 assert.equal((await db.query(
  'SELECT count(*)::int AS n FROM ws_recall_evidence WHERE user_id=$1',[userId]
 )).rows[0].n,0);
 pass('Firefox mobile discards only draft after Admin proof; no changes to SRS or player evidence');
 console.log('UX43E1 ISOLATED ADMIN CURATION E2E: PASS');
}catch(error){
 console.error('UX43E1 ISOLATED ADMIN CURATION E2E: FAIL',error?.stack||error);
 process.exitCode=1;
}finally{
 await Promise.allSettled(contexts.map(c=>c.close()));
 await Promise.allSettled([browserA?.close(),browserB?.close()]);
 try{
  if(draftId)await db.query(
   'DELETE FROM ws_recall_curated_prompts WHERE id=$1 AND approved=false AND active=false',
   [draftId]
  );
  if(userId)await db.query('DELETE FROM ws_users WHERE id=$1',[userId]);
 }catch(error){
  console.error('UX43E1 isolated cleanup failed:',error?.code||'unknown');
  process.exitCode=1;
 }
 await db.end();
 console.log('UX43E1 isolated QA cleanup completed');
}
