/**
 * UX26 read-only, unauthenticated Production smoke.
 *
 * This test never starts a game, logs in, writes reviews, or changes Production.
 * It uses native Chromium/Firefox AudioContext implementations, with a counter
 * around oscillator.start(). Firefox headless may have AudioContext suspended
 * because GitHub runners have no usable audio output; report this separately.
 * A positive test is NOT a substitute for listening on a real device.
 */
import assert from 'node:assert/strict';
import {chromium, firefox, request} from 'playwright';

const ORIGIN = 'https://wordsky-english-game.vercel.app';
const READ_ONLY = ['GET', 'HEAD', 'OPTIONS'];
const paths = [
  ['/', 'text/html', '<script src="/game-audio.js" defer>'],
  ['/learn.html', 'text/html', '<script src="/game-audio.js" defer>'],
  ['/game-audio.js', 'javascript', 'window.WordSkyAudio = Object.freeze'],
  ['/game-audio.css', 'text/css', '.ws-audio-panel'],
  ['/api/topics', 'application/json', null]
];

function log(label) { console.log('PASS: ' + label); }
function tapCounter() {
  const Base = window.AudioContext || window.webkitAudioContext;
  window.__ux26Smoke = {starts: 0, supported: !!Base, contexts: []};
  if (!Base) return;
  class MeasuredContext extends Base {
    constructor(...args) {
      super(...args);
      window.__ux26Smoke.contexts.push(this);
    }
    createOscillator() {
      const oscillator = super.createOscillator();
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (...args) => {
        window.__ux26Smoke.starts++;
        return start(...args);
      };
      return oscillator;
    }
  }
  window.AudioContext = MeasuredContext;
  window.webkitAudioContext = MeasuredContext;
}

const inconclusiveAudio = [];
async function expectSynth(page, name, game) {
  try {
    await page.waitForFunction(() => window.__ux26Smoke?.starts > 0, null, {
      timeout: name === 'Firefox' ? 2500 : 10000
    });
    log(name + ': native WebAudio scheduled ' + game + ' music');
    return;
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      audio: window.WordSkyAudio?.getState(),
      contexts: window.__ux26Smoke?.contexts.map(c => ({state: c.state, time: c.currentTime})),
      starts: window.__ux26Smoke?.starts
    }));
    if (name === 'Firefox' && diagnostics.starts === 0 &&
        diagnostics.audio?.unlocked && diagnostics.audio?.scene &&
        diagnostics.contexts?.length &&
        diagnostics.contexts.every(c => c.state === 'suspended')) {
      const reason = name + ' headless ' + game +
        ': native AudioContext stayed suspended (requires real-device verification)';
      inconclusiveAudio.push(reason);
      console.warn('INCONCLUSIVE: ' + reason);
      return;
    }
    throw new Error(name + ': ' + game + ' audio check failed: ' +
      JSON.stringify(diagnostics), {cause: error});
  }
}

const api = await request.newContext({
  baseURL: ORIGIN,
  timeout: 20000,
  extraHTTPHeaders: { 'x-wordsky-smoke-test': 'ux26-readonly' }
});
let chrome, fox;
try {
  for (const [path, mime, marker] of paths) {
    const response = await api.get(path, {maxRedirects: 0});
    assert.equal(response.status(), 200, path + ': HTTP status');
    assert.equal(new URL(response.url()).origin, ORIGIN, path + ': changed origin');
    const type = response.headers()['content-type'] || '';
    assert.ok(type.includes(mime), path + ': wrong content type: ' + type);
    const body = await response.text();
    if (marker) assert.ok(body.includes(marker), path + ': missing audio marker');
    if (path === '/api/topics') {
      assert.doesNotThrow(() => JSON.parse(body), 'Public topics returned non-JSON');
    }
    log('Production GET ' + path + ' → 200, ' + type.split(';')[0]);
  }

  chrome = await chromium.launch({headless: true});
  // CI headless runners have no audio output device; grant Firefox WebAudio permission
  // explicitly so this tests native oscillator scheduling, not OS autoplay policy.
  fox = await firefox.launch({headless: true, firefoxUserPrefs: {'media.autoplay.default': 0, 'media.cubeb.backend': 'null'}});
  for (const [name, browser] of [['Chromium', chrome], ['Firefox', fox]]) {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    const mutations = [];
    // Guard against accidental write requests from the test or application.
    await ctx.route('**/*', route => {
      const method = route.request().method().toUpperCase();
      if (!READ_ONLY.includes(method)) {
        mutations.push(method + ' ' + route.request().url());
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await ctx.addInitScript(tapCounter);
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto(ORIGIN + '/#solo', {waitUntil: 'domcontentloaded', timeout: 25000});
    await page.locator('#wsAudioPanel').waitFor({state: 'visible', timeout: 25000});
    let s = await page.evaluate(() => window.WordSkyAudio?.getState());
    assert.equal(s?.supported, true, name + ': real AudioContext missing');
    assert.equal(s?.unlocked, false, name + ': music autoplayed without a gesture');

    // User interaction is required to unlock real WebAudio on mobile browsers.
    await page.locator('[data-ws-audio-music]').click();
    await page.locator('[data-ws-audio-music]').click();
    await page.waitForFunction(() => window.WordSkyAudio?.getState().unlocked, null, {timeout: 10000});
    await page.evaluate(() => window.WordSkyAudio.setScene('MATCH', true));
    await expectSynth(page, name, 'MATCH');
    s = await page.evaluate(() => window.WordSkyAudio.getState());
    assert.equal(s.scene, 'MATCH', name + ': track not activated');
    log(name + ': Arena WebAudio controls and scene state');

    await page.evaluate(() => navigate('home'));
    await page.waitForFunction(() => window.WordSkyAudio?.getState().scene === null, null, {timeout: 5000});
    assert.equal(await page.locator('#wsAudioPanel').count(), 0, name + ': control visible on home');
    log(name + ': changing Arena screen stops music');

    await page.goto(ORIGIN + '/learn.html', {waitUntil: 'domcontentloaded', timeout: 25000});
    await page.locator('#gameTab').click();
    await page.locator('#wsAudioPanel').waitFor({state: 'visible', timeout: 10000});
    s = await page.evaluate(() => window.WordSkyAudio?.getState());
    assert.ok(s?.supported, name + ': Learn lost WebAudio engine');
    assert.equal(s?.unlocked, false, name + ': Learn autoplayed');
    await page.locator('[data-ws-audio-music]').click();
    await page.locator('[data-ws-audio-music]').click();
    await page.evaluate(() => window.WordSkyAudio.setScene('FALLING', true));
    await expectSynth(page, name, 'FALLING');

    await page.locator('#flashTab').click();
    assert.equal((await page.evaluate(() => window.WordSkyAudio.getState())).scene, null);
    assert.equal(await page.locator('#wsAudioPanel').count(), 0, name + ': controls did not leave game');
    assert.deepEqual(mutations, [], name + ': unexpected network mutation');
    assert.deepEqual(pageErrors, [], name + ': browser script exception');
    log(name + ': navigation and zero Production mutations');
    await ctx.close();
  }
  console.log('\nUX26 LIVE PRODUCTION READ-ONLY SMOKE: PASS (HTTP, Chromium native audio, both browsers UI)');
  if (inconclusiveAudio.length) console.warn('FIREFOX AUDIO STILL UNVERIFIED: ' + inconclusiveAudio.length + ' headless checks; verify on physical devices.');
} catch (error) {
  console.error('\nUX26 LIVE PRODUCTION READ-ONLY SMOKE: FAIL\n' + (error.stack || error));
  process.exitCode = 1;
} finally {
  await Promise.allSettled([chrome?.close(), fox?.close(), api.dispose()]);
}
