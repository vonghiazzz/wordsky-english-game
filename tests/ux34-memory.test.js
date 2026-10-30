import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {
 normalizeRound,createState,answerQuestion,publicState,reconcile,
 MATRIX_SIZES,MATRIX_DURATION_SECONDS,MEMORY_DURATION_SECONDS
} from '../lib/game.js';

const words=Array.from({length:140},(_,i)=>({
 id:'22222222-2222-4222-8222-'+String(i).padStart(12,'0'),
 english:'English '+i,meaning:'Nghĩa '+i
}));
function rd(size,mode='MEMORY'){
 return normalizeRound({mode,difficulty:'NORMAL',
  question_count:MATRIX_SIZES[size],
  duration_seconds:mode==='MEMORY'?MEMORY_DURATION_SECONDS[size]:MATRIX_DURATION_SECONDS[size],
  points_per_correct:100,penalty:25,weight:1},{soloMatrix:true});
}
for(const size of [4,5,6,8,10,12,16]){
 test('UX34 '+size+'x'+size+' MATRIX and MEMORY use matching word capacities',()=>{
  assert.equal(MATRIX_SIZES[size],Math.floor(size*size/2));
  const matrix=rd(size,'MATRIX'),memory=rd(size);
  assert.equal(memory.duration_seconds,matrix.duration_seconds/2);
  for(const round of [matrix,memory]){
   const st=createState(round,words,1000),shown=publicState(st,1000);
   assert.equal(shown.cards.length,size*size);
   assert.equal(shown.gridSize,size);
   assert.equal(new Set(shown.cards.filter(c=>!c.empty).map(c=>c.id)).size,MATRIX_SIZES[size]*2);
   assert.equal(shown.cards.filter(c=>c.empty).length,size%2);
   if(size===5)assert.deepEqual(shown.cards[12],{empty:true});
   assert.equal(st.status,'PLAYING');
  }
 });
}
test('UX34 initial MEMORY state hides all labels, languages and word identifiers',()=>{
 const st=createState(rd(6),words,1000);
 const view=publicState(st,1000);
 assert.ok(view.cards.every(c=>!('label' in c)&&!('lang' in c)&&!('wordId' in c)&&!('pairId' in c)));
 assert.ok(view.cards.every(c=>c.revealed===false&&c.matched===false));
 assert.equal(Object.hasOwn(view,'pairs'),false);
 assert.equal(Object.hasOwn(view,'wrongWordIds'),false);
 assert.equal(view.health,3);
});
test('UX34 first flip reveals only one face; incorrect second pair auto-hides after 1100ms',()=>{
 const round=rd(6),st=createState(round,words,1000);
 const one=st.pairs[0],other=st.pairs[1];
 const first=answerQuestion(st,round,{cardId:one.enId},1300);
 assert.equal(first.result.complete,false);
 assert.equal(st.score,0);
 let shown=publicState(st,1300);
 assert.equal(shown.cards.filter(c=>c.revealed).length,1);
 assert.ok(shown.cards.find(c=>c.id===one.enId).label);
 assert.ok(shown.cards.every(c=>c.id===one.enId||!('label' in c)));
 const second=answerQuestion(st,round,{cardId:other.viId},1400);
 assert.deepEqual(second.result,{complete:true,correct:false,awarded:-25});
 assert.equal(st.health,3);
 assert.equal(st.mistakes,1);
 assert.deepEqual(new Set(st.wrongWordIds),new Set([one.id,other.id]));
 shown=publicState(st,1400);
 assert.equal(shown.cards.filter(c=>c.revealed).length,2);
 assert.throws(()=>answerQuestion(st,round,{cardId:st.pairs[2].enId},1500),/Chờ hai thẻ/);
 reconcile(st,round,2501);
 shown=publicState(st,2501);
 assert.ok(shown.cards.every(c=>!('label' in c)&&!c.revealed));
 assert.equal(st.health,3);
});
test('UX34 matching pair scores, locks both tiles and reveals no other answers',()=>{
 const round=rd(6),st=createState(round,words,1000),pair=st.pairs[0];
 answerQuestion(st,round,{cardId:pair.enId},1300);
 const result=answerQuestion(st,round,{cardId:pair.viId},1400);
 assert.deepEqual(result.result,{complete:true,correct:true,awarded:100});
 assert.equal(st.score,100);
 assert.equal(st.correct,1);
 assert.equal(st.health,3);
 const view=publicState(st,1400);
 assert.equal(view.cards.filter(c=>c.matched).length,2);
 assert.ok(view.cards.every(c=>!('label' in c)));
 assert.throws(()=>answerQuestion(st,round,{cardId:pair.enId},1500),/đã ghép/);
});
test('UX34 MEMORY never deducts hearts, supports repeated incorrect attempts and timeouts',()=>{
 const round=rd(6),st=createState(round,words,1000),a=st.pairs[0],b=st.pairs[1];
 for(let n=0;n<5;n++){
  const t=1300+n*2200;
  answerQuestion(st,round,{cardId:a.enId},t);
  answerQuestion(st,round,{cardId:b.viId},t+1);
  reconcile(st,round,t+1102);
 }
 assert.equal(st.health,3);
 assert.equal(st.status,'PLAYING');
 assert.equal(st.mistakes,5);
 assert.equal(st.score,0);
 reconcile(st,round,181001);
 assert.equal(st.status,'TIMEOUT');
});
test('UX34 MEMORY fully solved creates COMPLETED run without losing hearts',()=>{
 const round=rd(6),st=createState(round,words,1000);
 for(const pair of st.pairs){
  answerQuestion(st,round,{cardId:pair.enId},1100);
  answerQuestion(st,round,{cardId:pair.viId},1101);
 }
 assert.equal(st.status,'COMPLETED');
 assert.equal(st.correct,18);
 assert.equal(st.score,1800);
 assert.equal(st.health,3);
});
test('UX34 no arbitrary grid dimensions, and default features disabled in migration',()=>{
 for(const invalid of [9,20,31,64,127,129]){
  assert.throws(()=>normalizeRound({mode:'MEMORY',duration_seconds:180,
   question_count:invalid},{soloMatrix:true}),/Ma trận/);
 }
 const schema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
 const mig=readFileSync(new URL('../db/migrations/20261030_ux34_matrix_memory_config.sql',import.meta.url),'utf8');
 assert.match(schema,/MEMORY/);
 assert.match(mig,/VALUES \('MEMORY',false\)/);
 assert.match(mig,/VALIDATE CONSTRAINT ws_rounds_mode_check/);
 assert.doesNotMatch(mig,/DROP TABLE|TRUNCATE|DELETE FROM public\.ws_users|UPDATE public\.ws_users/i);
});
test('UX34 Solo and Admin UI work with both modes without exposing secret face values',()=>{
 const matrix=readFileSync(new URL('../public/matrix.html',import.meta.url),'utf8');
 const memory=readFileSync(new URL('../public/memory.html',import.meta.url),'utf8');
 const client=readFileSync(new URL('../public/matrix.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new vm.Script(client));
 assert.doesNotThrow(()=>new vm.Script(app));
 assert.match(memory,/data-matrix-mode="MEMORY"/);
 assert.match(memory,/Không mất tim/);
 assert.match(matrix,/data-matrix-mode="MATRIX"/);
 for(const size of [4,5,6]){
  assert.match(memory,new RegExp('<option value="'+size+'">'));
  assert.match(matrix,new RegExp('<option value="'+size+'">'));
 }
 for(const large of [8,10,12,16]){
  assert.doesNotMatch(matrix,new RegExp('<option value="'+large+'">'));
  assert.doesNotMatch(memory,new RegExp('<option value="'+large+'">'));
 }
 assert.match(client,/cardId:id/);
 assert.match(client,/!MEMORY\|\|c\.revealed===true/);
 assert.match(app,/room-matrix-scroll/);
 assert.match(app,/data-room-card/);
 assert.match(api,/solo\/memory\/start/);
 assert.match(api,/r=>normalizeRound\(r,\{soloMatrix:true\}\)/);
 assert.match(api,/startRound\(req,code,roundId\)/);
});
