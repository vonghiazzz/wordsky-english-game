import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('public/index.html');
const css=read('public/ux03-game-library.css');
const js=read('public/ux03-game-library.js');
const app=read('public/app.js');
const nav=read('public/shared-nav.js');
const game=read('lib/game.js');

test('UX-03 loads after UX-02 and app.js without duplicating links',()=>{
 assert.equal(html.split('href="/ux03-game-library.css"').length-1,1);
 assert.equal(html.split('src="/ux03-game-library.js"').length-1,1);
 assert.ok(html.indexOf('href="/ux03-game-library.css"')>html.indexOf('href="/ux02-home-nav.css"'));
 assert.ok(html.indexOf('src="/ux03-game-library.js"')>html.indexOf('src="/app.js"'));
});

test('Game Library includes all four real destinations and no fake scores',()=>{
 assert.match(html,/id="ws03GameLibrary"/);
 assert.match(html,/aria-labelledby="ws03LibraryTitle"/);
 for(const target of ['solo','solo-bomb','solo-car'])
  assert.match(html,new RegExp('class="ws03-game [^"\\n]+" data-screen="'+target+'"'));
 assert.match(html,/href="\/learn\.html#game" aria-label="Mở game Chữ rơi/);
 assert.doesNotMatch(html,/ws03FakeScore|ws03FakeLevel|ws03FakeStreak/);
});

test('Game cards have existing accessible route handling',()=>{
 assert.match(app,/event\.target\.closest\('button,\[data-screen\],\[data-close\]'\)/);
 assert.match(app,/if\(button\.dataset\.screen\)/);
 assert.match(app,/\[data-screen\]\[tabindex\]/);
 assert.match(html,/data-screen="rooms">Vào phòng thi/);
});

test('Existing three Solo setup panes stay intact with separate help sections',()=>{
 for(const pane of ['soloSetupPane','soloBombSetupPane','soloCarSetupPane']){
  assert.equal(html.split('id="'+pane+'"').length-1,1);
  const idx=html.indexOf('id="'+pane+'"');
  assert.ok(html.lastIndexOf('class="ws03-intro"',idx)>html.lastIndexOf('<section id="screen-',idx));
 }
 for(const form of ['soloSetupForm','soloBombSetupForm','soloCarSetupForm'])assert.ok(app.includes(form));
});

test('Read-only configuration preview reflects actual form controls',()=>{
 for(const field of ['topic_id','difficulty','question_count','duration_seconds'])
  assert.ok(js.includes("namedItem('"+field+"')"),field);
 assert.match(js,/MutationObserver/);
 assert.match(js,/form\.insertAdjacentElement\('afterend',preview\)/);
 assert.match(js,/output\.textContent=value/);
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|FormData\s*\(|\.submit\s*\(|dispatchEvent\s*\(/);
});

test('Presentation layer does not target dynamic BOMB, CAR or falling-word DOM',()=>{
 assert.doesNotMatch(css,/\.bomb-falling\s*\{|\.bomb-arena\s*\{|\.car-stage\s*\{|\.car-lanes\s*\{|\.falling-word\s*\{|\.typing-dock\s*\{/);
 assert.match(css,/#screen-home \.ws03-game-grid/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
});

test('Server scoring, keyboard input and prior navigation remain separate',()=>{
 assert.match(game,/function normalizeRound\(/);
 assert.match(app,/function reconcileBombCards\(/);
 assert.match(app,/function animateBombs\(/);
 assert.match(app,/input\.readOnly=false/);
 assert.match(nav,/data-ws-progress-toggle/);
 assert.match(nav,/ws-mobile-dock/);
 for(const key of ['screen-home','screen-solo','screen-solo-bomb','screen-solo-car','screen-rooms','screen-admin'])
  assert.ok(html.includes('id="'+key+'"'),key);
});
