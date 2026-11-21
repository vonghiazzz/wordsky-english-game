/* UX61.2 five-mode gameplay regression; synthetic input, no DB/network/accounts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,publicState,requiredWords} from '../lib/game.js';

const NOW=1000000;
const key=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const base={difficulty:'NORMAL',duration_seconds:120,question_count:3,
 points_per_correct:100,penalty:25,weight:1};
const ambiguous=[
 {id:'five',english:'five',meaning:'năm'},
 {id:'year',english:'year',meaning:' NĂM '},
 {id:'assess',english:'assess',meaning:'đánh giá'},
 {id:'evaluate',english:'evaluate',meaning:'ĐÁNH GIÁ'},
 {id:'significant',english:'significant',meaning:'đáng kể'},
 {id:'substantial',english:'substantial',meaning:'ĐÁNG KỂ'},
 {id:'habitat-a',english:'habitat',meaning:'môi trường sống'},
 {id:'habitat-b',english:'habitat',meaning:'sinh cảnh'},
];
const extra=Array.from({length:24},(_,i)=>({
 id:'extra-'+i,english:'word'+i,meaning:'nghĩa riêng '+i,
}));
function unique(values,label){
 assert.equal(new Set(values.map(key)).size,values.length,label);
}
for(const mode of ['MATCH','BOMB','MATRIX','MEMORY']){
 test('UX61.2 '+mode+' repeated ambiguous real-cue fixture has distinct choices and no exposed answers',()=>{
  const round={...base,mode,question_count:['MATRIX','MEMORY'].includes(mode)?8:3,
   difficulty:mode==='MATCH'?'HARD':'NORMAL'};
  const vocab=[...ambiguous,...extra];
  for(let iteration=0;iteration<35;iteration++){
   const state=createState(round,vocab,NOW);
   const cards=mode==='BOMB'?state.bombs:state.pairs;
   assert.equal(cards.length,round.question_count);
   unique(cards.map(c=>c.english),'English '+mode);
   unique(cards.map(c=>c.meaning),'Vietnamese '+mode);
   const visible=publicState(state,NOW);
   if(mode==='MATCH'){
    assert.equal(visible.rightOptions.length,requiredWords(round));
    unique(visible.rightOptions.map(c=>c.meaning),'MATCH distractors');
    assert.ok(visible.pairs.every(c=>!('meaning' in c)&&!('rightId' in c)));
    assert.ok(visible.rightOptions.every(c=>!('english' in c)));
   }else if(mode==='BOMB'){
    assert.ok(visible.bombs.every(c=>!('english' in c)));
   }else{
    assert.equal(state.cards.filter(c=>!c.empty).length,16);
    unique(state.cards.filter(c=>c.lang==='en').map(c=>c.label),'grid English');
    unique(state.cards.filter(c=>c.lang==='vi').map(c=>c.label),'grid Vietnamese');
   }
  }
 });
}
function tier(prefix,count,level){
 return Array.from({length:count},(_,i)=>({
  id:prefix+'-'+i,english:prefix+'english'+i,meaning:prefix+'nghĩa'+i,cefr_level:level,
 }));
}
test('UX61.2 CAR repeated normal stages avoid ambiguous cross-tier cues without leaking answers',()=>{
 const round={...base,mode:'CAR',difficulty:'NORMAL'};
 for(let iteration=0;iteration<35;iteration++){
  const pools={A2:tier('a2',5,'A2'),BONUS:tier('bonus',5,'B1'),DOUBLE:tier('double',5,'C1')};
  pools.A2[0]={...pools.A2[0],english:'five',meaning:'năm'};
  pools.BONUS[0]={...pools.BONUS[0],english:'year',meaning:' NĂM '};
  pools.A2[1]={...pools.A2[1],english:'habitat',meaning:'môi trường sống'};
  pools.DOUBLE[0]={...pools.DOUBLE[0],english:'habitat',meaning:'sinh cảnh'};
  const state=createState(round,pools,NOW);
  const lanes=state.levels.flatMap(s=>s.lanes.filter(l=>l.kind!=='BLOCKED'));
  assert.equal(lanes.length,9);
  unique(lanes.map(l=>l.english),'CAR English');
  unique(lanes.map(l=>l.meaning),'CAR Vietnamese');
  assert.ok(publicState(state,NOW).level.lanes.every(l=>!('english' in l)));
 }
});
