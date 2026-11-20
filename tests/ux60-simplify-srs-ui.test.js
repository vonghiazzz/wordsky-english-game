import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/ux24-srs-panel.css',import.meta.url),'utf8');

test('UX60 compact SRS keeps preview gate, IDs and one existing practice action',()=>{
 assert.match(html,/<section class="ws24-panel" id="ws24Srs"[^>]*hidden>/);
 assert.match(html,/<section class="ws58-daily" id="ws58DailyPlan"[^>]*hidden>/);
 for(const id of ['ws24Status','ws24Topic','ws24Count','ws24List','ws24Summary',
  'ws58DailyDue','ws58DailyNew','ws58DailyUpcoming','ws58DailyTotal',
  'ws58ReviewsToday','ws58UniqueToday','ws58Streak','ws24Audit','ws24Reload'])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.equal((html.match(/id="ws24Practice"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="ws58Practice"/);
 assert.match(html,/Luyện từ trong nhóm đã chọn/);
 assert.match(js,/status:status\.value,topic:topic\.value/);
 assert.match(js,/window\.location\.assign\('\/practice\.html\?'/);
});

test('UX60 shows global available totals rather than proposed quotas',()=>{
 assert.match(html,/>Cần ôn<\/span>/);
 assert.match(html,/>Từ mới<\/span>/);
 assert.match(js,/dailyDue\.textContent=String\(plan\.tasks\[0\]\.available\)/);
 assert.match(js,/dailyNew\.textContent=String\(plan\.tasks\[1\]\.available\)/);
 assert.match(js,/plan\.tasks\[0\]\.planned/);
 assert.match(html,/Chi tiết lịch ôn/);
 assert.match(html,/id="ws58DailyUpcoming"/);
 assert.match(html,/id="ws58UniqueToday"/);
});

test('UX60 progressively discloses sensitive and advanced info without removing controls',()=>{
 assert.match(html,/<details class="ws24-advanced">/);
 assert.match(html,/<details class="ws60-more">/);
 assert.match(js,/make\('details',undefined,'ws60-word-details'\)/);
 assert.match(js,/details\.append\(detailTitle,due\)/);
 assert.match(js,/daily\.hidden=true/);
 assert.match(js,/activityBox\.hidden=true/);
 assert.match(js,/validateDailyActivity\(activity,actorId\)/);
 assert.match(js,/postUnifiedAccountReview\(word\.source,word\.id,remembered,actorId,word\.review_count\)/);
});

test('UX60 responsive SRS has two metric columns and narrow-screen overrides',()=>{
 assert.match(css,/\.ws58-daily-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/\.ws24-filters #ws24Reload,\.ws24-filters #ws24Practice\{/);
 assert.match(css,/flex:1 1 calc\(50% - 6px\)/);
 assert.match(css,/\.ws24-filters #ws24Practice\{order:4\}/);
});
