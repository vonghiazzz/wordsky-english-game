import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRound,createState,answerQuestion,publicState,SOLO_MATRIX_SIZES,MATRIX_SIZES,MATRIX_DURATION_SECONDS,MEMORY_DURATION_SECONDS} from '../lib/game.js';
const words=Array.from({length:140},(_,i)=>({id:'55555555-5555-4555-8555-'+String(i).padStart(12,'0'),english:'English '+i,meaning:'Nghĩa '+i}));
function round(size,mode='MEMORY',soloOnly=true){
 return normalizeRound({mode,question_count:MATRIX_SIZES[size],duration_seconds:mode==='MEMORY'?MEMORY_DURATION_SECONDS[size]:MATRIX_DURATION_SECONDS[size],difficulty:'NORMAL',points_per_correct:100,penalty:25,weight:1},{soloMatrix:true,soloOnly});
}
test('UX35 Solo allows 4/5/6, while Admin can still use 8/10/12/16',()=>{
 assert.deepEqual(Object.keys(SOLO_MATRIX_SIZES),['4','5','6']);
 for(const size of [4,5,6])for(const mode of ['MATRIX','MEMORY'])assert.doesNotThrow(()=>round(size,mode));
 for(const size of [8,10,12,16]){
  assert.throws(()=>round(size,'MATRIX'),/Solo/);
  assert.throws(()=>round(size,'MEMORY'),/Solo/);
  assert.equal(round(size,'MATRIX',false).question_count,MATRIX_SIZES[size]);
 }
});
test('UX35 5x5 stores 12 complete pairs and a centre slot without sensitive data',()=>{
 for(const mode of ['MATRIX','MEMORY']){
  const rd=round(5,mode),st=createState(rd,words,1000),pub=publicState(st,1000);
  assert.equal(pub.gridSize,5);
  assert.equal(pub.cards.length,25);
  assert.equal(st.pairs.length,12);
  assert.equal(pub.cards.filter(c=>c.empty).length,1);
  assert.deepEqual(pub.cards[12],{empty:true});
  assert.deepEqual(st.cards[12],{empty:true});
  assert.equal(pub.cards.filter(c=>c.id).length,24);
  assert.ok(!('id' in pub.cards[12])&&!('wordId' in pub.cards[12])&&!('label' in pub.cards[12]));
  assert.throws(()=>answerQuestion(st,rd,mode==='MEMORY'?{cardId:'empty'}:{firstId:'empty',secondId:st.pairs[0].viId},1200),/không hợp lệ/);
  assert.equal(st.health,3);assert.equal(st.score,0);
 }
});
test('UX35 5x5 MEMORY reveals only one of 24 private faces',()=>{
 const rd=round(5),st=createState(rd,words,1000);
 const before=publicState(st,1000);
 assert.ok(before.cards.every(c=>c.empty||(!('label' in c)&&!('lang' in c))));
 answerQuestion(st,rd,{cardId:st.pairs[0].enId},1300);
 const after=publicState(st,1300);
 assert.equal(after.cards.filter(c=>c.revealed).length,1);
 assert.deepEqual(after.cards[12],{empty:true});
});
test('UX35 10x10 and 12x12 saved runs still restore their grid size',()=>{
 for(const size of [10,12]){
  const rd=round(size,'MATRIX',false),st=createState(rd,words,1000);
  assert.equal(publicState(st,1000).gridSize,size);
  assert.equal(st.cards.length,size*size);
 }
});
test('UX35 Solo and competition UI render and ignore the blank slot',()=>{
 const solo=readFileSync(new URL('../public/matrix.js',import.meta.url),'utf8');
 const room=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(solo,/if\(c\.empty\)return '<div class="matrix-card-space"/);
 assert.match(room,/if\(c\.empty\)return '<div class="matrix-card-space"/);
 assert.match(solo,/if\(!c\|\|c\.empty\|\|c\.matched/);
 assert.match(room,/if\(!c\|\|c\.empty\|\|c\.matched/);
});
