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
    const m=input.match(/^V(1|2): (.+) → (V1|V2|V3) là gì\?$/);
    assert.ok(m,'Unexpected prompt '+input);
    const answer=await page.evaluate(async ({source,clue,target})=>{
     const {listVerbEntries}=await import('/verb-dictionary.js');
     const rows=listVerbEntries();
     const matches=rows.filter(v=>v['v'+source]===clue);
     if(matches.length!==1)throw Error('Ambiguous or missing clue: '+clue);
     return matches[0][target.toLowerCase()].split(' / ')[0];
    },{source:m[1],clue:m[2],target:m[3]});
    await page.locator('#ws48Answer').fill(answer);
    await page.locator('#ws48Submit').click();
    assert.match(await page.locator('#ws48Feedback').innerText(),/Chính xác/);
    await page.locator('#ws48NextQuestion').click();
   }
   assert.match(await page.locator('#ws48Question').innerText(),/10\/10 câu đúng/);

   assert.equal(await page.locator('#ws50Retry').isVisible(),false);
   assert.match(await page.locator('#ws50Summary').innerText(),/0 câu sai/);
   await page.locator('#ws48Start').click();
   for(let number=1;number<=10;number++){
    const prompt=await page.locator('#ws48Question').innerText();
    const match=prompt.match(/^V(1|2): (.+) → (V1|V2|V3) là gì\?$/);
    assert.ok(match,'Unexpected retry scenario prompt: '+prompt);
    const right=await page.evaluate(async ({source,clue,target})=>{
     const {listVerbEntries}=await import('/verb-dictionary.js');
     const verb=listVerbEntries().find(v=>v['v'+source]===clue);
     if(!verb)throw Error('No verb found for '+clue);
     return verb[target.toLowerCase()].split(' / ')[0];
    },{source:match[1],clue:match[2],target:match[3]});
    await page.locator('#ws48Answer').fill(number===1?'incorrect-answer':right);
    await page.locator('#ws48Submit').click();
    await page.locator('#ws48NextQuestion').click();
   }
   assert.match(await page.locator('#ws50Summary').innerText(),/9 \/ 10 đúng · 1 câu sai/);
   assert.equal(await page.locator('.ws50-mistake').count(),1);
   await page.locator('#ws50Retry').click();
   assert.match(await page.locator('#ws48Progress').innerText(),/Câu 1 \/ 1/);
   const retryPrompt=await page.locator('#ws48Question').innerText();
   const retryMatch=retryPrompt.match(/^V(1|2): (.+) → (V1|V2|V3) là gì\?$/);
   assert.ok(retryMatch,'Retry prompt missing');
   const retryCorrect=await page.evaluate(async ({source,clue,target})=>{
    const {listVerbEntries}=await import('/verb-dictionary.js');
    return listVerbEntries().find(v=>v['v'+source]===clue)[target.toLowerCase()].split(' / ')[0];
   },{source:retryMatch[1],clue:retryMatch[2],target:retryMatch[3]});
   await page.locator('#ws48Answer').fill(retryCorrect);
   await page.locator('#ws48Submit').click();
   await page.locator('#ws48NextQuestion').click();
   assert.match(await page.locator('#ws50Summary').innerText(),/1 \/ 1 đúng · 0 câu sai/);
   assert.equal(await page.locator('#ws50Retry').isVisible(),false);

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
