import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rankForXp, awardedAttendance, createState, answerQuestion, reconcile,
  publicState, normalizeRound, roundWindows, normalizeAnswer,
  requiredWords, assertWordCapacity, MIN_CAR_STEP_MS, carWordRequirements, carMissingWords,
} from '../lib/game.js';

const words = Array.from({ length: 20 }, (_, i) => ({
  id: `word-${i}`, english: `word${i}`, meaning: `Meaning ${i}`,
}));
const base = { difficulty: 'NORMAL', duration_seconds: 120, question_count: 5,
  points_per_correct: 100, penalty: 25, weight: 1 };

function carPools(round){
 const need=carWordRequirements(round);
 return Object.fromEntries(Object.entries(need).map(([tier,n])=>[tier,Array.from({length:n},(_,i)=>({
  id:`${tier}-${i}`,english:`${tier.toLowerCase()}word${i}`,meaning:`Nghĩa ${tier} ${i}`,
  cefr_level:tier==='A2'?'A2':tier==='BONUS'?'B1':'C1'
 }))]));
}
function indexOfKind(state,kind){return state.levels[state.index].lanes.findIndex(l=>l.kind===kind)}
const playRight = (s, index) => ({ leftId: s.pairs[index].id, rightId: s.pairs[index].rightId });

test('rank and attendance', () => {
  assert.equal(rankForXp(0), '\u0110\u1ed3ng');
  assert.equal(rankForXp(600), 'V\u00e0ng');
  assert.equal(awardedAttendance(1), 25);
  assert.equal(awardedAttendance(9), 55);
});

test('round config and time windows', () => {
  assert.throws(() => normalizeRound({ ...base, mode: 'MATCH', weight: 200 }));
  assert.throws(() => normalizeRound({ ...base, mode: 'MATCH', topic_id: null }));
  const windows = roundWindows('2026-10-20T00:00:00Z', [{ duration_seconds: 50 }, { duration_seconds: 90 }]);
  assert.equal(new Date(windows[1].ends_at) - new Date(windows[0].starts_at), 140000);
});

test('MATCH: server validates correct pair by a secret mapping, never a shared public ID', () => {
  const round = { ...base, mode: 'MATCH' };
  const state = createState(round, words, 1000000);
  const pub = publicState(state, 1000000);
  const leftIds = new Set(pub.pairs.map(p => p.id));
  const rightIds = new Set(pub.rightOptions.map(p => p.id));

  assert.equal(pub.rightOptions.length, round.question_count + 2);
  assert.equal(rightIds.size, pub.rightOptions.length);
  assert.ok(pub.pairs.every(p => !('meaning' in p) && !('rightId' in p)));
  assert.ok(pub.rightOptions.every(p => !('english' in p) && !leftIds.has(p.id)));
  assert.ok(!('distractors' in pub));
  assert.equal(pub.rightOptions.every((p, i, arr) => i === 0 || p.id > arr[i - 1].id), true);

  // A left ID can never be used as a right ID, even if it is the matching word.
  assert.throws(() => answerQuestion(state, round, {
    leftId: state.pairs[0].id, rightId: state.pairs[0].id,
  }, 1000100));

  const answer = answerQuestion(state, round, playRight(state, 0), 1000200);
  assert.equal(answer.result.correct, true);
  assert.equal(state.score, 100);
  assert.throws(() => answerQuestion(state, round, playRight(state, 0), 1000300));
  assert.ok(pub.pairs.every(p => !('meaning' in p)));
});

test('MATCH: wrong independent right choice loses points, distractor is not a valid match', () => {
  const round = { ...base, mode: 'MATCH', difficulty: 'HARD' };
  const state = createState(round, words, 1000000);
  const left = state.pairs[0];
  const other = state.pairs[1].rightId;
  const wrong = answerQuestion(state, round, { leftId: left.id, rightId: other }, 1000100);
  assert.equal(wrong.result.correct, false);
  assert.equal(state.mistakes, 1);
  assert.equal(state.pairs[0].matched, false);
  const distractor = state.distractors[0];
  answerQuestion(state, round, { leftId: left.id, rightId: distractor.rightId }, 1000200);
  assert.equal(state.mistakes, 2);
  assert.equal(answerQuestion(state, round, { leftId: left.id, rightId: left.rightId }, 1000300).result.correct, true);
});

test('BOMB: correct word scores, missed bombs lose health, public data hides English', () => {
  const round = { ...base, mode: 'BOMB' };
  const state = createState(round, words, 1000000);
  const bomb = state.bombs[0];
  assert.equal(answerQuestion(state, round, { bombId: bomb.id, answer: bomb.english.toUpperCase() }, 1000050).result.correct, true);
  assert.equal(state.score, 100);
  assert.ok(publicState(state, 1000050).bombs.every(b => !('english' in b)));
  const healthBefore = state.health;
  reconcile(state, round, 1020000);
  assert.ok(state.health < healthBefore);
});

test('CAR: each non-blocked lane gets independent meaning and approved CEFR tier',()=>{
 const round={...base,mode:'CAR',difficulty:'NORMAL'};
 const state=createState(round,carPools(round),1000000);
 const lanes=state.levels[0].lanes;
 assert.equal(lanes.length,5);
 assert.equal(lanes.filter(x=>x.kind==='BLOCKED').length,2);
 assert.equal(lanes.filter(x=>x.kind==='NORMAL').length,1);
 assert.equal(lanes.filter(x=>x.kind==='BONUS').length,1);
 assert.equal(lanes.filter(x=>x.kind==='DOUBLE').length,1);
 const pub=publicState(state,1000000).level.lanes;
 assert.ok(pub.every(x=>!('english' in x)));
 assert.ok(pub.find(x=>x.kind==='BLOCKED')&&!('meaning' in pub.find(x=>x.kind==='BLOCKED')));
 assert.ok(pub.find(x=>x.kind==='NORMAL').cefr==='A2');
 assert.ok(['B1','B2'].includes(pub.find(x=>x.kind==='BONUS').cefr));
 assert.ok(['C1','C2'].includes(pub.find(x=>x.kind==='DOUBLE').cefr));
 assert.equal(new Set(lanes.filter(x=>x.english).map(x=>x.english)).size,3);
});
test('CAR: reject early input even with correct answer',()=>{
 const round={...base,mode:'CAR'};const now=1000000;
 const state=createState(round,carPools(round),now);
 const lane=indexOfKind(state,'NORMAL');const answer=state.levels[0].lanes[lane].english;
 assert.equal(publicState(state,now).nextAllowedAt,now+MIN_CAR_STEP_MS);
 assert.throws(()=>answerQuestion(state,round,{lane,answer},now+MIN_CAR_STEP_MS-1),x=>x.status===409);
 assert.equal(state.index,0);
 assert.equal(answerQuestion(state,round,{lane,answer},now+MIN_CAR_STEP_MS).result.correct,true);
 assert.equal(state.index,1);
});
test('CAR: multiplier lane requires C1/C2 word and awards double points',()=>{
 const round={...base,mode:'CAR',difficulty:'HARD'};
 const state=createState(round,carPools(round),1000000);
 const lane=indexOfKind(state,'DOUBLE');
 const result=answerQuestion(state,round,{lane,answer:state.levels[0].lanes[lane].english},1000000+MIN_CAR_STEP_MS);
 assert.equal(result.result.awarded,200);assert.equal(result.result.multiplier,2);
});
test('CAR: wrong word or missing answer cannot advance',()=>{
 const round={...base,mode:'CAR'};const state=createState(round,carPools(round),1000000);
 const lane=indexOfKind(state,'DOUBLE');
 assert.throws(()=>answerQuestion(state,round,{lane},1000000+MIN_CAR_STEP_MS),x=>x.status===400);
 const result=answerQuestion(state,round,{lane,answer:'incorrect'},1000000+MIN_CAR_STEP_MS);
 assert.equal(result.result.wordCorrect,false);assert.equal(state.index,0);
 assert.equal(state.health,3);
 const good=answerQuestion(state,round,{lane,answer:state.levels[0].lanes[lane].english},1000000+MIN_CAR_STEP_MS);
 assert.equal(good.result.correct,true);assert.equal(state.index,1);
});
test('CAR: obstacles do not require an answer and cost a heart',()=>{
 const round={...base,mode:'CAR'};const state=createState(round,carPools(round),1000000);
 const blocked=indexOfKind(state,'BLOCKED');
 const result=answerQuestion(state,round,{lane:blocked},1000000+MIN_CAR_STEP_MS);
 assert.equal(result.result.laneSafe,false);assert.equal(result.result.wordCorrect,null);
 assert.equal(state.health,2);assert.equal(state.index,1);
});
test('CAR: every stage has unique words within each CEFR tier',()=>{
 const round={...base,mode:'CAR',difficulty:'EASY',question_count:8};
 const state=createState(round,carPools(round),1000000);
 const en=state.levels.flatMap(level=>level.lanes.map(x=>x.english).filter(Boolean));
 assert.equal(en.length,8*4);assert.equal(new Set(en).size,en.length);
 assert.equal(carWordRequirements(round).A2,16);
});
test('CAR: cannot speedrun 8 stages with early input',()=>{
 const round={...base,mode:'CAR',question_count:8};const state=createState(round,carPools(round),1000000);
 for(let i=0;i<8;i++){
  const lane=indexOfKind(state,'DOUBLE');
  assert.throws(()=>answerQuestion(state,round,{lane,answer:state.levels[0].lanes[lane].english},1000000+i+1),x=>x.status===409);
 }
 assert.equal(state.index,0);assert.equal(state.score,0);
});
test('CAR: rejected if the reviewed tier stock is insufficient, no fallback to easy words',()=>{
 const round={...base,mode:'CAR'};const pool=carPools(round);pool.DOUBLE.pop();
 assert.ok(carMissingWords(round,pool).some(x=>x.includes('C1')));
 assert.throws(()=>createState(round,pool,1000000),/Chưa đủ từ đã duyệt/);
});
test('MATCH and BOMB vocabulary capacity must cover all choices and distractors', () => {
  const normal = { ...base, mode: 'MATCH', question_count: 8, difficulty: 'NORMAL' };
  const hard = { ...normal, difficulty: 'HARD' };
  const easy = { ...normal, difficulty: 'EASY' };
  assert.equal(requiredWords(normal), 10);
  assert.equal(requiredWords(hard), 12);
  assert.equal(requiredWords(easy), 8);
  assert.equal(requiredWords({ ...base, mode: 'BOMB', question_count: 10 }), 10);
  assert.equal(requiredWords({ ...base, mode: 'CAR', question_count: 30 }), 90);
  assert.throws(() => assertWordCapacity(hard, 10), e => e.status === 400);
  assert.throws(() => createState(hard, words.slice(0, 10), 1000), e => e.status === 400);
  assert.equal(createState(normal, words.slice(0, 10), 1000).distractors.length, 2);
  assert.equal(createState({ ...hard, question_count: 6 }, words.slice(0, 10), 1000).distractors.length, 4);
  assert.throws(() => createState({ ...base, mode: 'BOMB', question_count: 11 }, words.slice(0, 10), 1000), e => e.status === 400);
});

test('normalization blocks excessive BOM input', () => {
  assert.equal(normalizeAnswer(' WoRD-12 '), 'word 12');
  const round = { ...base, mode: 'BOMB' };
  const state = createState(round, words, 1000000);
  assert.throws(() => answerQuestion(state, round, { bombId: state.bombs[0].id, answer: 'x'.repeat(120) }, 1000010));
});

test('BOMB public falling card has timing but never English answer',()=>{
 const round={...base,mode:'BOMB'};
 const st=createState(round,words,1000000);
 const bomb=publicState(st,1000000).bombs[0];
 assert.equal(typeof bomb.spawnAt,'number');
 assert.equal(typeof bomb.deadline,'number');
 assert.equal('english' in bomb,false);
});

test('CAR: selected lane is not real car position until server validates answer',()=>{
 const round={...base,mode:'CAR',question_count:4};const start=1000000;
 const st=createState(round,carPools(round),start);
 assert.equal(st.carLane,2);
 const destination=indexOfKind(st,'DOUBLE'),word=st.levels[0].lanes[destination].english;
 const publicBefore=publicState(st,start);
 assert.equal(publicBefore.carLane,2);
 assert.equal('english' in publicBefore.level.lanes[destination],false);
 const bad=answerQuestion(st,round,{lane:destination,answer:'wrong'},start+MIN_CAR_STEP_MS);
 assert.equal(bad.result.wordCorrect,false);assert.equal(publicState(st,start+MIN_CAR_STEP_MS).carLane,2);
 assert.equal(st.index,0);
 const ok=answerQuestion(st,round,{lane:destination,answer:word},start+MIN_CAR_STEP_MS);
 assert.equal(ok.result.laneFrom,2);assert.equal(ok.result.laneTo,destination);
 assert.equal(publicState(st,start+MIN_CAR_STEP_MS).carLane,destination);
 assert.equal(st.index,1);
 const blocked=indexOfKind(st,'BLOCKED');
 const boom=answerQuestion(st,round,{lane:blocked},start+2*MIN_CAR_STEP_MS);
 assert.equal(boom.result.laneSafe,false);
 assert.equal(boom.result.laneFrom,destination);assert.equal(boom.result.laneTo,destination);
 assert.equal(publicState(st,start+2*MIN_CAR_STEP_MS).carLane,destination);
});
