/** UX47 isolated, read-only acceptance: English verb table and responsive lookup. */
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';
const BASE=process.env.WORDSKY_E2E_BASE||'http://localhost:3000';
const tests=[['Chromium',chromium],['Firefox',firefox]];
for(const [label,engine] of tests){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [360,1280]){
   const context=await browser.newContext({viewport:{width,height:820},reducedMotion:'reduce'});
   const page=await context.newPage();
   await page.route('**/api/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))
     return route.abort('blockedbyclient');
    return route.continue();
   });
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(BASE+'/verbs.html',{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);
   await page.waitForFunction(()=>document.querySelector('#ws47Count')?.textContent.includes('141'));
   assert.equal(await page.locator('#ws47Rows tr').count(),35);
   await page.locator('#ws47Search').fill('went');
   assert.equal(await page.locator('#ws47Rows tr').count(),1);
   const onlyRow=await page.locator('#ws47Rows tr').innerText();
   assert.match(onlyRow,/go/);assert.match(onlyRow,/went/);assert.match(onlyRow,/gone/);assert.match(onlyRow,/đi/);
   await page.locator('#ws47Rows details summary').click();
   assert.match(await page.locator('#ws47Rows details').innerText(),/I went to school yesterday/);
   await page.locator('#ws47Search').fill('gone');
   assert.equal(await page.locator('#ws47Rows tr').count(),1);
   await page.locator('#ws47Search').fill('go');
   assert.equal(await page.locator('#ws47Rows tr').count(),1);
   await page.locator('#ws47Search').fill('studied');
   assert.equal(await page.locator('#ws47Rows tr').count(),1);
   await page.locator('#ws47Type').selectOption('irregular');
   assert.equal(await page.locator('#ws47Rows tr').count(),0);
   await page.locator('#ws47Type').selectOption('regular');
   assert.equal(await page.locator('#ws47Rows tr').count(),1);
   await page.locator('#ws47Search').fill('');
   const doc=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth}));
   assert.ok(doc.scrollWidth<=doc.innerWidth+2,'Unexpected horizontal viewport overflow: '+JSON.stringify(doc));
   const back=await page.goto(BASE+'/progress.html',{waitUntil:'domcontentloaded'});
   assert.equal(back.status(),200);
   assert.ok(await page.locator('.ws10-hero .ws10-actions a[href="/verbs.html"]').isVisible());
   assert.ok(await page.locator('.ws47-launch a[href="/verbs.html"]').isVisible());
   assert.deepEqual(errors,[],label+' JS errors');
   await context.close();
   console.log('PASS UX47 '+label+' '+width+'px table and My Learning links');
  }
 }finally{await browser.close();}
}
