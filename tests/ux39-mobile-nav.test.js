import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const nav=read('public/shared-nav.js');
const css=read('public/shared-nav.css');
const homeCss=read('public/ux02-home-nav.css');

test('UX39 mobile dock is shared by all game, learning, practice, and account pages',()=>{
 const pages=[
  'public/index.html','public/learn.html','public/matrix.html',
  'public/memory.html','public/progress.html','public/practice.html',
  'public/mistakes.html','public/personal.html'
 ];
 for(const path of pages){
  const page=read(path);
  assert.match(page,/id="wsSharedNav"/,path+' must mount shared nav');
  assert.match(page,/href="\/shared-nav\.css"/,path+' must load common dock CSS');
  assert.match(page,/src="\/shared-nav\.js"/,path+' must load common navigation');
 }
 assert.equal((css.match(/\.ws-mobile-dock\{position:fixed/g)||[]).length,1);
 assert.match(css,/#wsSharedNav \.ws-mobile-dock\{position:fixed/);
 assert.match(css,/body\.ws-mobile-dock-visible\{padding-bottom/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/html\{scroll-padding-bottom/);
 assert.match(css,/scroll-margin-bottom/);
 assert.doesNotMatch(homeCss,/\.ws-mobile-dock|ws-dock-hidden/);
});

test('UX39 shows the same dock in Solo, competition, MATRIX, MEMORY and falling letters',()=>{
 for(const key of ['home','flash','solo','rooms','attendance']){
  assert.ok(nav.includes('data-ws-dock="'+key+'"'),key+' dock entry');
 }
 assert.match(nav,/document\.body\.classList\.add\('ws-mobile-dock-visible'\)/);
 assert.doesNotMatch(nav,/ws-dock-hidden|dockHidden=|isMatrix\|\|\(isLearn/);
 assert.match(nav,/key==='solo'\?gameKeys\.has\(active\)&&active!=='rooms'/);
 assert.match(nav,/key===active/);
});

test('UX39 new game result screens have replay only, not duplicate anchor navigation',()=>{
 for(const path of ['public/matrix.html','public/memory.html']){
  const page=read(path);
  const result=page.slice(page.indexOf('<section id="matrixResult"'));
  assert.match(result,/id="matrixAgain"/,path+' must preserve replay');
  assert.doesNotMatch(result,/<a\b/i,path+' must not duplicate global nav');
  assert.match(page,/data-ws-page="(?:matrix|memory)"/);
 }
 const app=read('public/app.js');
 const soloResult=app.slice(app.indexOf('function soloResultMarkup('),
  app.indexOf('function renderSoloCarGame(){'));
 assert.ok(soloResult.length>500);
 assert.doesNotMatch(soloResult,/<a\b/i);
 assert.match(soloResult,/Tiến độ trong thanh điều hướng/);
 // Keep actual game-entry hyperlinks; removing them breaks opening the new pages.
 const games=read('public/index.html');
 assert.match(games,/href="\/matrix\.html"/);
 assert.match(games,/href="\/memory\.html"/);
});

test('UX39 navigation is presentation-only and does not modify server learning rules',()=>{
 assert.doesNotMatch(nav,/fetch\(|DATABASE_URL|localStorage|sessionStorage/);
 assert.doesNotMatch(css,/\.bomb-falling\{|\.car-lanes\{|\.pair-grid\{/);
 assert.match(read('public/matrix.js'),/id="matrixAgain"|matrixAgain/);
});
