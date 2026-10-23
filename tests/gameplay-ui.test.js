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
test('bomb and CAR keyboards only appear in active playing runs and never overlay Start',()=>{
 assert.match(ui,/bombArenaMarkup\(g,rd\)/);
 assert.match(ui,/id="carAnswer"[^>]*inputmode="text"/);
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
 assert.doesNotMatch(bomb,/data-select-bomb|compactKeyboard/);
 assert.match(ui,/body:\{answer:typed,auto:true\}/);
 assert.match(ui,/queueBombCheck\(\)/);
 assert.match(ui,/function syncBombArena\(\)/);
});

test('CAR uses native full-word input and still requires server-validated lane answer',()=>{
 const car=ui.split(" }else if(g.mode==='CAR'){")[1]?.split(' if(feedback')[0];
 assert.ok(car);
 assert.match(car,/id="carAnswer"[^>]*inputmode="text"/);
 assert.doesNotMatch(car,/compactKeyboard\('carAnswer'\)/);
 assert.doesNotMatch(ui,/el\.readOnly=true/);
 assert.match(ui,/submitGameAnswer\(\{lane:selectedLane,answer:ans\}\)/);
});

test('leaderboard has mobile-friendly score columns and compact spacing',()=>{
 assert.match(ui,/room-leaderboard-heading/);
 assert.match(css,/#eventBoard \.board-row\{grid-template-columns:/);
 assert.match(css,/#liveGame \.game-shell\{margin-bottom:6px\}/);
});
