import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(name)=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const home=read('public/index.html');
const learn=read('public/learn.html');
const arena=read('public/app.js');
const nav=read('public/shared-nav.js');
const style=read('public/shared-nav.css');

test('both pages mount the exact same shared header and styles',()=>{
 for(const source of [home,learn]){
  assert.match(source,/id="wsSharedNav"/);
  assert.match(source,/href="\/shared-nav\.css"/);
  assert.match(source,/src="\/shared-nav\.js"/);
 }
 assert.match(home,/data-ws-page="arena"/);
 assert.match(learn,/data-ws-page="learn"/);
 assert.doesNotMatch(learn,/<header class="top"><div class="brand">/);
});

test('common logo and navigation destinations are real absolute routes',()=>{
 assert.match(nav,/href="\/" aria-label="WordSky - Về trang chủ"/);
 for(const path of ['/#home','/learn.html#flash','/learn.html#game','/#rooms','/#attendance','/#rank'])assert.ok(nav.includes(path),path);
 assert.match(nav,/aria-current/);
 assert.match(nav,/ws-nav-toggle/);
});

test('Arena account handling remains present and admin link is permission-gated',()=>{
 assert.match(nav,/id="accountButton"/);
 assert.match(nav,/adminOnly:true/);
 assert.match(nav,/setAdmin\(value\)/);
 assert.match(arena,/WordSkyNav\?\.setAdmin\(session\?\.role==='admin'\)/);
 assert.match(arena,/api\('auth\/me'\)/);
});

test('Arena hash navigation updates history and restores Back/Forward',()=>{
 assert.match(arena,/function navigate\(name,\{fromHistory=false\}=\{\}\)/);
 assert.match(arena,/history\.pushState/);
 assert.match(arena,/window\.addEventListener\('popstate'/);
 assert.match(arena,/window\.addEventListener\('hashchange'/);
 assert.match(arena,/wordsky:route/);
});

test('Learn direct links and local tabs use browser history',()=>{
 assert.match(learn,/function showTab\(which,\{fromRoute=false\}=\{\}\)/);
 assert.match(learn,/history\.pushState/);
 assert.match(nav,/applyLearnRoute\(\)/);
 assert.match(nav,/gameTab/);
 assert.match(nav,/flashTab/);
 assert.match(nav,/manageTab/);
});

test('Learning and competition remain independent in Phase 1.1',()=>{
 assert.match(learn,/localStorage\.getItem/);
 assert.match(learn,/localStorage\.setItem/);
 assert.doesNotMatch(nav,/fetch\(|localStorage|sessionStorage|DATABASE_URL|SECRET/);
 assert.match(arena,/startRoundButton/);
});

test('shared nav supports mobile and keyboard access',()=>{
 assert.match(style,/@media\(max-width:680px\)/);
 assert.match(style,/\.ws-site-links\.is-open/);
 assert.match(style,/focus-visible/);
 assert.match(nav,/aria-expanded/);
 assert.match(nav,/event\.key==='Escape'/);
});

test('game links are grouped under one disclosure without changing routes',()=>{
 for(const key of ["'game'","'solo'","'solo-bomb'","'solo-car'","'rooms'"])assert.ok(nav.includes('key:'+key),key);
 assert.match(nav,/gameKeys=new Set\(\['game','solo','solo-bomb','solo-car','rooms'\]\)/);
 assert.match(nav,/data-ws-games-group/);
 assert.match(nav,/data-ws-games-toggle aria-expanded="false" aria-controls="wsNavGamesList"/);
 assert.match(nav,/ws-nav-games-list" id="wsNavGamesList" hidden/);
 assert.match(nav,/const navMarkup=\[/);
 assert.match(nav,/navLink\(menuItems\.find\(item=>item\.key==='rooms'\)\)/);
 assert.match(nav,/data-ws-progress-toggle aria-expanded="false" aria-controls="wsNavProgressList"/);
 assert.match(nav,/gamesToggle\.classList\.toggle\('is-active',gameKeys\.has\(active\)&&active!=='rooms'\)/);
 assert.match(nav,/setGamesOpen\(false\)/);
 assert.match(nav,/gamesList\.querySelectorAll\('a'\)/);
 assert.match(style,/\.ws-nav-games-list\[hidden\]/);
 assert.match(style,/@media \(max-width:680px\)/);
});
