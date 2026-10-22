import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,answerQuestion,reconcile,normalizeRound,publicState,carWordRequirements} from '../lib/game.js';
const topic='33333333-3333-4333-8333-333333333333';
const words=Array.from({length:30},(_,i)=>({id:'word'+i,english:'word'+i,meaning:'Meaning '+i}));
const base={difficulty:'NORMAL',duration_seconds:120,question_count:6,points_per_correct:100,penalty:25,weight:1,topic_id:topic};
function pools(round){const need=carWordRequirements(round);return Object.fromEntries(Object.entries(need).map(([k,n])=>[k,Array.from({length:n},(_,i)=>({id:k+i,english:k+'word'+i,meaning:k+' meaning '+i,cefr_level:k==='A2'?'A1':k==='BONUS'?'B1':'C1'}))]));}
test('wrong MATCH choices consume hearts, third mistake fails the round',()=>{
 const round=normalizeRound({...base,mode:'MATCH'});
 const state=createState(round,words,100000);
 const left=state.pairs[0].id, wrong=state.pairs[1].rightId;
 for(let i=1;i<=3;i++){
  const {result}=answerQuestion(state,round,{leftId:left,rightId:wrong},100000+i);
  assert.equal(result.correct,false);
  assert.equal(state.health,3-i);
 }
 assert.equal(state.status,'FAILED');
 assert.equal(state.mistakes,3);
 assert.throws(()=>answerQuestion(state,round,{leftId:left,rightId:state.pairs[0].rightId},100100),/kết thúc/);
});
test('BOMB honors simultaneous batch, cadence, lifetime and hidden answers',()=>{
 const round=normalizeRound({...base,mode:'BOMB',question_count:6,bomb_fall_seconds:18,bomb_batch_size:3,bomb_spawn_interval_seconds:12});
 const state=createState(round,words,100000);
 assert.equal(state.bombs[0].spawnAt,100000);
 assert.equal(state.bombs[1].spawnAt,100000);
 assert.equal(state.bombs[2].spawnAt,100000);
 assert.equal(state.bombs[3].spawnAt,112000);
 assert.equal(state.bombs[0].deadline,118000);
 assert.deepEqual(state.bombs.slice(0,3).map(x=>x.slot),[0,1,2]);
 const p=publicState(state,100000);
 assert.equal(p.bombs.length,3);
 assert.ok(p.bombs.every(b=>typeof b.slot==='number'&&!('english' in b)));
 reconcile(state,round,118001);
 assert.equal(state.health,0);
 assert.equal(state.status,'FAILED');
});
test('settings validations block impossible timed rounds',()=>{
 assert.throws(()=>normalizeRound({...base,mode:'BOMB',duration_seconds:30,question_count:10,bomb_batch_size:1,bomb_fall_seconds:18,bomb_spawn_interval_seconds:12}),/không đủ/);
 assert.throws(()=>normalizeRound({...base,mode:'BOMB',bomb_batch_size:9}),/1–3/);
 assert.throws(()=>normalizeRound({...base,mode:'CAR',question_count:8,duration_seconds:40,car_step_seconds:8}),/số chặng/);
 assert.throws(()=>normalizeRound({...base,mode:'CAR',car_step_seconds:1}),/2 đến 45/);
});
test('CAR uses independently configured step deadlines and times out one step',()=>{
 const round=normalizeRound({...base,mode:'CAR',question_count:6,car_step_seconds:5});
 const now=100000;
 const state=createState(round,pools(round),now);
 assert.equal(state.stepDurationMs,5000);
 assert.equal(publicState(state,now).stepDeadlineAt,now+5000);
 reconcile(state,round,now+4999);
 // Correct signature is reconcile(state,round,now); ensure no mutation before deadline.
 assert.equal(state.index,0);
 reconcile(state,round,now+5001);
 assert.equal(state.index,1);
 assert.equal(state.health,2);
 assert.equal(publicState(state,now+5001).stepDeadlineAt,now+10000);
});
