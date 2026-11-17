/**
 * UX45: read-only Production acceptance for anonymous browsing.
 * No login, no cookies from users, no API writes, no games started and no DB mutations.
 * Real audio hardware and authenticated account/SRS correctness are explicitly out of scope.
 */
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';

const BASE='https://wordsky-english-game.vercel.app';
const TIMEOUT=20000;
const safeMethods=new Set(['GET','HEAD','OPTIONS']);
const publicPages=[
 '/','/learn.html','/progress.html','/personal.html','/practice.html',
 '/matrix.html','/memory.html','/mistakes.html',
 '/vocab-speech.js','/vocab-speech.css','/ux10-progress.js',
 '/ux18-personal.js','/ux28-practice.js','/shared-nav.js'
];
const reports=[];

function pass(item,detail=''){
 reports.push({result:'PASS',item,detail});
 console.log('PASS: '+item+(detail?' — '+detail:''));
}
async function request(path){
 const target=new URL(path,BASE);
 assert.equal(target.origin,BASE);
 const response=await fetch(target,{
  method:'GET',redirect:'manual',
  headers:{'Cache-Control':'no-store'},
  signal:AbortSignal.timeout(TIMEOUT)
 });
 return response;
}
async function json(path,status=200){
 const response=await request(path);
 assert.equal(response.status,status,path+' HTTP status');
 const data=await response.json();
 assert.ok(data&&typeof data==='object',path+' expected JSON');
 return data;
}
function installFakeTTS(){
 const qa=window.__ux45Speech={spoken:[],cancellations:0};
 const synth={
  speaking:false,pending:false,
  getVoices(){return [{lang:'en-GB',name:'UX45 mock UK'}];},
  cancel(){qa.cancellations++;this.speaking=false;this.pending=false;},
  speak(utterance){
   qa.spoken.push({text:utterance.text,lang:utterance.lang,rate:utterance.rate});
   this.speaking=true;
  }
 };
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
 window.SpeechSynthesisUtterance=class {
  constructor(text){this.text=text;}
 };
}
async function browserQA(name,engine,width){
 const browser=await engine.launch({headless:true});
 const invalidRequests=[],pageErrors=[];
 try {
  const context=await browser.newContext({
   viewport:{width,height:840},
   serviceWorkers:'block',
   acceptDownloads:false,
   reducedMotion:'reduce'
  });
  try {
   await context.addInitScript(installFakeTTS);
   const page=await context.newPage();
   page.on('pageerror',error=>pageErrors.push(String(error.message).slice(0,300)));
   await page.route('**/*',route=>{
    const req=route.request(),method=req.method().toUpperCase(),target=new URL(req.url());
    if(target.origin!==BASE){return route.abort('blockedbyclient');}
    if(!safeMethods.has(method)){
     invalidRequests.push(method+' '+target.pathname);
     return route.abort('blockedbyclient');
    }
    return route.continue();
   });
   const flashResponse=await page.goto(BASE+'/learn.html#flash',
    {waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(flashResponse.status(),200,name+' Flashcard HTML');
   await page.waitForFunction(()=>
    window.WordSkySpeech?.supported===true&&
    document.querySelector('#flashSpeak:not([disabled])')&&
    document.querySelector('#word')?.textContent?.trim(),
    null,{timeout:TIMEOUT});
   // The page initially displays a local sample card. Wait for the async
   // shared catalog to finish replacing it before testing playback state.
   // Otherwise its legitimate MutationObserver stops audio mid-assertion.
   await page.waitForFunction(() => {
    const status=document.getElementById('flashVocabularyStatus')?.textContent||'';
    return status.startsWith('Đã cập nhật ') &&
     document.getElementById('flashSource')?.value==='server' &&
     document.getElementById('refreshVocabulary')?.disabled===false;
   },null,{timeout:TIMEOUT});
   const first=await page.locator('#word').textContent();
   assert.ok(first?.trim(),name+' has a vocabulary term');
   const speak=page.locator('#flashSpeak');
   assert.equal(await speak.isVisible(),true,name+' speak button is visible');
   const before=await page.evaluate(()=>window.__ux45Speech.spoken.length);
   assert.equal(before,0,name+' speech must not autoplay');
   await speak.click();
   const speech=await page.evaluate(()=>window.__ux45Speech.spoken.at(-1));
   assert.equal(speech.text,first.trim(),name+' reads current English term');
   assert.equal(speech.lang,'en-GB',name+' mock UK voice');
   assert.equal(speech.rate,0.88,name+' learner rate');
   assert.equal(await speak.getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#flashCard').evaluate(el=>el.classList.contains('flipped')),
    false,name+' speech must not flip card');
   const area=await speak.boundingBox();
   assert.ok(area&&area.x>=-1&&area.x+area.width<=width+1,name+' mobile speak button fits');
   await speak.click();
   assert.equal(await speak.getAttribute('aria-pressed'),'false',
    name+' repeat tap stops audio');
   const spokenBeforeNext=await page.evaluate(()=>window.__ux45Speech.spoken.length);
   await page.locator('#next').click();
   await page.waitForFunction(english=>document.querySelector('#word')?.textContent?.trim()!==english,
    first.trim(),{timeout:TIMEOUT});
   assert.equal(await page.evaluate(()=>window.__ux45Speech.spoken.length),spokenBeforeNext,
    name+' no autoplay on Next');
   pass(name+' Production Flashcard speech','no autoplay, correct word, stop, next, no flip');

   const progressResponse=await page.goto(BASE+'/progress.html',
    {waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(progressResponse.status(),200);
   await page.locator('#ws10WordList .ws-speak-button').first()
    .waitFor({state:'visible',timeout:TIMEOUT});
   const listButton=page.locator('#ws10WordList .ws-speak-button').first();
   const aria=await listButton.getAttribute('aria-label');
   assert.match(aria,/^Nghe phát âm tiếng Anh: /u);
   await listButton.click();
   const pronounced=await page.evaluate(()=>window.__ux45Speech.spoken.at(-1)?.text);
   assert.equal(pronounced,aria.replace(/^Nghe phát âm tiếng Anh: /u,''));
   pass(name+' Production My Learning guest word list','speaker matches visible word');

   const personalResponse=await page.goto(BASE+'/personal.html',
    {waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(personalResponse.status(),200);
   assert.equal(await page.locator('#personalAccount').isVisible(),false,
    name+' guest should not see account vocabulary management');
   pass(name+' Production Personal guest gate','no account data or mutations');

   const practiceResponse=await page.goto(BASE+'/practice.html',
    {waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(practiceResponse.status(),200);
   assert.equal(await page.locator('#ws28Feedback').isVisible(),false,
    name+' must hide answer before a real attempt');
   assert.equal(await page.locator('#ws28HearAnswer').isVisible(),false,
    name+' must hide answer TTS before an attempt');
   pass(name+' Production Practice guest gate','no answer leak, no SRS write');

   assert.deepEqual(invalidRequests,[],name+' browser attempted write requests');
   assert.deepEqual(pageErrors,[],name+' uncaught JavaScript errors');
   pass(name+' Production read-only guard','no POST/PATCH/DELETE or page exceptions');
  }finally{await context.close();}
 }finally{await browser.close();}
}
async function run(){
 for(const path of publicPages){
  const response=await request(path);
  assert.equal(response.status,200,'Public asset '+path);
  const type=response.headers.get('content-type')||'';
  if(path.endsWith('.js'))assert.match(type,/javascript|text\/plain/u,path+' JS content type');
 }
 pass('Public pages and assets',publicPages.length+' GET requests returned HTTP 200');

 const html=await (await request('/learn.html')).text();
 assert.ok(html.includes('id="flashSpeak"'));
 assert.ok(html.includes('src="/vocab-speech.js"'));
 const script=await (await request('/vocab-speech.js')).text();
 assert.ok(script.includes('SpeechSynthesisUtterance'));
 assert.ok(script.includes("getVoices"));
 assert.ok(!script.includes('fetch('),'TTS must not fetch external audio or mutate DB');
 pass('UX44 Production assets','speech button and TTS code deployed');

 const health=await json('/api/health');
 assert.equal(health.ok,true);
 assert.equal(health.database,true);
 const topics=await json('/api/topics');
 assert.ok(Array.isArray(topics.topics)&&topics.topics.length>=26);
 const catalog=await json('/api/learning/vocabulary');
 assert.ok(Array.isArray(catalog.words)&&catalog.words.length>=365);
 assert.ok(catalog.words.every(x=>x.word_id&&x.english&&x.topic),
  'Production vocabulary has broken required fields');
 pass('Production public database reads',
  topics.topics.length+' topics, '+catalog.words.length+' words');

 const actor=await json('/api/auth/me');
 assert.equal(actor.actor,null,'new anonymous context must not be signed in');
 for(const privatePath of [
  '/api/learning/me/summary',
  '/api/learning/srs/queue',
  '/api/learning/personal',
  '/api/admin/features'
 ]){
  const response=await request(privatePath);
  assert.equal(response.status,401,privatePath+' must reject guest');
 }
 pass('Production account and admin isolation','guest identity null; protected GET returns 401');

 for(const [name,engine,width] of [['Chromium',chromium,360],['Firefox',firefox,390]])
  await browserQA(name,engine,width);
 console.log(JSON.stringify({
  protocol:'UX45-READONLY-V1',production:BASE,
  assertions:reports.length,
  browserEngines:['Chromium','Firefox'],
  accountWrites:0,dbMigrations:0,deployments:0,
  importantExclusions:[
   'No real speaker or iOS/Android voice hardware was tested',
   'No real authenticated account, cross-device sync, SRS update or game round was executed',
   'Only anonymous GET requests and mocked SpeechSynthesis were used'
  ]
 },null,2));
}
try{await run()}catch(error){
 console.error('FAIL: UX45 Production read-only smoke: '+(error.stack||String(error)));
 process.exitCode=1;
}
