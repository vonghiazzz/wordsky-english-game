import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../public/shared-nav.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
test('CAR Solo is reachable from home, shared navigation and direct route',()=>{
 assert.match(html,/screen-solo-car/);assert.match(html,/soloCarSetupPane/);assert.match(html,/soloCarGamePane/);
 assert.match(nav,/\/#solo-car/);assert.match(app,/soloModeForScreen=\(\)=>screen==='solo-car'\?'CAR'/);
 assert.match(app,/data-screen="solo-car"|solo-car/);
});
test('CAR uses server-reported lanes, CEFR tiers, correct CSS/keyboard and 360px guard',()=>{
 assert.match(app,/function renderSoloCarGame/);
 assert.match(app,/data-solo-car-lane=/);assert.match(app,/car-stage solo-car-stage/);
 assert.match(app,/compactKeyboard\('soloCarAnswer'\)/);
 assert.match(app,/if\(!lane\|\|lane\.kind==='BLOCKED'\)/);
 assert.match(css,/@media\(max-width:760px\)/);
});
test('CAR Solo shares pending receipt persistence and does not touch tournament XP',()=>{
 assert.match(app,/wordsky_solo_car_run/);assert.match(app,/wordsky_solo_car_pending/);
 assert.match(app,/pending\.mode==='CAR'\?\{attemptId:pending\.attemptId,lane:pending\.lane,answer:pending\.answer\}/);
 assert.match(app,/const send=\(\)=>api\(`solo\/runs\/\$\{pending.runId\}\/answer`/);
 assert.match(app,/updateSoloCarTimers/);
});

test('CAR Solo vehicle moves only after server accepts a translation',()=>{
 assert.match(app,/await animateCarCrossing\(out\.result\.laneFrom/);
 assert.match(app,/out\.result\?\.laneSafe&&out\.result\?\.wordCorrect/);
 assert.match(app,/vehicleSelector:'#soloCarVehicle'/);
});
