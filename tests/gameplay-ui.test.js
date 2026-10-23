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
test('BOMB and CAR render custom keyboards only for active rounds and keep Start unobstructed',()=>{
 assert.match(ui,/bombArenaMarkup\(g,rd\)/);
 assert.match(ui,/id="carAnswer"[^>]*inputmode="text"/);
 assert.match(ui,/g\.status==='PLAYING'\?compactKeyboard\('bombAnswer',true\)/);
 assert.match(ui,/g\.status==='PLAYING'&&!isBlocked\?compactKeyboard\('carAnswer'\)/);
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
 assert.match(bomb,/compactKeyboard\('bombAnswer',true\)/);
 assert.match(ui,/body:\{answer:typed,auto:true\}/);
 assert.match(ui,/queueBombCheck\(\)/);
 assert.match(ui,/function syncBombArena\(\)/);
});

test('CAR uses an in-game full-word keyboard and keeps server-validated lane answers',()=>{
 const car=ui.split(" }else if(g.mode==='CAR'){")[1]?.split(' if(feedback')[0];
 assert.ok(car);
 assert.match(car,/id="carAnswer"[^>]*inputmode="text"/);
 assert.match(car,/compactKeyboard\('carAnswer'\)/);
 assert.match(ui,/input\.readOnly=mobile/);
 assert.match(ui,/input\.inputMode=mobile\?'none':'text'/);
 assert.match(ui,/submitGameAnswer\(\{lane:selectedLane,answer:ans\}\)/);
});

test('leaderboard has mobile-friendly score columns and compact spacing',()=>{
 assert.match(ui,/room-leaderboard-heading/);
 assert.match(css,/#eventBoard \.board-row\{grid-template-columns:/);
 assert.match(css,/#liveGame \.game-shell\{margin-bottom:6px\}/);
});


test('BOMB and CAR custom keyboards reproduce the falling-word QWERTY rows and actions',()=>{
 const section=ui.split('function compactKeyboard(target,autoSubmit=false){')[1]?.split('function mobileGameKeyboard()')[0];
 assert.ok(section,'custom keyboard helper exists');
 const render=new Function(`function compactKeyboard(target,autoSubmit=false){${section}return compactKeyboard;`)();
 const bomb=render('bombAnswer',true);
 const car=render('carAnswer');
 for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
  assert.match(bomb,new RegExp(`data-game-key="${c}"`));
  assert.match(car,new RegExp(`data-game-key="${c}"`));
 }
 assert.match(bomb,/data-game-key="CLEAR"/);
 assert.match(bomb,/data-game-key="SPACE"/);
 assert.match(bomb,/data-game-key="DEL"/);
 assert.doesNotMatch(bomb,/data-game-key="ENTER"/);
 assert.doesNotMatch(bomb,/data-game-key="DEL_WORD"/);
 assert.match(car,/data-game-key="CLEAR"/);
 assert.match(car,/data-game-key="SPACE"/);
 assert.match(car,/data-game-key="ENTER"/);
 assert.match(car,/data-game-key="DEL"/);
 assert.ok(bomb.indexOf('data-game-key="CLEAR"')<bomb.indexOf('data-game-key="DEL"'));
 assert.ok(car.indexOf('data-game-key="CLEAR"')<car.indexOf('data-game-key="DEL"'));
});

test('right keyboard action removes one character, left clears all',()=>{
 const helper=ui.match(/function removeLastGameCharacter\(text\)\{[\s\S]*?\n\}/)?.[0];
 assert.ok(helper);
 const remove=new Function(`${helper};return removeLastGameCharacter`)();
 assert.equal(remove('apple'),'appl');
 assert.equal(remove('green apple'),'green appl');
 assert.equal(remove(''), '');
 assert.match(ui,/key==='CLEAR'\)input\.value=''/);
 assert.match(ui,/key==='DEL'\)input\.value=removeLastGameCharacter/);
});

test('touch typing uses embedded keyboards and does not open the system keyboard',()=>{
 assert.match(ui,/function mobileGameKeyboard\(\)\{return matchMedia/);
 assert.match(ui,/input\.readOnly=mobile/);
 assert.match(ui,/input\.inputMode=mobile\?'none':'text'/);
 assert.match(ui,/event\.target\.closest\('\[data-game-key\]'\)/);
 assert.match(css,/@media \(pointer:coarse\) and \(max-width:760px\)/);
 assert.match(css,/#liveGame \.game-keyboard\{display:flex/);
 assert.match(css,/#liveGame \.bomb-arena\{height:clamp\(/);
 assert.match(ui,/input\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\)/);
 assert.match(ui,/queueBombCheck\(\)/);
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

test('CAR submits by in-game Enter with no extra submit button',()=>{
 assert.doesNotMatch(ui, /<button id="carDrive"/);
 assert.match(ui,/if\(key==='ENTER'\)/);
 assert.match(ui,/id="carAnswerForm"/);
 assert.match(ui,/game\?\.game\?\.nextAllowedAt/);
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
