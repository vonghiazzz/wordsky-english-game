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
   assert.equal(await page.locator('#ws47Rows tr').count(),20);
   assert.match(await page.locator('#ws47Showing').innerText(),/Trang 1 \/ 8/);
   await page.locator('#ws48Next').click();
   assert.equal(await page.locator('#ws47Rows tr').count(),20);
   assert.match(await page.locator('#ws47Showing').innerText(),/Trang 2 \/ 8/);
   await page.locator('#ws48Prev').click();
   assert.match(await page.locator('#ws47Showing').innerText(),/Trang 1 \/ 8/);
   await page.locator('#ws47Search').fill('went');
   assert.equal(await page.locator('#ws47Rows tr').count(),1);
   const onlyRow=await page.locator('#ws47Rows tr').innerText();
   assert.match(onlyRow,/go/);assert.match(onlyRow,/went/);assert.match(onlyRow,/gone/);assert.match(onlyRow,/đi/);
   assert.equal(await page.locator('#ws47Rows tr:first-child td').count(),4);
   assert.equal(await page.locator('#ws47Rows details').count(),0);
   assert.equal(await page.locator('.ws47-usage').count(),0);
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
   await page.locator('#ws48Start').click();
   assert.ok(await page.locator('#ws48Quiz').isVisible());
   for(let number=1;number<=10;number++){
    assert.match(await page.locator('#ws48Progress').innerText(),new RegExp('Câu '+number+' / 10'));
    const input=await page.locator('#ws48Question').innerText();
    const m=input.match(/^V1: (\\w+) → (V2|V3) là gì\\?$/);
    assert.ok(m,'Unexpected prompt '+input);
    const form=await page.evaluate(async ({word})=>{
     const {lookupVerbForms}=await import('/verb-forms.js');
     return lookupVerbForms(word);
    },{word:m[1]});
    const answer=(m[2]==='V2'?form.v2:form.v3).split(' / ')[0];
    await page.locator('#ws48Answer').fill(answer);
    await page.locator('#ws48Submit').click();
    assert.match(await page.locator('#ws48Feedback').innerText(),/Chính xác/);
    await page.locator('#ws48NextQuestion').click();
   }
   assert.match(await page.locator('#ws48Question').innerText(),/10\/10 câu đúng/);
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
