/* UX57 isolated browser acceptance for insufficient distinct cues.
 * Runs ONLY against localhost test server with a mocked POST response.
 * No real game creation, user login, DB or Production access.
 */
import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';

const BASE='http://127.0.0.1:3000';
const expected='Không đủ từ có gợi ý tiếng Việt riêng biệt cho vòng này. Hãy chọn chủ đề khác hoặc giảm số câu.';
for(const [browserName,engine] of [['Chromium',chromium],['Firefox',firefox]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const [mode,hash,form,startPath] of [
   ['MATCH','#solo','#soloSetupForm','/api/solo/match/start'],
   ['BOMB','#solo-bomb','#soloBombSetupForm','/api/solo/bomb/start']
  ]){
   const context=await browser.newContext({viewport:{width:360,height:780}});
   try{
    const page=await context.newPage();
    let posts=0;
    await page.route('**'+startPath,async route=>{
     assert.equal(route.request().method(),'POST');
     posts++;
     await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:expected})});
    });
    await page.goto(BASE+'/'+hash,{waitUntil:'domcontentloaded'});
    await page.locator(form).waitFor({state:'visible',timeout:15000});
    await page.locator(form+' button[type="submit"]').click();
    await page.getByRole('alert').filter({hasText:expected}).waitFor({state:'visible',timeout:12000});
    assert.equal(posts,1,mode+' must issue exactly one mocked game-start POST');
    assert.ok((await page.locator(form).isVisible()),'Setup form should remain after 400');
    const retry=page.locator(mode==='MATCH'?'#soloStartRetry':'#soloBombStartRetry');
    assert.ok(await retry.isVisible(),'Error retry button should be visible');
    const status=await page.locator('.game-status.bad[role="alert"]').textContent();
    assert.ok(status.includes('Hãy chọn chủ đề khác hoặc giảm số câu'));
    // Retry must be explicit; no automatic resubmission of a rejected game.
    await page.waitForTimeout(250);
    assert.equal(posts,1,'No automatic retry permitted');
    console.log('PASS: UX57 '+browserName+' '+mode+' 400 explanation remains accessible at 360px');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
console.log('UX57 LOCAL ERROR UI E2E: PASS (Chromium and Firefox, MATCH and BOMB)');
