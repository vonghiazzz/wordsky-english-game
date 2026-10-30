import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 normalizeRound,createState,answerQuestion,publicState,reconcile,
 MATRIX_SIZES,MATRIX_DURATION_SECONDS,assertWordCapacity
} from '../lib/game.js';

const words=Array.from({length:140},(_,i)=>({
 id:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`,
 english:`english ${i}`,meaning:`nghĩa ${i}`
}));
const make=size=>normalizeRound({
 mode:'MATRIX',difficulty:size===8?'EASY':size===12?'NORMAL':'HARD',
 duration_seconds:MATRIX_DURATION_SECONDS[size],
 question_count:MATRIX_SIZES[size],points_per_correct:100,penalty:25,weight:1
},{soloMatrix:true});
const tile=(state,pair,lang)=>state.cards.find(c=>c.id===(lang==='en'?pair.enId:pair.viId));

for(const size of [8,12,16]){
 test(`UX33 ${size}x${size} creates balanced, secret-mapped cards`,()=>{
  const rd=make(size),state=createState(rd,words,1000),publicGame=publicState(state,1000);
  assert.equal(publicGame.mode,'MATRIX');
  assert.equal(publicGame.gridSize,size);
  assert.equal(publicGame.cards.length,size*size);
  assert.equal(new Set(publicGame.cards.map(c=>c.id)).size,size*size);
  assert.equal(publicGame.cards.filter(c=>c.lang==='en').length,rd.question_count);
  assert.equal(publicGame.cards.filter(c=>c.lang==='vi').length,rd.question_count);
  assert.ok(publicGame.cards.every(c=>!('wordId' in c)&&!('pairId' in c)&&!('meaning' in c)&&!('english' in c)));
  assert.equal(Object.hasOwn(publicGame,'pairs'),false);
  assert.equal(Object.hasOwn(publicGame,'wrongWordIds'),false);
 });
}
test('UX33 is Solo only and cannot take arbitrary matrix dimensions',()=>{
 assert.throws(()=>normalizeRound({mode:'MATRIX',question_count:32,duration_seconds:600}),/Chế độ/);
 for(const q of [0,31,33,64,256])
  assert.throws(()=>normalizeRound({mode:'MATRIX',question_count:q,duration_seconds:600},{soloMatrix:true}),/Ma trận/);
 assert.throws(()=>make(17));
});
test('UX33 correct pair earns +100 and locks both cards',()=>{
 const rd=make(8),state=createState(rd,words,1000),p=state.pairs[0];
 const first=tile(state,p,'en'),second=tile(state,p,'vi');
 assert.deepEqual(answerQuestion(state,rd,{firstId:first.id,secondId:second.id},1300).result,{correct:true,awarded:100});
 assert.equal(state.score,100);
 assert.equal(state.correct,1);
 assert.equal(state.health,3);
 const shown=publicState(state,1400);
 assert.equal(shown.cards.find(c=>c.id===first.id).matched,true);
 assert.equal(shown.cards.find(c=>c.id===second.id).matched,true);
 assert.throws(()=>answerQuestion(state,rd,{firstId:first.id,secondId:second.id},1500),/đã ghép/);
});
test('UX33 three mismatches exhaust three hearts and record both wrong words',()=>{
 const rd=make(8),state=createState(rd,words,1000),first=state.pairs[0],second=state.pairs[1];
 for(let i=0;i<3;i++){
  const attempt=answerQuestion(state,rd,{firstId:first.enId,secondId:second.viId},1300+i);
  assert.equal(attempt.result.correct,false);
  assert.equal(attempt.result.awarded,-25);
  assert.equal(state.health,2-i);
 }
 assert.equal(state.status,'FAILED');
 assert.equal(state.mistakes,3);
 assert.equal(state.score,0);
 assert.deepEqual(new Set(state.wrongWordIds),new Set([first.id,second.id]));
 assert.equal(publicState(state,1500).wrongWordIds,undefined);
 assert.throws(()=>answerQuestion(state,rd,{firstId:first.enId,secondId:second.viId},1500),/kết thúc/);
});
test('UX33 invalid same-language or unknown card cannot remove hearts',()=>{
 const rd=make(8),state=createState(rd,words,1000);
 assert.throws(()=>answerQuestion(state,rd,{firstId:state.pairs[0].enId,secondId:state.pairs[1].enId},1200),/một thẻ tiếng Anh/);
 assert.throws(()=>answerQuestion(state,rd,{firstId:state.pairs[0].enId,secondId:'not-a-card'},1200),/không hợp lệ/);
 assert.equal(state.health,3);
 assert.equal(state.mistakes,0);
});
test('UX33 all cards solved completes run; timeouts are computed on server',()=>{
 const rd=make(8),state=createState(rd,words,1000);
 for(const p of state.pairs)answerQuestion(state,rd,{firstId:p.enId,secondId:p.viId},1100);
 assert.equal(state.status,'COMPLETED');
 assert.equal(state.correct,32);
 assert.equal(state.score,3200);
 const late=createState(rd,words,1000);
 reconcile(late,rd,601000);
 assert.equal(late.status,'TIMEOUT');
});
test('UX33 requires 128 unique words for 16x16 and uses disabled-by-default schema gate',()=>{
 const rd=make(16);
 assert.throws(()=>createState(rd,words.slice(0,127),1000),/cần 128 từ/);
 const migration=readFileSync(new URL('../db/migrations/20261030_ux33_matrix_solo.sql',import.meta.url),'utf8');
 assert.match(migration,/VALIDATE CONSTRAINT ws_solo_runs_mode_check/);
 assert.match(migration,/VALUES \('MATRIX',false\)/);
 assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE public\.ws_users/i);
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/solo\/matrix\/start/);
 assert.match(api,/selectMatrixWords/);
 assert.match(api,/mode==='MATRIX'&&feature\.rows\[0\]\?\.enabled!==true/);
 assert.match(api,/syncFinishedSoloReview\(ownerForAutoReview,runId\)/);
});
