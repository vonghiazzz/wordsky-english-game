import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
test('admin displays persisted bomb and per-stage CAR options',()=>{
 for(const k of ['bomb_fall_seconds','bomb_batch_size','bomb_spawn_interval_seconds','car_step_seconds']){
  assert.match(ui,new RegExp('data-k="'+k+'"'));
  assert.match(api,new RegExp('r\\.'+k+'|r\\.mode'));
 }
});
test('BOMB and CAR render native keyboard inputs while keeping Start unobstructed',()=>{
 assert.match(ui,/bombArenaMarkup\(g,rd\)/);
 assert.match(ui,/id="carAnswer"[^>]*inputmode="text"/);
 assert.doesNotMatch(ui,/compactKeyboard\('bombAnswer',true\)/);
 assert.doesNotMatch(ui,/compactKeyboard\('carAnswer',true\)/);
 assert.match(css,/#startRoundButton\{position:relative;z-index:2\}/);
 assert.match(css,/\.game-answer-row\{display:flex/);
});
test('gameplay configuration is selected by server from round database rows',()=>{
 for(const k of ['bomb_fall_seconds','bomb_batch_size','bomb_spawn_interval_seconds','car_step_seconds'])assert.ok(api.includes(k));
 assert.match(ui,/carStepTimer/);
 assert.match(ui,/Mất 1 tim/);
});


test('all-topics choice is offered only for round configuration, never for adding vocabulary',()=>{
 const helper=ui.match(/^function optionsTopics\(value,allowAll=false\)\{[^\n]+\}/m)?.[0];
 assert.ok(helper,'topic dropdown helper must exist');
 const optionsTopics=new Function('topics','escapeHtml',`${helper};return optionsTopics;`)(
  [{id:'animals',title:'Animals',words:[{english:'cat'}]}],value=>String(value)
 );
 assert.match(optionsTopics(null,true),/>Tất cả chủ đề<\/option>/);
 assert.doesNotMatch(optionsTopics(null),/>Tất cả chủ đề<\/option>/);
 assert.match(optionsTopics(null),/value="" disabled selected/);
 assert.match(ui,/optionsTopics\(r\.topic_id,true\)/);
 assert.match(ui,/optionsTopics\(topics\[0\]\?\.id\)/);
});


test('BOMB auto-defuses without selecting a bomb or submitting the form',()=>{
 const bomb=ui.split(" }else if(g.mode==='BOMB'){")[1]?.split(" }else if(g.mode==='CAR'){")[0];
 assert.ok(bomb);
 assert.match(bomb,/bombArenaMarkup\(g,rd\)/);
 assert.match(bomb,/id="bombAnswer"[^>]*inputmode="text"/);
 assert.doesNotMatch(bomb,/data-select-bomb/);
 assert.doesNotMatch(bomb,/compactKeyboard\('bombAnswer',true\)/);
 assert.match(ui,/body:\{answer:typed,auto:true\}/);
 assert.match(ui,/queueBombCheck\(\)/);
 assert.match(ui,/function syncBombArena\(\)/);
});

test('CAR auto-type uses native input and asks server to select the lane',()=>{
 const car=ui.split(" }else if(g.mode==='CAR'){")[1]?.split(' if(feedback')[0];
 assert.ok(car);
 assert.match(car,/id="carAnswer"[^>]*inputmode="text"/);
 assert.doesNotMatch(car,/compactKeyboard\('carAnswer',true\)/);
 assert.doesNotMatch(car,/data-lane=/);
 assert.match(ui,/input\.readOnly=false/);
 assert.match(ui,/input\.inputMode='text'/);
 assert.match(ui,/submitGameAnswer\(\{auto:true,answer:typed\}\)/);
});

test('leaderboard has mobile-friendly score columns and compact spacing',()=>{
 assert.match(ui,/room-leaderboard-heading/);
 assert.match(css,/#eventBoard \.board-row\{grid-template-columns:/);
 assert.match(css,/#liveGame \.game-shell\{margin-bottom:6px\}/);
});


test('all typing games use device keyboard, no virtual keys mounted or pointerdown suppression',()=>{
 for(const target of ['bombAnswer','carAnswer','soloBombAnswer','soloCarAnswer']){
  assert.doesNotMatch(ui,new RegExp(`compactKeyboard\\('${target}',true\\)`));
 }
 assert.match(ui,/input\.readOnly=false/);
 assert.match(ui,/input\.inputMode='text'/);
 assert.doesNotMatch(ui,/pointerdown.*data-game-key/);
 assert.match(css,/\.game-keyboard\{display:none!important\}/);
 assert.match(ui,/field\.setRangeText\(e\.key/);
});

test('Admin CEFR requirements match CAR difficulty lane plans',()=>{
 const fn=ui.match(/function carVocabularyNeeds\(difficulty,count\)\{[\s\S]*?\n\}/)?.[0];
 assert.ok(fn);
 const required=new Function(`${fn};return carVocabularyNeeds`)();
 assert.deepEqual(required('EASY',8),{A2:24,BONUS:8,DOUBLE:0});
 assert.deepEqual(required('NORMAL',8),{A2:8,BONUS:8,DOUBLE:8});
 assert.deepEqual(required('HARD',8),{A2:0,BONUS:8,DOUBLE:16});
 assert.match(ui,/const need=carVocabularyNeeds\(round\.difficulty,round\.question_count\)/);
});

test('CAR auto-checks complete words without requiring lane selection or Enter',()=>{
 assert.doesNotMatch(ui, /<button id="carDrive"/);
 assert.match(ui,/queueCarAutoCheck\('room'/);
 assert.match(ui,/id="carAnswerForm"/);
 assert.match(ui,/if\(Date\.now\(\)\+localTimeOffset<g\.nextAllowedAt\)/);
 assert.match(ui,/e\.target\.id==='carAnswerForm'/);
});

test('BOMB and CAR show short on-arena feedback and expand the game viewport',()=>{
 assert.match(ui,/function arenaFeedbackMarkup\(\)/);
 assert.match(ui,/\$\{arenaFeedbackMarkup\(\)\}/);
 assert.match(ui,/id="gameSizeToggle"/);
 assert.match(ui,/gameExpanded=!gameExpanded/);
 assert.match(css,/#liveGame\.game-expanded \.game-shell/);
 assert.match(css,/#liveGame \.game-inline-feedback/);
 assert.match(css,/#liveGame \.car-stage \.car-v6-lane/);
});
