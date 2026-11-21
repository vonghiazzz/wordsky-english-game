/* UX61.4 pending bilingual editorial approval: no ambiguous auto-grading.
 * Pure synthetic fixtures, no DB, users, credentials or network calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isPendingEditorialRecall,countPendingEditorialRecall} from '../public/ux61-pending-recall.js';
import {selectPracticeQueue,gradeRecall} from '../public/ux28-practice-core.js';

const actor=randomUUID();
const cases=[
 ['Numbers','five','năm'],
 ['Time & Dates','year','năm'],
 ['School','assess','đánh giá'],
 ['School','evaluate','đánh giá'],
 ['Adjectives','significant','đáng kể'],
 ['Adjectives','substantial','đáng kể'],
];
const make=(topic,english,meaning,other={})=>({
 id:randomUUID(),source:'shared',topic,english,meaning,
 status:'due',review_count:2,example:'An original example sentence.',
 ...other
});
const held=()=>cases.map(([topic,english,meaning])=>make(topic,english,meaning));
const payload=words=>({scope:'account-srs',actor_id:actor,
 status:'due',topic:'',total:words.length,words});
const selection={status:'due',topic:''};

test('UX61.4 blocks exactly six known shared sense-review cards regardless of cue formatting',()=>{
 const items=held();
 assert.equal(items.filter(isPendingEditorialRecall).length,6);
 assert.equal(countPendingEditorialRecall(items),6);
 for(const card of items){
  assert.equal(isPendingEditorialRecall({...card,english:card.english.toUpperCase(),
   topic:'  '+card.topic+'  ',meaning:'  '+card.meaning.toUpperCase()+'  '}),true);
  assert.equal(isPendingEditorialRecall({...card,meaning:'another translation'}),true,
   'A translated cue change alone is not an approval decision');
  assert.equal(isPendingEditorialRecall({...card,source:'personal'}),false);
  assert.equal(isPendingEditorialRecall({...card,topic:'Different topic'}),false);
 }
 assert.equal(isPendingEditorialRecall(make('Animals','habitat','môi trường sống tự nhiên')),false);
 assert.equal(isPendingEditorialRecall(make('Nature','habitat','môi trường sống')),false);
 assert.equal(isPendingEditorialRecall(make('School','test','đánh giá')),false);
 assert.equal(countPendingEditorialRecall(null),0);
});

test('UX61.4 production-shaped bilingual topic labels and verified public UUIDs are held',()=>{
 const rows=[
  make('Numbers - Số đếm','five','Năm',{id:'7bccae74-7819-4456-85ee-b262d425546e'}),
  make('Time & Dates - Thời gian','year','Năm',{id:'c74d6d8c-da74-4562-a0ed-26edf47ef547'}),
  make('School - Trường học','assess','đánh giá',{id:'dba50551-ef7a-4934-8437-16b0d6d2e544'}),
  make('School - Trường học','evaluate','đánh giá',{id:'3d186425-189f-44db-b910-980efce3e9d4'}),
  make('Adjectives - Tính từ','significant','đáng kể',{id:'2cbd48a9-ccae-4922-bae9-3e4b223953df'}),
  make('Adjectives - Tính từ','substantial','đáng kể',{id:'2a45ef4a-3c78-4e65-b41f-da7a48a6b9aa'}),
 ];
 assert.equal(countPendingEditorialRecall(rows),6);
 assert.deepEqual(selectPracticeQueue(payload(rows),actor,selection,10),[]);
 for(const word of rows){
  assert.equal(isPendingEditorialRecall({...word,id:randomUUID()}),true,
   'Bilingual topic must match without a pinned ID');
  assert.equal(isPendingEditorialRecall({...word,topic:'Renamed topic',english:'new translation'}),true,
   'Verified UUID must hold even across later content edits until signoff');
  assert.equal(isPendingEditorialRecall({...word,source:'personal'}),false);
 }
 assert.equal(isPendingEditorialRecall(
  make('Animals - Động vật','habitat','môi trường sống tự nhiên')),false);
 assert.equal(isPendingEditorialRecall(
  make('Nature - Thiên nhiên','habitat','môi trường sống')),false);
});

test('UX61.4 staged production 2,099-word UUIDs hold despite content/label changes',()=>{
 const production=[
  ['4b406577-b4d7-43a5-903e-55e734dca399','Numbers - Số đếm','five','Năm'],
  ['81bf2f1f-a7ab-49f7-ac0e-088ea7bee93d','Time & Dates - Thời gian','year','Năm'],
  ['850c23ad-1d31-4d64-ab9e-7b05744e10f6','School - Trường học','assess','đánh giá'],
  ['b7fb767d-b77c-4911-b45b-c4588747c2bc','School - Trường học','evaluate','đánh giá'],
  ['ad2b5bf6-dcd1-4232-bfd2-a3765a467ae5','Adjectives - Tính từ','significant','đáng kể'],
  ['91001117-6921-488d-a052-34dbc248e838','Adjectives - Tính từ','substantial','đáng kể'],
 ];
 const rows=production.map(([id,topic,english,meaning])=>make(topic,english,meaning,{id}));
 assert.equal(countPendingEditorialRecall(rows),6);
 assert.deepEqual(selectPracticeQueue(payload(rows),actor,selection),[]);
 for(const row of rows){
  assert.equal(isPendingEditorialRecall({...row,topic:'Renamed topic',meaning:'Reworded translation',
   english:'Reworded English'}),true,'Production UUID must remain held despite renames');
  assert.equal(isPendingEditorialRecall({...row,source:'personal'}),false);
 }
});

test('UX61.4 account SRS queue skips six ambiguous cards but retains other shared and personal words',()=>{
 const six=held();
 const safeShared=make('Travel','take off','cất cánh');
 const safePersonal=make('School','assess','đánh giá',{source:'personal'});
 const input=[six[0],safeShared,six[1],...six.slice(2),safePersonal];
 const untouched=structuredClone(input);
 const selected=selectPracticeQueue(payload(input),actor,selection,10);
 assert.deepEqual(selected.map(w=>w.word_id),[safeShared.id,safePersonal.id]);
 assert.deepEqual(selected.map(w=>w.source),['shared','personal']);
 assert.equal(countPendingEditorialRecall(input),6);
 assert.deepEqual(input,untouched,'Queue filtering cannot mutate word progress or review counts');
 assert.equal(selectPracticeQueue(payload(six),actor,selection).length,0);
 assert.throws(()=>selectPracticeQueue(payload(input),randomUUID(),selection),/tài khoản/);
});

test('UX61.4 unresolved synonyms never become auto-accepted answers or false SRS mastery',()=>{
 assert.equal(gradeRecall('evaluate','assess').correct,false);
 assert.equal(gradeRecall('assess','evaluate').correct,false);
 assert.equal(gradeRecall('year','five').correct,false);
 assert.equal(gradeRecall('substantial','significant').correct,false);
 const blocked=selectPracticeQueue(payload(held()),actor,selection);
 assert.equal(blocked.length,0,'No review request can be generated by a held quiz item');
});

test('UX61.6 study-only cards are rendered after actor confirmation and never submitted',()=>{
 const ui=readFileSync(new URL('../public/ux28-practice.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/practice.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/ux28-practice.css',import.meta.url),'utf8');
 assert.match(html,/<details id="ws28EditorialReview"[^>]*hidden>/);
 assert.match(html,/id="ws28EditorialList"/);
 assert.match(html,/không chấm đáp án và không lưu lượt ôn SRS/);
 assert.match(ui,/const heldCards=data\.words\.filter\(isPendingEditorialRecall\)/);
 assert.match(ui,/renderEditorialReference\(heldCards\)/);
 const confirmIndex=ui.indexOf("if(confirm.actor?.role!=='player'||confirm.actor.id!==id)");
 assert.ok(confirmIndex>=0);
 assert.ok(ui.indexOf('renderEditorialReference(heldCards);')>confirmIndex,
  'Never render private actor queue before revalidating current account');
 assert.match(ui,/renderEditorialReference\(\);/);
 assert.match(ui,/list\.replaceChildren\(\)/);
 assert.match(ui,/heading=text\('strong',word\.english\)/);
 assert.match(ui,/text\('p','Ví dụ gốc: '\+word\.example\)/);
 assert.equal(ui.includes('innerHTML'),false,'No HTML injection from untrusted words');
 assert.match(css,/\.ws28-editorial-review/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
 const heldCards=held();
 assert.equal(countPendingEditorialRecall(heldCards),6);
 const playable=selectPracticeQueue(payload(heldCards),actor,selection,10);
 assert.equal(playable.length,0,'Read-only card preview must never make held words auto-gradable');
});

test('UX61.4 UI must disclose held cards, preserve normal quiz progress and avoid auto-submission',()=>{
 const ui=readFileSync(new URL('../public/ux28-practice.js',import.meta.url),'utf8');
 const core=readFileSync(new URL('../public/ux28-practice-core.js',import.meta.url),'utf8');
 assert.match(core,/!isPendingEditorialRecall\(row\)/);
 assert.match(ui,/countPendingEditorialRecall\(data\.words\)/);
 assert.match(ui,/editorialHeld=held/);
 assert.match(ui,/Đã tạm bỏ qua/);
 assert.match(ui,/Chưa ghi review hay thay đổi lịch SRS/);
 assert.match(ui,/pendingAttempt=\{word,correct:skipped\?false:result\.correct,confirmed:false\}/);
});
