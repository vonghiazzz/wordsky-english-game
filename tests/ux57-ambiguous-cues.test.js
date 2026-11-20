/* UX57 P0: synthetic bilingual-cue collisions only; no vocabulary edits or DB.
 * A Vietnamese clue must never identify two different English answers in
 * one server-generated round, even when raw row capacity looks sufficient.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createState,publicState,requiredWords,carMissingWords,selectDistinctCueCards,
} from '../lib/game.js';

const NOW=1_000_000;
const key=value=>String(value).normalize('NFKC').trim()
 .replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const conflicts=[
 {id:'five',english:'five',meaning:'năm'},
 {id:'year',english:'year',meaning:' NĂM  '},
 {id:'assess',english:'assess',meaning:'đánh giá'},
 {id:'evaluate',english:'evaluate',meaning:'ĐÁNH   GIÁ'},
 {id:'significant',english:'significant',meaning:'đáng kể'},
 {id:'substantial',english:'substantial',meaning:'đáng   kể'},
 {id:'habitat-animals',english:'habitat',meaning:'môi trường sống'},
 {id:'habitat-nature',english:'habitat',meaning:'sinh cảnh'},
];
const distinct=Array.from({length:24},(_,i)=>({
 id:'unique-'+i,english:'unique'+i,meaning:'nghĩa riêng '+i,
}));
const words=[...conflicts,...distinct];
const base={difficulty:'NORMAL',duration_seconds:120,question_count:5,
 points_per_correct:100,penalty:25,weight:1};
const allUnique=(labels,field)=>{
 assert.equal(new Set(labels.map(key)).size,labels.length,
  'Duplicate '+field+' visible in a single round: '+JSON.stringify(labels));
};
const sameEnglish=(labels)=>allUnique(labels,'English answers');
const sameVietnamese=(labels)=>allUnique(labels,'Vietnamese clues');

test('UX57: collision selection distinguishes năm, đánh giá, đáng kể and repeated habitat',()=>{
 const selected=selectDistinctCueCards(words,18);
 assert.equal(selected.length,18);
 sameEnglish(selected.map(x=>x.english));
 sameVietnamese(selected.map(x=>x.meaning));
 // No dictionary/CEFR correction is implied by excluding a collision.
 assert.equal(conflicts.length,8);
});

for(const mode of ['MATCH','MATRIX','MEMORY','BOMB']){
 test('UX57: '+mode+' never exposes conflicting Vietnamese clues or English answers',()=>{
  const round={...base,mode,
   question_count:['MATRIX','MEMORY'].includes(mode)?8:5,
   difficulty:mode==='MATCH'?'HARD':'NORMAL'};
  const state=createState(round,words,NOW);
  const selected=mode==='BOMB'?state.bombs:state.pairs;
  assert.equal(selected.length,round.question_count);
  sameEnglish(selected.map(x=>x.english));
  sameVietnamese(selected.map(x=>x.meaning));
  if(mode==='MATCH'){
   // HARD adds four visible distractors; they must be unambiguous too.
   const allMeanings=[
    ...state.pairs.map(x=>x.meaning),
    ...state.distractors.map(x=>x.meaning),
   ];
   assert.equal(allMeanings.length,requiredWords(round));
   sameVietnamese(allMeanings);
   const publicChoices=publicState(state,NOW).rightOptions;
   assert.equal(publicChoices.length,requiredWords(round));
   sameVietnamese(publicChoices.map(x=>x.meaning));
  }
  if(['MATRIX','MEMORY'].includes(mode)){
   const visible=state.cards.filter(x=>!x.empty);
   assert.equal(visible.length,round.question_count*2);
   sameVietnamese(visible.filter(x=>x.lang==='vi').map(x=>x.label));
   sameEnglish(visible.filter(x=>x.lang==='en').map(x=>x.label));
  }
  if(mode==='BOMB'){
   const active=publicState(state,NOW).bombs;
   sameVietnamese(active.map(x=>x.meaning));
   assert.ok(active.every(x=>!('english' in x)),
    'Bomb API must not leak English answers');
  }
 });
}

for(const mode of ['MATCH','MATRIX','MEMORY','BOMB']){
 test('UX57: '+mode+' refuses enough raw rows but too few unique cues with HTTP 400',()=>{
  const round={...base,mode,difficulty:'EASY',
   question_count:['MATRIX','MEMORY'].includes(mode)?8:5};
  assert.ok(conflicts.length>=requiredWords(round),
   'Fixture must pass naive row-count capacity check');
  assert.throws(()=>createState(round,conflicts,NOW),
   error=>error?.status===400&&/gợi ý tiếng Việt riêng biệt/.test(error.message));
 });
}

const tierCards=(tier,count)=>Array.from({length:count},(_,i)=>({
 id:tier+'-'+i,english:tier.toLowerCase()+'word'+i,
 meaning:'nghĩa '+tier+' '+i,
 cefr_level:tier==='A2'?'A2':tier==='BONUS'?'B1':'C1',
}));
test('UX57: CAR selects non-colliding English/VI lanes across all CEFR tiers and stages',()=>{
 const round={...base,mode:'CAR',difficulty:'NORMAL'};
 const pools={A2:tierCards('A2',8),
  BONUS:tierCards('BONUS',8),DOUBLE:tierCards('DOUBLE',8)};
 pools.A2[0]={...pools.A2[0],english:'five',meaning:'năm'};
 pools.BONUS[0]={...pools.BONUS[0],english:'year',meaning:'  NĂM  '};
 pools.A2[1]={...pools.A2[1],english:'habitat',meaning:'môi trường sống'};
 pools.DOUBLE[0]={...pools.DOUBLE[0],english:'habitat',meaning:'sinh cảnh'};
 const state=createState(round,pools,NOW);
 const valid=state.levels.flatMap(level=>level.lanes
  .filter(lane=>lane.kind!=='BLOCKED'));
 assert.equal(valid.length,round.question_count*3);
 sameEnglish(valid.map(x=>x.english));
 sameVietnamese(valid.map(x=>x.meaning));
 const publicFirst=publicState(state,NOW).level.lanes;
 assert.ok(publicFirst.every(lane=>!('english' in lane)));
});

test('UX57: CAR fails closed on cross-stage cue collisions despite enough CEFR rows',()=>{
 const round={...base,mode:'CAR',difficulty:'NORMAL'};
 const pools={A2:tierCards('A2',5),
  BONUS:tierCards('BONUS',5),DOUBLE:tierCards('DOUBLE',5)};
 pools.A2=pools.A2.map(card=>({...card,meaning:'năm'}));
 assert.deepEqual(carMissingWords(round,pools),[],
  'Failure must be semantic uniqueness, not tier row capacity');
 assert.throws(()=>createState(round,pools,NOW),
  error=>error?.status===400&&/gợi ý và đáp án riêng biệt/.test(error.message));
});
