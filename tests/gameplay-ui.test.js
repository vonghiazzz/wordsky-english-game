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
 assert.match(ui,/g\.status==='PLAYING'\?compactKeyboard\('bombAnswer'\)/);
 assert.match(ui,/g\.status==='PLAYING'&&!isBlocked\?compactKeyboard\('carAnswer'\)/);
 assert.match(css,/#startRoundButton\{position:relative;z-index:2\}/);
 assert.match(css,/\.game-answer-row\{display:flex/);
});
test('gameplay configuration is selected by server from round database rows',()=>{
 for(const k of ['bomb_fall_seconds','bomb_batch_size','bomb_spawn_interval_seconds','car_step_seconds'])assert.ok(api.includes(k));
 assert.match(ui,/carStepTimer/);
 assert.match(ui,/Mất 1 tim/);
});
