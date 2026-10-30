import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,answerQuestion,publicState,normalizeRound} from '../lib/game.js';
import {validWrongWordIds} from '../lib/game-mistakes.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const vocabulary=Array.from({length:18},(_,i)=>({
 id:'77777777-7777-4777-8777-'+String(i).padStart(12,'0'),
 english:'english'+i,meaning:'nghia '+i,cefr_level:'A2'
}));
const round=mode=>normalizeRound({
 mode,difficulty:'EASY',question_count:8,
 duration_seconds:mode==='MEMORY'?90:180,
 points_per_correct:100,penalty:25,weight:1
},{soloMatrix:true,soloOnly:true});

test('UX38 MATRIX and MEMORY expose neither hidden word IDs nor false mastery',()=>{
 for(const mode of ['MATRIX','MEMORY']){
  const rd=round(mode),st=createState(rd,vocabulary,1000);
  const [first,other]=st.pairs;
  if(mode==='MATRIX'){
   const result=answerQuestion(st,rd,{firstId:first.enId,secondId:other.viId},1200);
   assert.equal(result.result.correct,false);
   assert.equal(st.health,2);
  }else{
   answerQuestion(st,rd,{cardId:first.enId},1100);
   const result=answerQuestion(st,rd,{cardId:other.viId},1200);
   assert.equal(result.result.correct,false);
   assert.equal(st.health,3,'MEMORY has no heart penalty');
  }
  assert.equal(st.mistakes,1);
  assert.deepEqual(new Set(validWrongWordIds(st)),
   new Set([first.id,other.id]),mode+' mismatch tracks both review candidates');
  const visible=publicState(st,1200);
  assert.equal(visible.wrongWordIds,undefined);
  assert.equal(visible.reviewWords,undefined);
  assert.equal(visible.pairs,undefined);
  assert.ok(!JSON.stringify(visible).includes(first.id),
   mode+' public state must not leak server vocabulary IDs');
 }
});

test('UX38 notebook offers all five Solo filters and tells users what evidence is counted',()=>{
 const html=read('public/mistakes.html'),ui=read('public/ux27-mistakes.js');
 for(const mode of ['MATCH','BOMB','CAR','MATRIX','MEMORY']){
  assert.match(html,new RegExp('<option value="'+mode+'">'+mode+'</option>'));
  assert.ok(html.includes(mode),'header or explainer lacks mode '+mode);
 }
 assert.match(ui,/w\.modes\?\.includes\(selectedMode\)/);
 assert.match(ui,/Từ khó sau Solo MATCH\/BOMB\/CAR\/MATRIX\/MEMORY/);
 assert.doesNotMatch(ui,/Chỉ Solo MATCH\/BOMB\/CAR từ UX27/);
 assert.match(html,/LƯỢT GHI NHẬN TỪ KHÓ/);
 assert.match(html,/trận–từ/);
 assert.match(html,/không khẳng định mỗi từ đều là một lỗi chính tả/);
 assert.match(html,/id="ws27Account"/);
 assert.match(html,/id="ws27Guest"/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|markNeedsReview|data-review-word/);
});

test('UX38 account notebook and idempotent sync read all Solo modes without weakening privacy',()=>{
 const query=read('lib/game-mistakes.js');
 const auto=read('lib/auto-game-review.js');
 const api=read('api/index.js');
 assert.match(query,/array_agg\(DISTINCT sr\.mode ORDER BY sr\.mode\) AS modes/);
 assert.match(query,/WHERE sr\.user_id=\$1/);
 assert.match(query,/sr\.status IN \('COMPLETED','FAILED','TIMEOUT'\)/);
 assert.doesNotMatch(query,/sr\.mode IN/);
 assert.match(auto,/gameReviewRequestId\(runId,wordId\)/);
 assert.match(auto,/ON CONFLICT\(user_id,request_id\) DO NOTHING/);
 assert.match(api,/getAccountGameMistakeNotebook\(mustPlayer\(req\)\.id\)/);
 assert.match(api,/syncFinishedSoloReview\(ownerForAutoReview,runId\)/);
});
