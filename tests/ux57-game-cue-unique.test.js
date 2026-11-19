import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,publicState,selectDistinctCueCards,answerQuestion} from '../lib/game.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/ux57-public-cue-review.json',import.meta.url),'utf8')).cards;
const seed=fixture.map((x,i)=>({id:'review-'+i,english:x.english,meaning:x.meaning}));
const fillers=Array.from({length:30},(_,i)=>({id:'extra-'+i,english:'unique'+i,meaning:'nghĩa độc lập '+i}));
const pool=[...seed,...fillers];
const key=value=>String(value).normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const unique=cards=>{
 assert.equal(new Set(cards.map(w=>key(w.english))).size,cards.length,'English duplicated');
 assert.equal(new Set(cards.map(w=>key(w.meaning))).size,cards.length,'Vietnamese cue duplicated');
};
const base={difficulty:'NORMAL',duration_seconds:180,question_count:5,points_per_correct:100,penalty:25,bomb_batch_size:2,bomb_fall_seconds:20,bomb_spawn_interval_seconds:10};

test('UX57 selector rejects repeated Vietnamese prompts and repeated headwords',()=>{
 for(let i=0;i<20;i++){
  const chosen=selectDistinctCueCards(seed,4);
  unique(chosen);
 }
 assert.throws(()=>selectDistinctCueCards(seed,6),/Không đủ từ có gợi ý/);
 assert.throws(()=>selectDistinctCueCards([seed[0],seed[1]],2),/Không đủ từ có gợi ý/);
 assert.throws(()=>selectDistinctCueCards(null,2),/Kho từ/);
 assert.deepEqual(selectDistinctCueCards([],0),[]);
});

test('UX57 MATCH keeps every answer and distractor cue distinct',()=>{
 for(let i=0;i<10;i++){
  const round={...base,mode:'MATCH'};
  const state=createState(round,pool,1000000);
  const cues=[...state.pairs,...state.distractors];
  unique(cues.map(c=>({english:c.english??'unused-'+c.rightId,meaning:c.meaning})));
  assert.equal(cues.length,7);
  const pub=publicState(state,1000000);
  assert.ok(pub.pairs.every(p=>!('meaning' in p)));
  assert.equal(new Set(pub.rightOptions.map(x=>key(x.meaning))).size,7);
  assert.equal(answerQuestion(state,round,{leftId:state.pairs[0].id,rightId:state.pairs[0].rightId},1000100).result.correct,true);
 }
});

for(const mode of ['MATRIX','MEMORY','BOMB']){
 test('UX57 '+mode+' does not render repeated Vietnamese or English cues',()=>{
  const n=mode==='BOMB'?5:8;
  const round={...base,mode,question_count:n};
  for(let i=0;i<10;i++){
   const state=createState(round,pool,1000000);
   const chosen=mode==='BOMB'?state.bombs:state.pairs;
   unique(chosen);
   const view=publicState(state,1000000);
   assert.equal(view.mode,mode);
   if(mode==='BOMB')assert.ok(view.bombs.every(x=>!('english' in x)));
  }
 });
}

test('UX57 insufficient distinct cues fail before a round can start, no scoring/SRS change',()=>{
 const round={...base,mode:'BOMB',question_count:5};
 assert.throws(()=>createState(round,seed,1000000),/Không đủ từ có gợi ý/);
 const state=createState(round,pool,1000000);
 assert.deepEqual(state.wrongWordIds,[]);
 assert.equal(state.score,0);
 assert.equal(state.mistakes,0);
});
