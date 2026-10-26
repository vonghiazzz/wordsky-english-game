import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=load('public/learn.html');
const css=load('public/ux05-learn.css');
const js=load('public/ux05-learn.js');

test('UX-05 loads scoped CSS after UX-02 and one defer helper after original inline engine',()=>{
 assert.equal(html.split('href="/ux05-learn.css"').length-1,1);
 assert.ok(html.indexOf('href="/ux05-learn.css"')>html.indexOf('href="/ux02-home-nav.css"'));
 assert.equal(html.split('src="/ux05-learn.js"').length-1,1);
 assert.match(html,/<\/script><script src="\/ux05-learn.js" defer><\/script><script type="module" src="\/ux10-learn-sync.js"><\/script><script type="module" src="\/ux13-vocab-sync.js"><\/script><script type="module" src="\/ux18-flash-sync.js"><\/script><\/body><\/html>/);
 assert.match(html,/<body class="ws05-learn">/);
});

test('Learn hero and choice cards offer only real Flashcard and Chữ rơi destinations',()=>{
 assert.match(html,/id="ws05HeroTitle"/);
 assert.match(html,/id="ws05PathsTitle"/);
 assert.match(html,/data-ws05-tab="flash"/);
 assert.match(html,/data-ws05-tab="game"/);
 assert.match(js,/tab\.click\(\)/);
 assert.match(js,/flashTab/);
 assert.match(js,/gameTab/);
 assert.doesNotMatch(html,/data-ws05-fake-progress|data-ws05-pretend-score/);
});

test('Original Flashcard identities, flip, progress and browser storage are preserved',()=>{
 for(const id of ['flashCard','flashCount','flashProgress','remembered','know','prev','next','topic','shuffle','resetProgress','cambridgeTerm'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/function renderCard\(\)/);
 assert.match(html,/function advance\(n\)/);
 assert.match(html,/\$\('flashCard'\)\.addEventListener\('keydown'/);
 assert.match(html,/function showTab\(which/);
});

test('Flashcard helper only reads source state and uses existing navigation controls',()=>{
 assert.match(js,/new MutationObserver\(syncFlash\)/);
 assert.match(js,/observe\(flashCount/);
 assert.match(js,/observe\(remembered/);
 assert.match(js,/event\.key==='ArrowLeft'/);
 assert.match(js,/event\.key==='ArrowRight'/);
 assert.match(js,/button\.click\(\)/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|fetch\(|XMLHttpRequest|\.innerHTML/);
});

test('Game config preview reads real topic, mode, difficulty and word limit',()=>{
 for(const id of ['ws05GameConfig','gameTopic','gameMode','difficulty','wordLimit','gameRules','playerName'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const snippet of ["letters:'Bắt chữ cái'","typing:'Gõ cả từ'","easy:'Dễ'","normal:'Vừa'","hard:'Khó'","selectedOptions","Number(value)<=50"])assert.ok(js.includes(snippet),snippet);
 assert.match(js,/addEventListener\('change',id==='topic'\?syncFlash:syncGame\)/);
});

test('Falling letters and whole-word native gameplay stay mounted and unchanged',()=>{
 for(const id of ['gameArea','typingDock','typingAnswer','gameOverlay','startGame','pauseGame','restartGame','fullscreenGame','typingForm'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const signature of ['function tick(t)','function focusTypingInput()','function setTypingEnabled(enabled)','function spawnFallingWord()'])assert.ok(html.includes(signature),signature);
 assert.match(html,/document\.addEventListener\('keydown'/);
 assert.doesNotMatch(js,/typingAnswer|gameArea|gameOverlay|game\.status|game\.score/);
});

test('All UX-05 new CSS remains scoped and never targets falling motion or native keyboard internals',()=>{
 assert.match(css,/body\.ws05-learn/);
 assert.match(css,/\.ws05-path-grid/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/(^|\n)\s*\.falling-word\s*\{|(^|\n)\s*\.letter\s*\{|(^|\n)\s*\.typing-dock\s*\{|(^|\n)\s*\.typing-board\s*\{/);
});

test('Legacy Learn routes, manager editor, privacy and scoring flows are not replaced',()=>{
 for(const id of ['manageTab','managePanel','cardForm','importScores','exportScores','scoreboardList'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/wordsky-scores/);
 assert.match(html,/function renderManager\(\)/);
 assert.match(html,/window\.dispatchEvent\(new Event\('wordsky:route'\)\)/);
 assert.doesNotMatch(js,/new WebSocket|api\/|POST|PATCH|\.submit\(/);
});
