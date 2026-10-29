import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 normalizeRecallAnswer,gradeRecall,practiceSelectionFromUrl,reviewGroupLabel,
 selectPracticeQueue,reviewPayload
} from '../public/ux28-practice-core.js';

const uuid=()=>randomUUID();
const actor=uuid();
const card=(override={})=>({
 id:uuid(),source:'shared',english:'take off',meaning:'cất cánh',
 topic:'Travel',status:'due',review_count:1,ipa:'/teɪk/',example:'The plane took off.',
 ...override
});
const payload=(words,override={})=>({
 scope:'account-srs',actor_id:actor,status:'due',topic:'Travel',
 total:words.length,words,...override
});
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('UX28 correct recall normalizes case, whitespace, apostrophes but not spelling',()=>{
 assert.equal(normalizeRecallAnswer('  TAKE   OFF  '),'take off');
 assert.equal(normalizeRecallAnswer('DON’T'),"don't");
 assert.equal(gradeRecall(' TaKe  off ','take off').correct,true);
 assert.equal(gradeRecall('don’t',"don't").correct,true);
 assert.equal(gradeRecall('take','take off').correct,false);
 assert.equal(gradeRecall('','take off').correct,false);
 assert.equal(gradeRecall('take-off','take off').correct,false);
});

test('UX28 launch selection comes from My Learning status and topic only',()=>{
 assert.deepEqual(practiceSelectionFromUrl(''),{status:'due',topic:''});
 assert.deepEqual(practiceSelectionFromUrl('?status=new&topic=Sports'),{status:'new',topic:'Sports'});
 assert.deepEqual(practiceSelectionFromUrl('?status=upcoming&topic=%C3%94n%20t%E1%BA%ADp'),
  {status:'upcoming',topic:'Ôn tập'});
 assert.equal(reviewGroupLabel('due'),'Đến hạn');
 assert.equal(reviewGroupLabel('new'),'Từ mới');
 assert.equal(reviewGroupLabel('upcoming'),'Sắp đến hạn');
 assert.throws(()=>practiceSelectionFromUrl('?status=wrong'),/không hợp lệ/);
 assert.throws(()=>practiceSelectionFromUrl('?topic='+('x'.repeat(81))),/không hợp lệ/);
});

test('UX28 validates signed-in SRS account and selection, supports personal and shared',()=>{
 const a=card(),b=card({id:uuid(),source:'personal',english:'personal phrase'});
 const result=selectPracticeQueue(payload([a,b]),actor,{status:'due',topic:'Travel'});
 assert.deepEqual(result.map(w=>w.source),['shared','personal']);
 assert.deepEqual(result.map(w=>w.word_id),[a.id,b.id]);
 assert.equal(result[0].ipa,'/teɪk/');
 assert.throws(()=>selectPracticeQueue(payload([a]),uuid(),{status:'due',topic:'Travel'}),/tài khoản/);
 assert.throws(()=>selectPracticeQueue(payload([a]),actor,{status:'new',topic:'Travel'}),/tài khoản/);
 assert.throws(()=>selectPracticeQueue(payload([a,a]),actor,{status:'due',topic:'Travel'}),/lặp/);
 assert.throws(()=>selectPracticeQueue(payload([card({source:'bad'})]),actor,{status:'due',topic:'Travel'}),/không hợp lệ/);
 assert.throws(()=>selectPracticeQueue(payload([card({review_count:-1})]),actor,{status:'due',topic:'Travel'}),/không hợp lệ/);
});

test('UX28 shows only 10 answerable SRS words and does not invent missing meaning',()=>{
 const words=Array.from({length:15},(_,i)=>card({english:'word'+i}));
 words[1].meaning='';
 const result=selectPracticeQueue(payload(words),actor,{status:'due',topic:'Travel'},10);
 assert.equal(result.length,10);
 assert.equal(result[0].english,'word0');
 assert.equal(result[1].english,'word2');
 assert.ok(result.every(w=>w.meaning));
 assert.throws(()=>selectPracticeQueue(payload(words),actor,{status:'due',topic:'Travel'},1000),/tài khoản/);
});

test('UX28 secure review payload respects source, actor and observed version',()=>{
 const w={word_id:uuid(),source:'personal',review_count:7};
 const requestId=uuid();
 assert.deepEqual(reviewPayload(w,false,actor,requestId),{
  request_id:requestId,source:'personal',word_id:w.word_id,
  remembered:false,expected_review_count:7,expected_actor_id:actor
 });
 assert.throws(()=>reviewPayload(w,true,'bad',requestId),/an toàn/);
});

test('UX28 exactly one Luyện từ action exists next to Làm mới lịch in My Learning',()=>{
 const html=src('public/progress.html');
 const pos=html.indexOf('id="ws24Reload"');
 assert.ok(pos>=0);
 assert.ok(html.indexOf('id="ws24Practice"',pos)>pos);
 assert.equal((html.match(/id="ws24Practice"/g)||[]).length,1);
 const buttonSection=html.slice(pos,pos+280);
 assert.match(buttonSection,/Luyện từ/);
 assert.doesNotMatch(html,/href="\/mistakes\.html"|href="\/practice\.html"/);
 const srs=src('public/ux24-srs-panel.js');
 assert.match(srs,/practice\.addEventListener\('click'/);
 assert.match(srs,/status:status\.value,topic:topic\.value/);
 const nav=src('public/shared-nav.js');
 assert.doesNotMatch(nav,/url:'\/practice\.html'|url:'\/mistakes\.html'/);
 assert.doesNotMatch(src('public/app.js'),/href="\/practice\.html"|href="\/mistakes\.html"/);
 assert.doesNotMatch(src('public/ux27-mistakes.js'),/practice\.html/);
});

test('UX28 skips redundant counters and launches quiz from account SRS queue',()=>{
 const html=src('public/practice.html');
 assert.match(html,/id="ws28Play"/);
 assert.match(html,/id="ws28Feedback"/);
 assert.match(html,/id="ws28Retry"/);
 assert.match(html,/id="ws28Done"/);
 assert.doesNotMatch(html,/id="ws28StartForm"|id="ws28Total"|id="ws28Needed"/);
 const ui=src('public/ux28-practice.js');
 assert.match(ui,/learning\/srs\/queue\?/);
 assert.match(ui,/size:'100'/);
 assert.match(ui,/selectPracticeQueue\(data,id,selection,MAX_CARDS\)/);
 assert.match(ui,/postUnifiedAccountReview\(/);
 assert.match(ui,/attempt\.word\.source/);
 assert.match(ui,/attempt\.confirmed=true/);
 assert.match(ui,/if\(attempt\.correct\)correctCount\+\+/);
 assert.match(ui,/await loadAccount\(\)/);
 assert.doesNotMatch(ui,/learning\/game-mistakes|localStorage\.setItem/);
 assert.doesNotMatch(src('public/ux28-practice-core.js'),/fetch\(|localStorage|window\.location/);
});
