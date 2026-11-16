/** UX44 pronunciation UI smoke; mocked Web Speech on isolated localhost only.
 * No real microphone, speaker, network TTS, user review or DB writes.
 */
import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';
const BASE = process.env.WORDSKY_E2E_BASE || 'http://localhost:3000';
const names = [['Chromium',chromium],['Firefox',firefox]];

function installSpeechProbe() {
  const probe = window.__wsSpeechQA = {spoken: [], canceled: 0};
  const synth = {
    speaking: false, pending: false,
    getVoices() {return [{lang:'en-GB',name:'UK QA'}];},
    cancel() {probe.canceled++; synth.speaking = false;},
    speak(utterance) {
      probe.spoken.push({text:utterance.text,lang:utterance.lang,rate:utterance.rate});
      synth.speaking = true;
    }
  };
  Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:synth});
  window.SpeechSynthesisUtterance = class {constructor(text) {this.text=text;}};
}

const failures = [];
for(const [name,engine] of names) {
  const browser = await engine.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:360,height:800}});
    await context.addInitScript(installSpeechProbe);
    const page = await context.newPage();
    await page.route('**/api/**', route => {
      if (!['GET','HEAD','OPTIONS'].includes(route.request().method()))
        return route.abort('blockedbyclient');
      return route.continue();
    });
    await page.goto(BASE+'/learn.html#flash', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.WordSkySpeech?.supported===true &&
      document.querySelector('#flashSpeak:not([disabled])')?.getAttribute('aria-label')?.includes('Nghe phát âm'));
    const initial = await page.locator('#word').textContent();
    assert.ok(initial?.trim());
    assert.equal(await page.locator('#flashCard').evaluate(el=>el.classList.contains('flipped')),false);
    await page.locator('#flashSpeak').click();
    const first = await page.evaluate(() => window.__wsSpeechQA.spoken.at(-1));
    assert.equal(first.text,initial,name+' pronounced wrong word');
    assert.equal(first.lang,'en-GB');
    assert.equal(first.rate,0.88);
    assert.equal(await page.locator('#flashCard').evaluate(el=>el.classList.contains('flipped')),false,
      name+' speech click flipped Flashcard');
    assert.equal(await page.locator('#flashSpeak').getAttribute('aria-pressed'),'true');

    const spokenBefore = await page.evaluate(() => window.__wsSpeechQA.spoken.length);
    await page.locator('#next').click();
    await page.waitForFunction(word => document.getElementById('word').textContent !== word,initial);
    assert.equal(await page.locator('#flashSpeak').getAttribute('aria-pressed'),'false');
    assert.equal(await page.evaluate(()=>window.__wsSpeechQA.spoken.length),spokenBefore,
      name+' autoplayed on Flashcard navigation');
    const next = await page.locator('#word').textContent();
    await page.locator('#flashSpeak').click();
    assert.equal((await page.evaluate(()=>window.__wsSpeechQA.spoken.at(-1))).text,next);
    assert.ok(await page.evaluate(()=>window.__wsSpeechQA.canceled>=2));
    const rect = await page.locator('#flashSpeak').boundingBox();
    assert.ok(rect && rect.x >= -1 && rect.x+rect.width <= 361,
      name+' pronunciation button overflows mobile viewport');

    await page.goto(BASE+'/practice.html',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('#ws28Feedback').isVisible(),false,
      name+' answer pronunciation leaked before grading');
    assert.equal(await page.locator('#ws28HearAnswer').isVisible(),false);
    await context.close();

    const unsupported = await browser.newContext({viewport:{width:390,height:800}});
    await unsupported.addInitScript(() => {
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});
      window.SpeechSynthesisUtterance=undefined;
    });
    const noVoice = await unsupported.newPage();
    await noVoice.goto(BASE+'/learn.html#flash',{waitUntil:'domcontentloaded'});
    await noVoice.waitForFunction(() => !!window.WordSkySpeech);
    assert.equal(await noVoice.evaluate(()=>window.WordSkySpeech.supported),false);
    assert.equal(await noVoice.locator('#flashSpeak').isDisabled(),true);
    await unsupported.close();
    console.log('PASS: UX44 '+name+' user-initiated UK speech, mobile layout, no answer leak, unavailable fallback');
  } catch(error) {
    failures.push(name+': '+(error.stack||error.message));
  } finally {
    await browser.close();
  }
}
if(failures.length) {
  console.error('UX44 BROWSER SPEECH QA FAILED\n'+failures.join('\n'));
  process.exitCode=1;
} else console.log('UX44 BROWSER SPEECH QA PASS: Chromium + Firefox');
