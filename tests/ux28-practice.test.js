import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  normalizeRecallAnswer,gradeRecall,validateMistakeNotebook,selectRecallWords,
  reviewPayload
} from '../public/ux28-practice-core.js';

const uuid=()=>randomUUID();
const actor=uuid();
const word=(data={})=>({
  word_id:uuid(),english:'take off',meaning:'cất cánh',topic:'Travel',
  modes:['MATCH','BOMB'],review_count:1,remembered:false,mistake_runs:2,
  last_seen_at:'2026-10-29T08:00:00Z',...data
});
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('UX28 grades typed recall with normalized spaces, case, Unicode, apostrophes',()=>{
 assert.equal(normalizeRecallAnswer('  TAKE   OFF  '),'take off');
 assert.equal(normalizeRecallAnswer('DON’T'),'don\'t');
 assert.equal(gradeRecall(' TaKe  off ','take off').correct,true);
 assert.equal(gradeRecall('don’t','don\'t').correct,true);
 assert.equal(gradeRecall('take','take off').correct,false);
 assert.equal(gradeRecall('','take off').correct,false);
 assert.equal(gradeRecall('take-off','take off').correct,false,
   'a different spelling should not be silently accepted');
});

test('UX28 rejects a notebook from a different signed-in account and duplicate words',()=>{
 const row=word();
 const data={scope:'account-game-mistakes',actor_id:actor,words:[row]};
 assert.equal(validateMistakeNotebook(data,actor),data);
 assert.throws(()=>validateMistakeNotebook(data,uuid()),/tài khoản/);
 assert.throws(()=>validateMistakeNotebook({...data,words:[row,row]},actor),/không hợp lệ/);
 assert.throws(()=>validateMistakeNotebook({...data,words:[{...row,review_count:-1}]},actor),/không hợp lệ/);
 assert.throws(()=>validateMistakeNotebook({...data,words:[{...row,modes:['ADMIN']}]},actor),/không hợp lệ/);
});

test('UX28 selects needed words first, mode filters and never returns unowned deep-link word',()=>{
 const needed=word({mistake_runs:3});
 const remembered=word({remembered:true,mistake_runs:100});
 const another=word({modes:['CAR'],mistake_runs:2});
 const data=[remembered,needed,another];
 assert.deepEqual(selectRecallWords(data,{scope:'needed',limit:5}).map(w=>w.word_id),
   [needed.word_id,another.word_id]);
 assert.deepEqual(selectRecallWords(data,{scope:'all',limit:5}).map(w=>w.word_id),
   [needed.word_id,another.word_id,remembered.word_id]);
 assert.deepEqual(selectRecallWords(data,{scope:'all',mode:'CAR',limit:10}).map(w=>w.word_id),
   [another.word_id]);
 assert.deepEqual(selectRecallWords(data,{scope:'all',limit:5,wordId:remembered.word_id}).map(w=>w.word_id),
   [remembered.word_id]);
 assert.deepEqual(selectRecallWords(data,{scope:'all',limit:5,wordId:uuid()}),[]);
 assert.deepEqual(selectRecallWords([needed,needed],{limit:5}),[needed]);
 assert.throws(()=>selectRecallWords(data,{limit:1000}),/không hợp lệ/);
});

test('UX28 account review payload pins actor and progress version',()=>{
 const w=word({review_count:7});
 const rid=uuid();
 const p=reviewPayload(w,false,actor,rid);
 assert.deepEqual(p,{request_id:rid,source:'shared',word_id:w.word_id,remembered:false,
   expected_review_count:7,expected_actor_id:actor});
 assert.throws(()=>reviewPayload(w,true,'bad',rid),/an toàn/);
});

test('UX28 is reachable from notebook, My Learning, results and shared progress nav',()=>{
 for(const path of ['public/mistakes.html','public/progress.html','public/app.js','public/shared-nav.js'])
   assert.match(src(path),/\/practice\.html/);
 const html=src('public/practice.html');
 assert.match(html,/id="ws28StartForm"/);
 assert.match(html,/id="ws28Answer"/);
 assert.match(html,/id="ws28Feedback"/);
 assert.match(html,/id="ws28Retry"/);
 assert.match(html,/id="ws28Done"/);
 assert.match(html,/src="\/ux28-practice\.js"/);
});

test('UX28 only saves confirmed recall through existing idempotent account review API',()=>{
 const ui=src('public/ux28-practice.js');
 assert.match(ui,/postUnifiedAccountReview\(/);
 assert.match(ui,/auth\.actor\.id!==activeActor/);
 assert.match(ui,/if\(attempt\.correct\)correctCount\+\+/);
 assert.match(ui,/attempt\.confirmed=true/);
 assert.match(ui,/await loadAccount\('Lịch sử đã thay đổi/);
 assert.doesNotMatch(ui,/localStorage\.setItem|fetch\(\s*['"]\/api\/learning\/flashcards\/reviews/);
 const pure=src('public/ux28-practice-core.js');
 assert.doesNotMatch(pure,/fetch\(|localStorage|window\.location/);
});
