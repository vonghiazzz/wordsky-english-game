/* UX57 P0: validate maximum matching, not raw row counts or greedy ordering.
 * Synthetic, no DB, no user progress/CEFR/content changes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,selectDistinctCueCards,requiredWords,publicState} from '../lib/game.js';

const hard=[
 {id:'a-x',english:'A',meaning:'x'},
 {id:'a-y',english:'A',meaning:'y'},
 {id:'b-x',english:'B',meaning:'x'},
 {id:'c-z',english:'C',meaning:'z'},
];
const distinct=(cards)=>{
 assert.equal(new Set(cards.map(w=>w.english.toLowerCase())).size,cards.length);
 assert.equal(new Set(cards.map(w=>w.meaning.toLowerCase())).size,cards.length);
};
const round=(mode,n)=>({mode,difficulty:'EASY',question_count:n,
 duration_seconds:120,points_per_correct:100,penalty:25,weight:1});

test('UX57: augmenting path avoids false 400 when greedy picks A-x before B-x',()=>{
 for(let i=0;i<140;i++){
  const chosen=selectDistinctCueCards(hard,3);
  assert.deepEqual(chosen.map(x=>x.id).sort(),['a-y','b-x','c-z']);
  distinct(chosen);
 }
});

test('UX57: correct card IDs survive into MATCH and BOMB public game rounds',()=>{
 for(const mode of ['MATCH','BOMB']){
  for(let i=0;i<65;i++){
   const state=createState(round(mode,3),hard,100000);
   const chosen=mode==='MATCH'?state.pairs:state.bombs;
   assert.deepEqual(chosen.map(w=>mode==='BOMB'?w.wordId:w.id).sort(),['a-y','b-x','c-z']);
   distinct(chosen);
   const visible=publicState(state,100000);
   if(mode==='MATCH')assert.equal(visible.rightOptions.length,3);
   else assert.ok(visible.bombs.every(x=>!('english' in x)));
  }
 }
});

test('UX57: large chain of competing cues still finds 30 unique playable pairs',()=>{
 // A 30-word chain needs reassignments, not just local first-fit.
 const chain=[];
 for(let i=0;i<30;i++){
  chain.push({id:'straight-'+i,english:'word'+i,meaning:'cue'+i});
  if(i<29)chain.push({id:'next-'+i,english:'word'+i,meaning:'cue'+(i+1)});
 }
 for(let i=0;i<30;i++){
  const chosen=selectDistinctCueCards(chain,30);
  assert.equal(chosen.length,30);
  distinct(chosen);
 }
});

test('UX57: genuinely underdetermined vocab still fails closed with existing HTTP 400',()=>{
 const blocked=[
  {id:'a-x',english:'A',meaning:'x'},
  {id:'b-x',english:'B',meaning:'x'},
  {id:'a-y',english:'A',meaning:'y'},
  {id:'a-x-repeat',english:' A ',meaning:'X '},
 ];
 for(let i=0;i<18;i++){
  assert.throws(()=>selectDistinctCueCards(blocked,3),
   err=>err?.status===400&&/gợi ý tiếng Việt riêng biệt/.test(err.message));
 }
 assert.deepEqual(selectDistinctCueCards(blocked,0),[]);
 assert.throws(()=>selectDistinctCueCards(null,1),
  err=>err?.status===400);
});

test('UX57: MATRIX and MEMORY keep unique public tiles when cue assignments overlap',()=>{
 const vocab=[...hard];
 for(let i=0;i<5;i++)vocab.push({id:'extra-'+i,english:'E'+i,meaning:'extra'+i});
 for(const mode of ['MATRIX','MEMORY']){
  const r=round(mode,8);
  assert.equal(requiredWords(r),8);
  const state=createState(r,vocab,100000);
  assert.equal(state.pairs.length,8);
  distinct(state.pairs);
  assert.equal(state.cards.filter(c=>!c.empty).length,16);
 }
});

test('UX57: scalable synthetic shared vocabulary yields distinct 30 cards',()=>{
 const vocab=Array.from({length:2379},(_,i)=>({
  id:'v'+i,english:'w'+i,meaning:'nghĩa riêng '+i
 }));
 const selected=selectDistinctCueCards(vocab,30);
 assert.equal(selected.length,30);
 distinct(selected);
});