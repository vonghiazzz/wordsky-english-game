/**
 * UX39 mobile navigation acceptance. Read-only, isolated localhost Playwright.
 * Never log in, start a run, submit a match or write account progress.
 */
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';

const ORIGIN='http://localhost:3000';
const ROUTES=[
 ['/#home','home'],
 ['/#solo','solo'],
 ['/#solo-bomb','solo'],
 ['/#solo-car','solo'],
 ['/#rooms','rooms'],
 ['/learn.html#flash','flash'],
 ['/learn.html#game','solo'],
 ['/matrix.html','solo'],
 ['/memory.html','solo'],
 ['/progress.html','attendance'],
 ['/personal.html','flash'],
 ['/practice.html','attendance'],
 ['/mistakes.html','attendance']
];
const DOCK_KEYS=['home','flash','solo','rooms','attendance'];
const reports=[];
const errors=[];
for(const [browserName,browserType] of [['Chromium',chromium],['Firefox',firefox]]){
 const browser=await browserType.launch({headless:true});
 try{
  for(const width of [360,390]){
   const ctx=await browser.newContext({viewport:{width,height:820},reducedMotion:'reduce'});
   const page=await ctx.newPage();
   try{
    // Even on localhost, nav regression QA must not mutate game/account data.
    await page.route('**/api/**',route=>{
     const method=route.request().method().toUpperCase();
     if(!['GET','HEAD','OPTIONS'].includes(method)){
      errors.push(method+' '+route.request().url());
      return route.abort('blockedbyclient');
     }
     return route.continue();
    });
    for(const [path,active] of ROUTES){
     const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:30000});
     assert.equal(response.status(),200,browserName+' '+path+' HTTP');
     await page.waitForFunction(()=>document.body.classList.contains('ws-mobile-dock-visible'));
     await page.locator('#wsSharedNav .ws-mobile-dock').waitFor({state:'visible'});
     const result=await page.evaluate(()=>{
      const dock=document.querySelector('#wsSharedNav .ws-mobile-dock');
      const links=[...dock.querySelectorAll('a[data-ws-dock]')];
      const r=dock.getBoundingClientRect();
      const focus=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return{
       display:getComputedStyle(dock).display,
       active:links.filter(a=>a.classList.contains('is-active')).map(a=>a.dataset.wsDock),
       keys:links.map(a=>a.dataset.wsDock),
       bottom:window.innerHeight-r.bottom,
       top:r.top,height:r.height,
       padding:parseFloat(getComputedStyle(document.body).paddingBottom),
       interactive:Boolean(focus?.closest('#wsSharedNav .ws-mobile-dock'))
      };
     });
     assert.equal(result.display,'grid',browserName+' '+path+' dock CSS not loaded');
     assert.deepEqual(result.keys,DOCK_KEYS,browserName+' '+path+' dock destinations');
     assert.deepEqual(result.active,[active],browserName+' '+path+' wrong active tab');
     assert.ok(Math.abs(result.bottom)<=3,browserName+' '+path+' dock not at viewport bottom: '+JSON.stringify(result));
     assert.ok(result.padding+2>=result.height,
      browserName+' '+path+' missing safe-area space: '+JSON.stringify(result));
     assert.ok(result.interactive,browserName+' '+path+' dock overlaid by another control');
     if(path==='/matrix.html'||path==='/memory.html'){
      assert.equal(await page.locator('#matrixResult a').count(),0,'duplicate result anchors');
      assert.equal(await page.locator('#matrixAgain').count(),1,'replay button removed');
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      const bounds=await page.evaluate(()=>{
       const button=document.querySelector('#matrixStart')?.getBoundingClientRect();
       const dock=document.querySelector('.ws-mobile-dock').getBoundingClientRect();
       return {buttonBottom:button?.bottom,dockTop:dock.top};
      });
      assert.ok(bounds.buttonBottom<bounds.dockTop,
       browserName+' '+path+' matrix Start button covered: '+JSON.stringify(bounds));
     }
     if(path==='/#rooms'){
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      const bounds=await page.evaluate(()=>{
       const button=document.querySelector('#joinForm button[type="submit"]')?.getBoundingClientRect();
       const dock=document.querySelector('.ws-mobile-dock').getBoundingClientRect();
       return {buttonBottom:button?.bottom,dockTop:dock.top};
      });
      assert.ok(bounds.buttonBottom<bounds.dockTop,
       browserName+' '+path+' Join/Ready form covered: '+JSON.stringify(bounds));
     }
     reports.push(browserName+' '+width+'px '+path);
    }
    // Verify actual transitions, not just static dock markup.
    await page.goto(ORIGIN+'/matrix.html',{waitUntil:'domcontentloaded'});
    await page.locator('[data-ws-dock="rooms"]').click();
    await page.waitForURL(u=>u.pathname==='/'&&u.hash==='#rooms');
    await page.locator('#screen-rooms.active').waitFor({state:'visible'});
    await page.locator('[data-ws-dock="solo"]').click();
    await page.waitForURL(u=>u.pathname==='/'&&u.hash==='#solo');
    await page.locator('#screen-solo.active').waitFor({state:'visible'});
   }finally{await ctx.close();}
  }
 }finally{await browser.close();}
}
assert.deepEqual(errors,[],'unexpected API writes during UX39 navigation QA');
console.log('UX39 NAVIGATION BROWSER E2E: PASS '+reports.length+
 ' routes (Chromium/Firefox, 360px and 390px, no production writes).');
