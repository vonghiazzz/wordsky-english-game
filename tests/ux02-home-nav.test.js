import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=read('public/index.html');
const learn=read('public/learn.html');
const nav=read('public/shared-nav.js');
const css=read('public/ux02-home-nav.css');
const app=read('public/app.js');
const base=read('public/style.css');

const routes=['/#home','/learn.html#flash','/learn.html#game','/#solo','/#solo-bomb','/#solo-car','/#rooms','/#attendance','/#rank','/#admin'];

test('UX-02 loads after UX-01 on Arena and Learn without duplicating CSS',()=>{
 for(const page of [home,learn]){
  assert.equal(page.split('href="/ux02-home-nav.css"').length-1,1);
  assert.ok(page.indexOf('href="/ux02-home-nav.css"')>page.indexOf('href="/ux-design-system.css"'));
 }
});

test('Home introduces three actual journeys, no fabricated learner data',()=>{
 assert.equal(home.split('id="ws02HeroTitle"').length-1,1);
 assert.match(home,/class="ws02-journey-grid"/);
 for(const destination of ['href="/learn.html#flash"','data-screen="solo-bomb"','data-screen="rooms"'])assert.ok(home.includes(destination),destination);
 assert.doesNotMatch(home,/data-ws-fake-progress|id="ws02ProgressPercent"/);
 assert.ok(home.includes('<div class="stats">'),'legacy stats preserved');
 for(const id of ['screen-home','screen-solo','screen-solo-bomb','screen-solo-car','screen-rooms','screen-attendance','screen-rank','screen-admin'])assert.ok(home.includes('id="'+id+'"'),id);
});

test('Navigation preserves ALL 10 routes and permission-gated Admin',()=>{
 for(const url of routes)assert.ok(nav.includes("url:'"+url+"'"),url);
 assert.match(nav,/adminOnly:true/);
 assert.match(nav,/setAdmin\(value\)/);
 assert.match(nav,/const navMarkup=\[/);
 assert.match(nav,/aria-label="Điều hướng nhanh"/);
 for(const key of ['home','flash','solo','rooms','attendance'])assert.ok(nav.includes('data-ws-dock="'+key+'"'));
 assert.match(nav,/navLink\(menuItems\.find\(item=>item\.key==='rooms'\)\)/);
 assert.match(nav,/data-ws-progress-toggle aria-expanded="false" aria-controls="wsNavProgressList"/);
 assert.match(nav,/gamesList\.querySelectorAll\('a'\)/);
});

test('Two disclosures handle keyboard, focus, active state and Escape',()=>{
 for(const selector of ['data-ws-games-toggle','data-ws-progress-toggle'])assert.ok(nav.includes(selector));
 assert.match(nav,/progressList\.addEventListener\('keydown'/);
 assert.match(nav,/progressToggle\.addEventListener\('keydown'/);
 assert.match(nav,/const wasInProgress=/);
 assert.match(nav,/else if\(wasInProgress\)progressToggle\.focus\(\)/);
 assert.match(nav,/setProgressOpen\(false\)/);
 assert.match(nav,/progressToggle\.classList\.toggle\('is-active',active==='attendance'\|\|active==='rank'\|\|active==='learning-progress'\)/);
 assert.doesNotMatch(nav,/label:'Sổ từ cần ôn'|label:'Luyện từ sai'/);
 assert.match(nav,/ws-dock-hidden/);
 assert.match(nav,/ws-mobile-dock-visible/);
 assert.match(nav,/window\.addEventListener\('popstate'/);
 assert.match(nav,/window\.addEventListener\('hashchange'/);
});

test('New styles are scoped to Home and shared nav, including small screens',()=>{
 assert.match(css,/#screen-home \.ws02-hero/);
 assert.match(css,/#screen-home \.ws02-journey/);
 assert.match(css,/#wsSharedNav \.ws-nav-progress/);
 assert.match(css,/#wsSharedNav:not\(\.ws-dock-hidden\) \.ws-mobile-dock/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/\.bomb-falling\s*\{|\.car-vehicle\s*\{|\.falling-word\s*\{|\.typing-dock\s*\{/);
});

test('Old game logic, auto-typing, BOMB fixed columns and routing remain intact',()=>{
 assert.match(app,/function reconcileBombCards\(/);
 assert.match(app,/function animateBombs\(/);
 assert.match(app,/input\.readOnly=false/);
 assert.match(app,/function navigate\(name,\{fromHistory=false\}=\{\}\)/);
 assert.match(base,/\.bomb-fixed-columns/);
 assert.match(home,/id="joinForm"/);
});
