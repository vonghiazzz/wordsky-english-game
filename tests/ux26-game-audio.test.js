import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const engine = readFileSync(new URL('../public/game-audio.js', import.meta.url), 'utf8');
const arena = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const arenaHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const learn = readFileSync(new URL('../public/learn.html', import.meta.url), 'utf8');

function createAudioHarness(supported = true) {
  const saves = new Map();
  const calls = [];
  const contextEvents = [];
  let nextInterval = 0;
  let currentTime = 1;
  class Context {
    state = 'running';
    get currentTime() { return currentTime; }
    destination = {};
    createGain() {
      return {gain: {value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}}, connect() {}};
    }
    createOscillator() {
      calls.push('oscillator');
      return {frequency: {setValueAtTime() {}}, connect() {}, start() {}, stop() {}, set type(v) {}};
    }
    resume() { this.state = 'running'; contextEvents.push('resume'); return Promise.resolve(); }
    suspend() { this.state = 'suspended'; contextEvents.push('suspend'); return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const handlers = {};
  const doc = {
    hidden: false,
    readyState: 'loading',
    addEventListener(key, fn) { handlers[key] = fn; },
    querySelector() { return null; },
    getElementById() { return null; }
  };
  const window = {
    AudioContext: supported ? Context : undefined,
    localStorage: {getItem(key) {return saves.get(key) ?? null;}, setItem(key, v) {saves.set(key, v);}},
    addEventListener(key, fn) {handlers[key] = fn;}
  };
  const sandbox = {window, document: doc, setInterval(fn) {calls.push('interval'); return ++nextInterval;}, clearInterval() {calls.push('clear');}};
  vm.runInNewContext(engine, sandbox);
  return {audio: window.WordSkyAudio, saves, calls, doc, handlers, contextEvents};
}

test('UX26: engine registers original procedural tracks without audio files', () => {
  assert.match(engine, /MATCH: \{ms:/);
  assert.match(engine, /BOMB: \{ms:/);
  assert.match(engine, /CAR: \{ms:/);
  assert.match(engine, /FALLING: \{ms:/);
  assert.doesNotMatch(engine, /new Audio\(|\.mp3|\.ogg|externalAudio/);
  assert.match(arenaHtml, /<script src="\/game-audio\.js" defer>/);
  assert.match(learn, /<script src="\/game-audio\.js" defer>/);
});

test('UX26: audio stays silent before a user unlocks it', () => {
  const h = createAudioHarness();
  h.audio.setScene('BOMB', true);
  h.audio.cue('win');
  assert.equal(h.audio.getState().unlocked, false);
  assert.equal(h.calls.includes('oscillator'), false);
  h.audio.unlock();
  assert.equal(h.audio.getState().unlocked, true);
  assert.equal(h.calls.includes('oscillator'), true);
});

test('UX26: optional Web Audio is safe when unsupported', () => {
  const h = createAudioHarness(false);
  assert.equal(h.audio.getState().supported, false);
  assert.equal(h.audio.unlock(), false);
  h.audio.setScene('CAR', true);
  h.audio.cue('wrong');
});

test('UX26: navigation, games and feedback hook to audio state changes', () => {
  assert.match(arena, /function syncWordSkyArenaAudio\(\)/);
  assert.match(arena, /function wsAudioStateCue\(before,after\)/);
  assert.match(arena, /window\.WordSkyAudio\?\.setScene\(null,false\)/);
  assert.match(arena, /window\.WordSkyAudio\?\.unlock\(\)/);
  assert.match(arena, /wsAudioStateCue\(before,answer\.game\)/);
  assert.match(learn, /window\.WordSkyAudio\?\.cue\(won\?'win':'lose'\)/);
  assert.match(learn, /window\.WordSkyAudio\?\.cue\('damage'\)/);
  assert.match(learn, /window\.WordSkyAudio\?\.cue\('correct'\)/);
});


test('UX26: restores context from back-forward cache without losing preferences', async () => {
  const h = createAudioHarness();
  h.audio.setScene('CAR', true);
  h.audio.unlock();
  assert.equal(h.audio.getState().unlocked, true);
  h.handlers.pagehide({persisted: true});
  assert.equal(h.audio.getState().unlocked, true);
  assert.ok(h.contextEvents.includes('suspend'));
  h.handlers.pageshow({persisted: true});
  await Promise.resolve();
  assert.ok(h.contextEvents.includes('resume'));
  assert.equal(h.audio.getState().scene, 'CAR');
});

test('UX26: browser tabs share audio preferences but never force autoplay', () => {
  const h = createAudioHarness();
  const key = 'wordsky_audio_v1_';
  h.saves.set(key + 'music', 'false');
  h.handlers.storage({key: key + 'music'});
  assert.equal(h.audio.getState().music, false);
  h.saves.set(key + 'effects', 'false');
  h.handlers.storage({key: key + 'effects'});
  assert.equal(h.audio.getState().effects, false);
  h.saves.set(key + 'volume', '0');
  h.handlers.storage({key: key + 'volume'});
  assert.equal(h.audio.getState().volume, 0);
  h.audio.setScene('BOMB', true);
  assert.equal(h.audio.getState().unlocked, false);
  assert.equal(h.calls.includes('oscillator'), false);
});

test('UX26: hide tab suspends music and returns to visible state safely', async () => {
  const h = createAudioHarness();
  h.audio.setScene('MATCH', true);
  h.audio.unlock();
  h.doc.hidden = true;
  h.handlers.visibilitychange();
  assert.ok(h.contextEvents.includes('suspend'));
  h.doc.hidden = false;
  h.handlers.visibilitychange();
  await Promise.resolve();
  assert.ok(h.contextEvents.includes('resume'));
});

test('UX26: Falling Words wrong answer has SFX; last-heart loss does not double-play damage', () => {
  assert.match(learn, /WordSkyAudio\?\.cue\('wrong'\)/);
  const lastHeart = learn.match(/function hit\(\)\{[^\n]+\}/)?.[0] || '';
  assert.ok(lastHeart.indexOf('endGame(false)') < lastHeart.indexOf("cue('damage')"),
    'Last heart should trigger lose cue instead of both lose and damage');
});
