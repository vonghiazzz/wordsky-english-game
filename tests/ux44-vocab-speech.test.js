import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const source = read('public/vocab-speech.js');

function harness({supported = true, withFlash = false, voices = [{lang:'en-GB',name:'UK QA'}]} = {}) {
  const handlers = {};
  const spoken = [];
  const nodes = Object.create(null);
  const createElement = tag => {
    const attrs = new Map(), listeners = new Map(), classes = new Set();
    return {
      tag, attrs, listeners, classes, textContent: '', disabled: false, title: '',
      classList: {
        add: key => classes.add(key),
        remove: key => classes.delete(key),
        toggle: (key, enabled) => enabled ? classes.add(key) : classes.delete(key),
        contains: key => classes.has(key)
      },
      setAttribute: (key, value) => attrs.set(key, value),
      getAttribute: key => attrs.get(key),
      addEventListener: (key, fn) => listeners.set(key, fn),
      click: () => listeners.get('click')?.({stopPropagation(){}, preventDefault(){}}),
      append: () => {}
    };
  };
  if (withFlash) {
    nodes.flashSpeak = createElement('button');
    nodes.word = createElement('h3');
    nodes.word.textContent = 'hello';
  }
  const events = new Map();
  const synth = {
    speaking: false, pending: false, spoken, cancellations: 0,
    getVoices: () => voices,
    cancel() {this.cancellations++; this.speaking = false; this.pending = false;},
    speak(utterance) {spoken.push(utterance); this.speaking = true;}
  };
  class MockUtterance {constructor(text) {this.text = text;}}
  class MockMutationObserver {
    constructor(fn) {handlers.mutation = fn;}
    observe() {}
  }
  const window = {
    speechSynthesis: supported ? synth : undefined,
    SpeechSynthesisUtterance: supported ? MockUtterance : undefined,
    addEventListener(key,fn) {events.set(key,fn);}
  };
  const document = {
    readyState:'complete', hidden:false,
    getElementById:key => nodes[key] || null,
    createElement,
    body:{append(element) {nodes[element.id] = element;}},
    addEventListener(key,fn) {events.set(key,fn);}
  };
  runInNewContext(source,{window,document,MutationObserver:MockMutationObserver});
  return {api:window.WordSkySpeech,synth,spoken,nodes,events,handlers};
}

test('UX44 pronunciation is opt-in, UK-first and uses no remote TTS service or storage',()=>{
  const h=harness({voices:[{lang:'en-US',name:'US'},{lang:'en-GB',name:'UK'}]});
  assert.equal(h.api.supported,true);
  assert.equal(h.spoken.length,0,'no autoplay');
  const button=h.api.makeButton('take off');
  assert.equal(button.disabled,false);
  assert.equal(button.getAttribute('aria-label'),'Nghe phát âm tiếng Anh: take off');
  button.click();
  assert.equal(h.spoken.length,1);
  assert.equal(h.spoken[0].text,'take off');
  assert.equal(h.spoken[0].lang,'en-GB');
  assert.equal(h.spoken[0].rate,0.88);
  assert.equal(h.spoken[0].voice.name,'UK');
  assert.equal(button.getAttribute('aria-pressed'),'true');
  h.spoken[0].onend();
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|\.src\s*=|new Audio\(/u);
});

test('UX44 cancels the previous word, toggles same-word replay, and ignores stale end events',()=>{
  const h=harness(),first=h.api.makeButton('hello'),second=h.api.makeButton('good morning');
  first.click();
  const old=h.spoken[0];
  second.click();
  assert.equal(h.spoken.length,2);
  assert.equal(h.spoken[1].text,'good morning');
  assert.equal(first.getAttribute('aria-pressed'),'false');
  old.onend();
  assert.equal(second.getAttribute('aria-pressed'),'true');
  second.click(); // Tap again: stop instead of layering audio.
  assert.equal(second.getAttribute('aria-pressed'),'false');
  assert.equal(h.spoken.length,2);
  assert.ok(h.synth.cancellations>=2);
  assert.equal(h.api.speak('<script>alert(1)</script>'),false);
  assert.equal(h.api.speak('w'.repeat(161)),false);
  assert.equal(h.spoken.length,2);
  h.events.get('pagehide')();
  assert.equal(second.getAttribute('aria-pressed'),'false');
});

test('UX44 voice fallback and unsupported browsers fail without changing word data',()=>{
  const fallback=harness({voices:[{lang:'en-US',name:'US'}]});
  fallback.api.makeButton('water').click();
  assert.equal(fallback.spoken[0].lang,'en-US');
  const missing=harness({supported:false});
  const control=missing.api.makeButton('water');
  assert.equal(missing.api.supported,false);
  assert.equal(control.disabled,true);
  control.click(); // A disabled control must not speak.
  assert.equal(missing.spoken.length,0);
});

test('UX44 Flashcard button stays outside flip container and stops on card change',()=>{
  const h=harness({withFlash:true});
  assert.equal(h.nodes.flashSpeak.disabled,false);
  h.nodes.flashSpeak.click();
  assert.equal(h.spoken[0].text,'hello');
  h.nodes.word.textContent='goodbye';
  h.handlers.mutation();
  assert.ok(h.synth.cancellations>0);
  assert.equal(h.nodes.flashSpeak.getAttribute('aria-pressed'),'false');
  h.nodes.flashSpeak.click();
  assert.equal(h.spoken.at(-1).text,'goodbye');
  h.nodes.word.textContent='Chưa có thẻ';
  h.handlers.mutation();
  assert.equal(h.nodes.flashSpeak.disabled,true);
  const learn=read('public/learn.html');
  const start=learn.indexOf('id="flashCard"'),close=learn.indexOf('</div><div class="rowbtn">',start);
  const button=learn.indexOf('id="flashSpeak"');
  assert.ok(start>=0&&close>=0&&button>close,'pronounce button must not flip card');
});

test('UX44 only mounts on learner-facing pages, never while an answer is concealed',()=>{
  for(const path of ['learn','progress','personal','practice']){
    const html=read('public/'+path+'.html');
    assert.match(html,/href="\/vocab-speech\.css"/u);
    assert.match(html,/src="\/vocab-speech\.js" defer/u);
  }
  const progress=read('public/ux10-progress.js');
  const personal=read('public/ux18-personal.js');
  const practice=read('public/ux28-practice.js');
  const quizHTML=read('public/practice.html');
  assert.match(progress,/WordSkySpeech\?\.makeButton\(card\.english, true\)/u);
  assert.match(personal,/WordSkySpeech\?\.makeButton\(word\.english,true\)/u);
  assert.match(practice,/WordSkySpeech\?\.bindButton\(\$\('ws28HearAnswer'\),\(\)=>pendingAttempt\?\.word\?\.english\|\|''\)/u);
  assert.match(practice,/function showFeedback\(attempt\)[\s\S]*?answerPronunciation\?\.sync\(\)/u);
  assert.match(quizHTML,/id="ws28Feedback" hidden>[\s\S]*?id="ws28HearAnswer"/u);
  assert.doesNotMatch(read('public/index.html'),/vocab-speech\.js|ws28HearAnswer/u);
  assert.doesNotMatch(read('public/app.js'),/vocab-speech|WordSkySpeech/u);
});
