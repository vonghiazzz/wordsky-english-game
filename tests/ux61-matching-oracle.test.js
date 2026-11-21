/* UX61: deterministic independent oracle for ambiguous vocabulary cue selection.
 * Pure synthetic fixtures; no account, network or database access.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {selectDistinctCueCards} from '../lib/game.js';

const key=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
function oracleCapacity(words){
 const graph=new Map();
 for(const word of words){
  const en=key(word.english),vi=key(word.meaning);
  if(!en||!vi)continue;
  if(!graph.has(en))graph.set(en,new Set());
  graph.get(en).add(vi);
 }
 const edges=[...graph.values()].map(s=>[...s]);
 function solve(index,used){
  if(index===edges.length)return 0;
  let best=solve(index+1,used);
  for(const vi of edges[index]){
   if(used.has(vi))continue;
   used.add(vi);
   best=Math.max(best,1+solve(index+1,used));
   used.delete(vi);
  }
  return best;
 }
 return solve(0,new Set());
}
let seed=0x61C0FFEE;
function random(limit){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 return seed%limit;
}

test('UX61 oracle: 180 synthetic collision graphs match independent optimum',()=>{
 for(let trial=0;trial<180;trial++){
  const englishCount=1+random(5),meaningCount=1+random(5);
  const words=[];
  for(let en=0;en<englishCount;en++){
   for(let vi=0;vi<meaningCount;vi++){
    if(random(4)===0)continue;
    const english=en%2===0?'Word '+en:'Ｗｏｒｄ '+en;
    const meaning=vi%2===0?'Gợi ý '+vi:'Ｇợi ý '+vi;
    words.push({id:'card-'+trial+'-'+en+'-'+vi,english,meaning});
   }
  }
  const optimum=oracleCapacity(words);
  const originalIds=new Set(words.map(w=>w.id));
  for(let requested=0;requested<=Math.min(englishCount,meaningCount);requested++){
   if(requested<=optimum){
    const selected=selectDistinctCueCards(words,requested);
    assert.equal(selected.length,requested,'trial '+trial+', n '+requested);
    assert.equal(new Set(selected.map(w=>key(w.english))).size,requested);
    assert.equal(new Set(selected.map(w=>key(w.meaning))).size,requested);
    assert.ok(selected.every(w=>originalIds.has(w.id)));
   }else{
    assert.throws(()=>selectDistinctCueCards(words,requested),err=>err?.status===400,
     'trial '+trial+', n '+requested+', optimum '+optimum);
   }
  }
 }
});

test('UX61 oracle: Unicode-normalized collisions never duplicate an English answer or cue',()=>{
 const cards=[
  {id:'1',english:'Ａ',meaning:'Một'},
  {id:'2',english:'A',meaning:'Hai'},
  {id:'3',english:'B',meaning:'  MỘT  '},
  {id:'4',english:'C',meaning:'Ba'},
 ];
 const capacity=oracleCapacity(cards);
 assert.equal(capacity,3);
 for(let i=0;i<30;i++){
  const picked=selectDistinctCueCards(cards,capacity);
  assert.equal(new Set(picked.map(w=>key(w.english))).size,capacity);
  assert.equal(new Set(picked.map(w=>key(w.meaning))).size,capacity);
 }
 assert.throws(()=>selectDistinctCueCards(cards,4),err=>err?.status===400);
});
