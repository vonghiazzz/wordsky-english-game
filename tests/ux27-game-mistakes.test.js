import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {
  createState, answerQuestion, reconcile, publicState, carWordRequirements
} from '../lib/game.js';
import {
  validWrongWordIds, getFinishedRunWrongWords
} from '../lib/game-mistakes.js';
import {gameReviewRequestId} from '../lib/auto-game-review.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('public/app.js'),html=read('public/index.html'),learn=read('public/learn.html');
const api=read('api/index.js'),page=read('public/mistakes.html'),ui=read('public/ux27-mistakes.js');
const topicWords=Array.from({length:80},(_,i)=>({
  id:randomUUID(),english:'word'+i,meaning:'Nghia '+i,cefr_level:'A2'
}));
const round=(mode,count=3)=>({
  mode,difficulty:'EASY',question_count:count,duration_seconds:90,
  points_per_correct:100,penalty:25,bomb_fall_seconds:5,
  bomb_batch_size:2,bomb_spawn_interval_seconds:10,car_step_seconds:8
});

test('UX27 MATCH records an identifiable wrong English word, dedupes repeats and never exposes during play',()=>{
 const rd=round('MATCH');
 const st=createState(rd,topicWords,1000000);
 const left=st.pairs[0];
 const other=st.pairs[1].rightId;
 answerQuestion(st,rd,{leftId:left.id,rightId:other},1000100);
 answerQuestion(st,rd,{leftId:left.id,rightId:other},1000200);
 assert.deepEqual(st.wrongWordIds,[left.id]);
 assert.equal(publicState(st,1000300).wrongWordIds,undefined);
 assert.equal(publicState(st,1000300).reviewWords,undefined);
 assert.equal(answerQuestion(st,rd,{leftId:left.id,rightId:left.rightId},1000300).result.correct,true);
 assert.deepEqual(st.wrongWordIds,[left.id],'the word remains in the notebook even if later corrected');
});

test('UX27 BOMB records real missed bombs, not auto-typing misses or unscheduled words',()=>{
 const rd=round('BOMB');
 const st=createState(rd,topicWords,1000000);
 const first=st.bombs[0];
 const auto=answerQuestion(st,rd,{auto:true,answer:'doesnotexist'},1000200);
 assert.equal(auto.result.auto,true);
 assert.deepEqual(st.wrongWordIds,[]);
 reconcile(st,rd,1006500);
 assert.ok(st.wrongWordIds.includes(first.wordId));
 assert.equal(st.bombs[0].status,'MISSED');
 const pub=publicState(st,1006500);
 assert.ok(pub.bombs.every(b=>!('wordId' in b)&&!('english' in b)));
});

test('UX27 CAR records only an explicit wrong selected lane, not a guessed timeout target',()=>{
 const rd=round('CAR');
 const need=carWordRequirements(rd);
 const pools=Object.fromEntries(Object.entries(need).map(([tier,n])=>[
   tier,Array.from({length:n},(_,i)=>({
     id:randomUUID(),english:tier+i,meaning:'Meaning '+tier+i,cefr_level:'A2'
   }))
 ]));
 const st=createState(rd,pools,1000000);
 const lane=st.levels[0].lanes.findIndex(v=>v.kind!=='BLOCKED');
 const expected=st.levels[0].lanes[lane].wordId;
 answerQuestion(st,rd,{auto:true,answer:'notavalidword'},1001400);
 assert.deepEqual(st.wrongWordIds,[]);
 const result=answerQuestion(st,rd,{lane,answer:'incorrect'},1001800);
 assert.equal(result.result.wordCorrect,false);
 assert.deepEqual(st.wrongWordIds,[expected]);
 assert.ok(publicState(st,1001800).level.lanes.every(v=>!('wordId' in v)&&!('english' in v)));
 const fresh=createState(rd,pools,1000000);
 reconcile(fresh,rd,1009000);
 assert.equal(fresh.mistakes,1);
 assert.deepEqual(fresh.wrongWordIds,[],'timeouts are not graded as explicit mistakes');
 assert.ok(fresh.missedPracticeWordIds.length>0,'safe CAR words not answered should become practice candidates');
 assert.ok(fresh.levels[0].lanes.filter(l=>l.kind!=='BLOCKED').every(l=>fresh.missedPracticeWordIds.includes(l.wordId)));
 assert.equal(publicState(fresh,1009000).missedPracticeWordIds,undefined);
});

test('UX27 validates archived IDs, never queries active runs, and preserves exact word order',async()=>{
 const id=randomUUID(),second=randomUUID();
 assert.deepEqual(validWrongWordIds({wrongWordIds:[id,id,'malicious',second]}),[id,second]);
 let queries=0;
 const db={query:async(sql,params)=>{
   queries++;
   assert.match(sql,/WHERE w\.id=ANY\(\$1::uuid\[\]\)/);
   assert.deepEqual(params[0],[id,second]);
   return {rows:[{word_id:id,english:'apple',meaning:'táo'}]};
 }};
 assert.deepEqual(await getFinishedRunWrongWords(db,{status:'PLAYING',wrongWordIds:[id]}),[]);
 assert.equal(queries,0);
 const ended=await getFinishedRunWrongWords(db,{status:'FAILED',wrongWordIds:[id,second]});
 assert.equal(queries,1);
 assert.equal(ended[0].word_id,id);
 assert.equal(ended[0].reason,'incorrect');
 assert.deepEqual(validWrongWordIds({wrongWordIds:[id],missedPracticeWordIds:[id,second]}),[id,second]);
 assert.deepEqual(await getFinishedRunWrongWords(db,{status:'COMPLETED'}),[]);
 assert.equal(queries,1);
});

test('UX27 API binds the account from the session and reveals run words only after terminal',()=>{
 assert.match(api,/getAccountGameMistakeNotebook\(mustPlayer\(req\)\.id\)/);
 assert.match(api,/syncFinishedSoloReview\(ownerForAutoReview,runId\)/);
 assert.match(api,/syncRecentSoloReviews\(userId\)/);
 assert.match(api,/state\.status==='PLAYING'\?undefined:await getFinishedRunWrongWords\(db,state\)/);
 assert.match(api,/authorizeSolo\(req,rec\)/);
 assert.doesNotMatch(api,/learning\/game-mistakes[\s\S]{0,100}req\.query\.user_id/);
});

test('UX27 notebook automatically syncs SRS, has no manual per-word confirmation',()=>{
 assert.match(html,/\/ux27-results\.css/);
 assert.match(app,/href="\/mistakes\.html"/);
 assert.match(page,/data-ws-page="progress"/);
 assert.match(page,/id="ws27Account"/);
 assert.match(ui,/learning\/game-mistakes\/sync/);
 assert.match(ui,/expected_actor_id:id/);
 assert.doesNotMatch(ui,/markNeedsReview|data-review-word|Cần ôn ngay/);
 assert.match(ui,/credentials: 'same-origin'/);
 assert.doesNotMatch(ui,/localStorage/);
 assert.match(read('public/progress.html'),/href="\/mistakes\.html"/);
 assert.match(learn,/WordSkyFlashcardCatalog/,'existing Learn flows must remain available');
});

test('UX27 Solo result includes only server-returned words, escaping untrusted HTML',()=>{
 const start=app.indexOf('function soloResultMarkup(');
 const end=app.indexOf('function renderSoloCarGame(){',start);
 assert.ok(start>=0&&end>start);
 const fixture={mode:'MATCH',score:10,correct:1,mistakes:1,status:'FAILED',
   reviewWords:[{english:'<script>alert(1)</script>',meaning:'test & test',topic:'Sports'}]};
 const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const result=vm.runInNewContext(app.slice(start,end)+
   '\nsoloResultMarkup(fixture,{question_count:3},"MATCH")',
   {fixture,fmt:n=>String(n),escapeHtml});
 assert.match(result,/Từ cần ôn sau lượt này/);
 assert.match(result,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(result,/<script>alert\(1\)<\/script>/);
 assert.match(result,/href="\/mistakes\.html"/);
});


test('UX27.1 auto-review request UUID is deterministic, scoped to run and word',()=>{
 const run=randomUUID(),w1=randomUUID(),w2=randomUUID();
 const first=gameReviewRequestId(run,w1);
 assert.match(first,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.equal(gameReviewRequestId(run,w1),first);
 assert.notEqual(gameReviewRequestId(run,w2),first);
 assert.notEqual(gameReviewRequestId(randomUUID(),w1),first);
});

test('UX27.1 CAR missed lanes display honest unanswered label, no live answer leak',()=>{
 const start=app.indexOf('function soloResultMarkup(');
 const end=app.indexOf('function renderSoloCarGame(){',start);
 const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const fixture={mode:'CAR',score:0,correct:0,mistakes:1,status:'FAILED',
   reviewSync:{status:'synced',newly_queued:1},
   reviewWords:[{english:'apple',meaning:'Táo',topic:'Food',reason:'unanswered'}]};
 const result=vm.runInNewContext(app.slice(start,end)+
   '\nsoloResultMarkup(fixture,{question_count:3},"CAR")',
   {fixture,fmt:n=>String(n),escapeHtml});
 assert.match(result,/Chặng CAR chưa trả lời/);
 assert.match(result,/Tự động đồng bộ với My Learning/);
 assert.doesNotMatch(result,/đánh dấu “Cần ôn”/);
});
