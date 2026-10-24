import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../public/shared-nav.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('BOMB Solo is reachable from its card, shared navigation and direct hash',()=>{
 assert.match(html,/data-screen="solo-bomb"/);assert.match(html,/id="screen-solo-bomb"/);
 assert.match(html,/id="soloBombSetupPane"/);assert.match(html,/id="soloBombGamePane"/);
 assert.match(nav,/key:'solo-bomb'.*url:'\/#solo-bomb'.*arena:'solo-bomb'/);
 assert.match(app,/\['home','solo','solo-bomb','solo-car','rooms','attendance','rank','admin'\]/);
 assert.match(html,/aria-label="Chơi thử Bomb Defuser Solo"/);
});

test('BOMB setup defaults to EASY, 8 bombs, 90 seconds and shares the Solo form',()=>{
 assert.match(app,/bomb\?'Số bom':'Số cặp'/);assert.match(app,/bomb\?8:6/);assert.match(app,/value="90"/);
 assert.match(app,/Easy · rơi 20s, 2 bom\/\u0111ợt/);assert.match(app,/Normal · rơi 16s, 2 bom\/\u0111ợt/);assert.match(app,/Hard · rơi 10s, 3 bom\/\u0111ợt/);
 assert.match(app,/api\(`solo\/\$\{mode\.toLowerCase\(\)\}\/start`/);
 assert.match(app,/beginSolo\(soloModeForScreen\(\)/);
});

test('falling BOMB play keeps its input mounted during polling and auto submits full words',()=>{
 assert.match(app,/id="soloBombArena"/);assert.match(app,/id="soloBombAnswer"/);
 assert.match(app,/syncSoloBombArena\(\)/);assert.match(app,/queueSoloBombCheck/);assert.match(app,/answer:typed,auto:true/);
 assert.match(app,/existingBombAnswer/);assert.match(app,/oldFocus==='soloBombAnswer'/);
 assert.match(app,/animateBombs\(\$\('soloBombArena'\)\)/);
 assert.match(app,/batch===3\?'29%':'43%'/);
 assert.match(app,/bombCardsMarkup/);assert.match(app,/!Object\.hasOwn|escapeHtml\(b\.meaning\)/);
});

test('BOMB retry persists the exact attempt and answer only in sessionStorage',()=>{
 assert.match(app,/wordsky_solo_bomb_pending/);assert.match(app,/wordsky_solo_bomb_run/);
 assert.match(app,/pending\.mode==='BOMB'\?\{attemptId:pending\.attemptId,answer:pending\.answer,auto:true\}/);
 assert.match(app,/attempts\/\$\{pending\.attemptId\}/);assert.match(app,/if\(!soloGame\|\|soloBusy\|\|soloPending/);
 assert.doesNotMatch(app,/localStorage/);
});

test('BOMB Solo mobile layout stays within 360px and provides the shared compact keyboard',()=>{
 assert.match(css,/Phase 2\.2 — BOMB Solo/);assert.match(css,/#soloBombGamePane \.game-keyboard\{display:flex/);
 assert.match(css,/@media\(max-width:390px\)/);assert.match(css,/\.solo-bomb-shell\{padding-inline:9px\}/);
 assert.match(css,/overflow:hidden/);assert.match(app,/compactKeyboard\('soloBombAnswer',true\)/);
});

test('MATCH route and multiplayer BOMB/CAR hooks remain available',()=>{
 assert.match(html,/id="screen-solo"/);assert.match(app,/async function beginSoloMatch/);
 assert.match(app,/id="bombArena"/);assert.match(app,/id="carAnswerForm"/);
 assert.match(app,/if\(screen!=='rooms'\)/);
});

test('MATCH and BOMB use mode-specific HUD, form and action IDs so hidden screens cannot capture updates',()=>{
 for(const suffix of ['SetupForm','Score','Health','Countdown','Feedback','PendingRetry','Replay','Home','NewConfig','TopicsRetry','StartRetry','ResultTitle']){
  assert.match(app,new RegExp('soloBomb'+suffix),'BOMB needs independent '+suffix+' ID');
 }
 assert.match(app,/const clock=\$\(screen==='solo-car'\?'soloCarCountdown':screen==='solo-bomb'\?'soloBombCountdown':'soloCountdown'\)/);
 assert.match(app,/const score=\$\('soloBombScore'\),health=\$\('soloBombHealth'\)/);
 assert.match(app,/soloHost\(mode,'SetupPane'\)\?\.querySelector/);
});
