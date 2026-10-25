import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=load('public/app.js');
const html=load('public/index.html');
const css=load('public/ux04-results.css');
const base=load('public/style.css');
const nav=load('public/shared-nav.js');
const helperStart=app.indexOf('function soloResultMarkup(');
const helperEnd=app.indexOf('function renderSoloCarGame(){',helperStart);
function makeResult(game,round,mode){
 const snippet=app.slice(helperStart,helperEnd);
 return vm.runInNewContext(snippet+'\nsoloResultMarkup(game,round,mode)',{game,round,mode,fmt:n=>String(n)});
}

test('UX-04 stylesheet loads once after UX-03 and original styles',()=>{
 assert.equal(html.split('href="/ux04-results.css"').length-1,1);
 assert.ok(html.indexOf('href="/ux04-results.css"')>html.indexOf('href="/ux03-game-library.css"'));
 assert.match(html,/href="\/style\.css"/);
});

test('all three Solo result renderers invoke the same server-derived UI only when ended',()=>{
 assert.match(app,/function soloResultMarkup\(g,rd,mode\)/);
 const car=app.slice(app.indexOf('function renderSoloCarGame(){'),app.indexOf('function updateSoloCarTimers(){'));
 const normal=app.slice(app.indexOf('function renderSoloGame(){'),app.indexOf('function renderSolo(){'));
 assert.ok(car.includes("${ended?soloResultMarkup(g,rd,'CAR'):''}"));
 assert.ok(normal.includes("${ended?soloResultMarkup(g,rd,mode):''}"));
 assert.equal(app.split('soloResultMarkup(g,rd,').length-1,3);
});

test('summary contains exact server values for completed MATCH and accessible progress',()=>{
 const result=makeResult({score:500,correct:5,mistakes:1,status:'COMPLETED'}, {question_count:6},'MATCH');
 assert.match(result,/Hoàn thành/);
 assert.match(result,/500/);
 assert.match(result,/5<small> \/ 6 cặp<\/small>/);
 assert.match(result,/Lần ghép sai/);
 assert.match(result,/aria-valuenow="5"/);
 assert.match(result,/83%/);
 assert.match(result,/Ôn Flashcard/);
});

test('BOMB and CAR have accurate mode-specific labels and status',()=>{
 const bomb=makeResult({score:200,correct:2,mistakes:3,status:'FAILED'}, {question_count:8},'BOMB');
 assert.match(bomb,/Hết tim/);
 assert.match(bomb,/Bom quá hạn/);
 assert.match(bomb,/25%/);
 const car=makeResult({score:150,correct:1,mistakes:2,status:'TIMEOUT'}, {question_count:3},'CAR');
 assert.match(car,/Hết giờ/);
 assert.match(car,/Lượt bị phạt/);
 assert.match(car,/33%/);
});

test('bad or incomplete score values never create NaN, Infinity or impossible progress',()=>{
 const out=makeResult({score:NaN,correct:999,mistakes:-5,status:'UNKNOWN'}, {question_count:0},'MATCH');
 assert.doesNotMatch(out,/NaN|Infinity|undefined|null/);
 assert.match(out,/100%/);
 assert.match(out,/Đã kết thúc/);
 assert.match(out,/aria-valuemax="1"/);
});

test('result does not fake wrong-word history or XP and preserves original controls',()=>{
 assert.match(app,/id="\$\{bomb\?'soloBombReplay':'soloReplay'\}"/);
 assert.match(app,/id="\$\{bomb\?'soloBombNewConfig':'soloNewConfig'\}"/);
 assert.match(app,/id="soloCarReplay"/);
 assert.match(app,/id="soloCarNewConfig"/);
 const result=makeResult({score:0,correct:0,mistakes:0,status:'FAILED'}, {question_count:3},'CAR');
 assert.match(result,/Danh sách từ trả lời sai trong lượt chưa được hệ thống cung cấp/);
 assert.doesNotMatch(result,/\bXP\b|Đáp án sai:/);
 assert.doesNotMatch(app.slice(helperStart,helperEnd),/\bapi\(|localStorage|fetch\(/);
});

test('CSS stays scoped to Solo result and keeps native gameplay input/motion intact',()=>{
 assert.match(css,/\.solo-game-shell \.ws04-result/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 for(const selector of ['.bomb-falling{','.bomb-fixed-lane{','.car-vehicle{','.car-stage{','.game-area{','.typing-dock{'])assert.ok(!css.includes(selector),selector);
 assert.match(base,/\.bomb-fixed-columns/);
 assert.match(app,/function reconcileBombCards\(/);
 assert.match(app,/function renderGame\(/);
});

test('navigation, server submit and legacy results continue without additional routing',()=>{
 assert.match(nav,/adminOnly:true/);
 assert.match(app,/function renderRoom\(/);
 assert.match(app,/async function beginSolo\(mode,config\)/);
 assert.match(app,/async function submitSoloAnswer\(payload\)/);
 assert.match(app,/id="soloCarResultTitle"/);
 assert.match(app,/soloBombResultTitle/);
 assert.match(html,/id="screen-solo-bomb"/);
 assert.match(html,/id="screen-solo-car"/);
});
