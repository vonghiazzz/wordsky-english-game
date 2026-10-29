import assert from 'node:assert/strict';
import {chromium, firefox} from 'playwright';

const BASE = process.env.WORDSKY_E2E_BASE || 'http://localhost:3000';
const games = ['MATCH', 'BOMB', 'CAR', 'FALLING'];
const pass = value => console.log('PASS: ' + value);

// A deterministic fake AudioContext lets CI verify lifecycle, scheduling and volume
// without depending on host speakers or browser-specific autoplay devices.
function installAudioProbe() {
  const probe = window.__wsAudioProbe = {
    voices: 0, resumeCalls: 0, suspendCalls: 0, closeCalls: 0,
    liveTimers: new Set(), audioTimers: new Set()
  };
  const oldSet = window.setInterval.bind(window);
  const oldClear = window.clearInterval.bind(window);
  window.setInterval = (fn, delay, ...args) => {
    const id = oldSet(fn, delay, ...args);
    if ([220, 280, 340, 380].includes(delay)) {
      probe.liveTimers.add(id);
      probe.audioTimers.add(id);
    }
    return id;
  };
  window.clearInterval = id => {
    probe.liveTimers.delete(id);
    return oldClear(id);
  };
  class FakeAudioContext {
    state = 'running';
    currentTime = 10;
    destination = {};
    createGain() {
      return {
        gain: {value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}},
        connect() {}
      };
    }
    createOscillator() {
      return {
        frequency: {setValueAtTime() {}},
        connect() {},
        start() { probe.voices++; },
        stop() {},
        set type(value) { this.wave = value; }
      };
    }
    resume() { this.state = 'running'; probe.resumeCalls++; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; probe.suspendCalls++; return Promise.resolve(); }
    close() { this.state = 'closed'; probe.closeCalls++; return Promise.resolve(); }
  }
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
}

async function state(page) {
  return page.evaluate(() => ({
    ...window.WordSkyAudio.getState(),
    voices: window.__wsAudioProbe.voices,
    timerCount: window.__wsAudioProbe.liveTimers.size
  }));
}

let chrome, fox;
try {
  chrome = await chromium.launch({headless: true});
  fox = await firefox.launch({headless: true});

  for (const [name, browser] of [['Chromium', chrome], ['Firefox', fox]]) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    await context.addInitScript(installAudioProbe);
    const page = await context.newPage();

    // Arena: controls live on game screens, absent from the home page.
    await page.goto(BASE + '/#solo-bomb', {waitUntil: 'domcontentloaded'});
    await page.locator('#wsAudioPanel').waitFor({state: 'visible'});
    let current = await state(page);
    assert.equal(current.unlocked, false, name + ': no audio before interaction');
    assert.equal(current.voices, 0);
    assert.equal(current.timerCount, 0);

    await page.locator('[data-ws-audio-volume]').evaluate(el => {
      el.value = '60';
      el.dispatchEvent(new Event('input', {bubbles: true}));
    });
    assert.equal((await state(page)).volume, 60);

    await page.locator('[data-ws-audio-music]').click();
    assert.equal((await state(page)).music, false);
    await page.locator('[data-ws-audio-music]').click();
    assert.equal((await state(page)).music, true);

    for (const game of games) {
      await page.evaluate(mode => window.WordSkyAudio.setScene(mode, true), game);
      current = await state(page);
      assert.equal(current.scene, game);
      assert.equal(current.timerCount, 1, name + ': multiple music intervals for ' + game);
      assert.ok(current.voices > 0, name + ': no synthesized notes for ' + game);
    }
    await page.evaluate(() => window.WordSkyAudio.setScene('CAR', false));
    assert.equal((await state(page)).timerCount, 0);

    await page.evaluate(() => window.WordSkyAudio.setScene('MATCH', true));
    await page.locator('[data-ws-audio-effects]').click();
    assert.equal((await state(page)).effects, false);
    const silentVoices = (await state(page)).voices;
    await page.evaluate(() => window.WordSkyAudio.cue('win'));
    assert.equal((await state(page)).voices, silentVoices);
    await page.locator('[data-ws-audio-effects]').click();
    assert.equal((await state(page)).effects, true);
    const voiced = (await state(page)).voices;
    await page.evaluate(() => window.WordSkyAudio.cue('win'));
    assert.ok((await state(page)).voices > voiced);

    // Back-forward cache must not permanently disable the audio engine.
    await page.evaluate(() => {
      const event = new Event('pagehide');
      Object.defineProperty(event, 'persisted', {value: true});
      window.dispatchEvent(event);
    });
    await page.waitForFunction(() => window.__wsAudioProbe.suspendCalls > 0);
    assert.equal((await state(page)).unlocked, true);
    await page.evaluate(() => {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', {value: true});
      window.dispatchEvent(event);
    });
    await page.waitForFunction(() => window.__wsAudioProbe.liveTimers.size === 1);

    // Route changes stop background music and hide the controls.
    await page.evaluate(() => navigate('home'));
    assert.equal((await state(page)).scene, null);
    assert.equal((await state(page)).timerCount, 0);
    assert.equal(await page.locator('#wsAudioPanel').count(), 0);

    await page.setViewportSize({width: 360, height: 800});
    await page.evaluate(() => navigate('solo-car'));
    await page.locator('#wsAudioPanel').waitFor({state: 'visible'});
    const rect = await page.locator('#wsAudioPanel').evaluate(el => {
      const r = el.getBoundingClientRect();
      return {left: r.left, right: r.right, width: r.width};
    });
    assert.ok(rect.left >= -1 && rect.right <= 361 && rect.width > 0,
      name + ': mobile audio controls overflow 360px viewport');
    pass(name + ': Arena music, effects, volume, navigation, bfcache and mobile controls');

    // Learn shares browser-local preferences, but never persists audio to SRS/DB.
    await page.goto(BASE + '/learn.html', {waitUntil: 'domcontentloaded'});
    await page.locator('#gameTab').click();
    await page.locator('#wsAudioPanel').waitFor({state: 'visible'});
    current = await state(page);
    assert.equal(current.volume, 60);
    assert.equal(current.music, true);
    assert.equal(current.effects, true);
    assert.equal(current.unlocked, false);

    await page.locator('#gameMode').selectOption('typing');
    await page.locator('#wordLimit').fill('3');
    await page.locator('#playerName').fill('AudioQA');
    await page.locator('#startGame').click();

    await page.waitForFunction(() => window.WordSkyAudio?.getState().scene === 'FALLING');
    current = await state(page);
    assert.equal(current.unlocked, true);
    assert.equal(current.timerCount, 1);

    await page.locator('#pauseGame').click();
    assert.equal((await state(page)).scene, null);
    assert.equal((await state(page)).timerCount, 0);
    await page.locator('#startGame').click();
    assert.equal((await state(page)).scene, 'FALLING');
    await page.locator('#flashTab').click();
    assert.equal((await state(page)).scene, null);
    assert.equal(await page.locator('#wsAudioPanel').count(), 0);
    pass(name + ': Falling Words start/pause/resume/navigation and preference persistence');
    await context.close();
  }
  console.log('\nWORDSKY UX26 BROWSER AUDIO QA: PASS (2 browsers, 2 surfaces)');
} catch (error) {
  console.error('\nWORDSKY UX26 BROWSER AUDIO QA: FAIL\n' + (error.stack || error.message));
  process.exitCode = 1;
} finally {
  await Promise.allSettled([chrome?.close(), fox?.close()]);
}
