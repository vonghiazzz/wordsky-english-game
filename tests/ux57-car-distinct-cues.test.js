import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,publicState,answerQuestion,carWordRequirements,MIN_CAR_STEP_MS} from '../lib/game.js';

const round={mode:'CAR',difficulty:'NORMAL',duration_seconds:90,question_count:3,car_step_seconds:8,points_per_correct:100,penalty:25};
const now=1000000;
const requirements=carWordRequirements(round);
const make=(tier,n=6)=>Array.from({length:n},(_,i)=>({
  id:tier+'-'+i,english:tier.toLowerCase()+'word'+i,
  meaning:'Nghĩa độc lập '+tier+' '+i,
  cefr_level:tier==='A2'?'A2':tier==='BONUS'?'B1':'C1'
}));
const createPools=()=>({A2:make('A2'),BONUS:make('BONUS'),DOUBLE:make('DOUBLE')});
const en=x=>String(x.english).normalize('NFKC').toLocaleLowerCase('en').trim();
const vi=x=>String(x.meaning).normalize('NFKC').toLocaleLowerCase('vi').trim();
const safe=state=>state.levels.flatMap(x=>x.lanes.filter(l=>l.kind!=='BLOCKED'));
test('UX57 CAR: all safe lanes keep unique Vietnamese cue and English answer across every stage',()=>{
 for(let k=0;k<20;k++){
  const pools=createPools();
  // Cross-tier collisions: the code must use a different candidate.
  pools.BONUS[0].english=pools.A2[0].english;
  pools.DOUBLE[0].meaning=pools.BONUS[1].meaning;
  const state=createState(round,pools,now);
  assert.equal(state.levels.length,3);
  const lanes=safe(state);
  assert.equal(lanes.length,Object.values(requirements).reduce((a,b)=>a+b,0));
  assert.equal(new Set(lanes.map(en)).size,lanes.length);
  assert.equal(new Set(lanes.map(vi)).size,lanes.length);
  for(const stage of state.levels){
   assert.equal(stage.lanes.length,5);
   assert.equal(stage.lanes.filter(l=>l.kind==='BLOCKED').length,2);
   assert.equal(stage.lanes.filter(l=>l.kind==='NORMAL').length,1);
   assert.equal(stage.lanes.filter(l=>l.kind==='BONUS').length,1);
   assert.equal(stage.lanes.filter(l=>l.kind==='DOUBLE').length,1);
  }
  const view=publicState(state,now);
  assert.ok(view.level.lanes.every(l=>!('english' in l)&&!('wordId' in l)));
 }
});
test('UX57 CAR: an eligible run with raw capacity but cross-tier duplicate English fails closed',()=>{
 const pools={A2:make('A2',3),BONUS:make('BONUS',3),DOUBLE:make('DOUBLE',3)};
 pools.BONUS[0].english=pools.A2[0].english;
 assert.throws(()=>createState(round,pools,now),error=>{
  assert.equal(error.status,400);
  assert.match(error.message,/Không đủ từ có gợi ý và đáp án riêng biệt/);
  return true;
 });
});
test('UX57 CAR: same Vietnamese cue across tiers fails closed with no false grade',()=>{
 const pools={A2:make('A2',3),BONUS:make('BONUS',3),DOUBLE:make('DOUBLE',3)};
 pools.DOUBLE[0].meaning=pools.A2[0].meaning;
 assert.throws(()=>createState(round,pools,now),/Không đủ từ có gợi ý và đáp án riêng biệt/);
});
test('UX57 CAR: safe answer still selects its own lane without exposing English',()=>{
 const state=createState(round,createPools(),now);
 const lane=state.levels[0].lanes.findIndex(l=>l.kind!=='BLOCKED');
 const answer=state.levels[0].lanes[lane].english;
 const result=answerQuestion(state,round,{auto:true,answer},now+MIN_CAR_STEP_MS);
 assert.equal(result.result.correct,true);
 assert.equal(state.correct,1);
 assert.deepEqual(state.wrongWordIds,[]);
});
