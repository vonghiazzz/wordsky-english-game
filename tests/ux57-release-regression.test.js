import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,publicState,answerQuestion} from '../lib/game.js';

// All entries are published PUBLIC shared-vocabulary fields; no UUIDs or user histories.
const candidates=JSON.parse(readFileSync(
 new URL('./fixtures/ux57-public-cue-review.json',import.meta.url),'utf8'
)).cards.map((card,i)=>({
 id:'candidate-'+i,english:card.english,meaning:card.meaning
}));
const extra=Array.from({length:36},(_,i)=>({
 id:'unique-'+i,english:'uniqueword'+i,meaning:'nghia rieng '+i
}));
const uniqueKey=value=>String(value).normalize('NFKC').trim()
 .replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const assertUnique=(rows,key,label)=>{
 assert.equal(new Set(rows.map(row=>uniqueKey(row[key]))).size,rows.length,label);
};
const makeRound=(mode,question_count,difficulty='EASY')=>({
 mode,difficulty,question_count,duration_seconds:240,
 points_per_correct:100,penalty:25,
 bomb_batch_size:2,bomb_fall_seconds:20,bomb_spawn_interval_seconds:10
});
const now=1000000;

for(const mode of ['MATCH','MATRIX','MEMORY','BOMB']){
 test('UX57 release: '+mode+' uses distinct cues across an entire round',()=>{
  const count=mode==='MATRIX'||mode==='MEMORY'?8:5;
  const round=makeRound(mode,count,mode==='MATCH'?'HARD':'EASY');
  for(let run=0;run<12;run++){
   const state=createState(round,[...candidates,...extra],now);
   const chosen=mode==='BOMB'?state.bombs:state.pairs;
   assert.equal(chosen.length,count);
   assertUnique(chosen,'meaning','Vietnamese duplicate in '+mode);
   assertUnique(chosen,'english','English duplicate in '+mode);
   const visible=publicState(state,now);
   assert.equal(visible.mode,mode);
   if(mode==='MATCH'){
    // Distractors must be unique relative to chosen pairs, too.
    const all=[...state.pairs,...state.distractors];
    assert.equal(all.length,count+4);
    assertUnique(all,'meaning','MATCH right option collision');
    assert.equal(visible.rightOptions.length,count+4);
    assert.ok(visible.pairs.every(row=>!('meaning' in row)));
    const first=state.pairs[0];
    const ok=answerQuestion(state,round,{leftId:first.id,rightId:first.rightId},now+50);
    assert.equal(ok.result.correct,true);
    assert.deepEqual(state.wrongWordIds,[]);
   }
   if(mode==='MATRIX'){
    assert.equal(visible.cards.filter(c=>!c.empty).length,16);
    assert.ok(visible.cards.every(c=>!('word_id' in c)));
   }
   if(mode==='MEMORY'){
    assert.equal(visible.cards.filter(c=>!c.empty).length,16);
    assert.ok(visible.cards.every(c=>!('label' in c)&&!('lang' in c)));
   }
   if(mode==='BOMB'){
    assert.ok(visible.bombs.length>0);
    assert.ok(visible.bombs.every(b=>!('english' in b)));
   }
  }
 });
}

for(const mode of ['MATCH','MATRIX','MEMORY','BOMB']){
 test('UX57 release: '+mode+' fails closed on adequate raw count but colliding cues',()=>{
  const count=mode==='MATRIX'||mode==='MEMORY'?8:3;
  const round=makeRound(mode,count,'EASY');
  // Raw capacity is at least count, but these public cards contain
  // one repeated English headword and three shared Vietnamese cues.
  const limited=mode==='MATRIX'||mode==='MEMORY'
    ?candidates
    :candidates.slice(0,4);
  assert.ok(limited.length>=count);
  assert.throws(()=>createState(round,limited,now),error=>{
   assert.equal(error.status,400);
   assert.match(error.message,/Không đủ từ có gợi ý tiếng Việt riêng biệt/);
   return true;
  });
  // A rejected candidate pool must not poison later independent rounds.
  const valid=createState(round,extra,now);
  assert.equal(valid.score,0);
  assert.equal(valid.mistakes,0);
  assert.deepEqual(valid.wrongWordIds,[]);
 });
}

test('UX57 release: matching near-identical cues remain distinguishable',()=>{
 const pool=[
  {id:'1',english:'five',meaning:'Năm'},
  {id:'2',english:'year',meaning:' năm '},
  {id:'3',english:'assess',meaning:'đánh giá'},
  {id:'4',english:'evaluate',meaning:'ĐÁNH GIÁ'},
  ...extra
 ];
 const round=makeRound('MATCH',5,'NORMAL');
 const state=createState(round,pool,now);
 const meanings=[...state.pairs,...state.distractors].map(x=>uniqueKey(x.meaning));
 assert.equal(new Set(meanings).size,meanings.length);
 assert.equal(new Set(state.pairs.map(x=>uniqueKey(x.english))).size,5);
});
