import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseInsightsWindow,summarizeLearningInsights,INSIGHTS_ZONE} from '../lib/learning-insights.js';
import {validateInsightsResponse} from '../public/ux29-insights.js';

const actor=randomUUID();
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dates=days=>Array.from({length:days},(_,i)=>{
 const start=Date.UTC(2026,9,29)-(days-1-i)*86400000;
 return new Date(start).toISOString().slice(0,10);
});
const fixture=(days=7)=>({
 actorId:actor,days,asOf:'2026-10-29T11:17:00Z',today:'2026-10-29',
 daily:dates(days).map((day,i)=>({day,reviews:0,marked_remembered:0,marked_need_review:0,solo_runs:i===days-1?1:0})),
 current:{current_known:5,current_need_review:3},
 focus:[{source:'shared',word_id:randomUUID(),english:'apple',meaning:'táo',topic:'Food',
  need_review_marks:2,review_events:3,last_reviewed_at:'2026-10-29T10:00:00Z'}],
 solo:[{mode:'MATCH',runs:1}]
});

test('UX29 window strictly allows only 7 and 30 days, never a client actor',()=>{
 assert.equal(parseInsightsWindow(),7);
 assert.equal(parseInsightsWindow({days:'7'}),7);
 assert.equal(parseInsightsWindow({days:'30'}),30);
 for(const input of [{days:7},{days:['7','30']},{days:'0'},
  {days:'all'},{days:'07'},{days:'100000'},{days:'30 '}]){
  assert.throws(()=>parseInsightsWindow(input),e=>e.status===400);
 }
 assert.equal(INSIGHTS_ZONE,'Asia/Ho_Chi_Minh');
});

test('UX29 aggregates local-day review decisions and Solo independently',()=>{
 const data=fixture();
 data.daily.at(-2).reviews=2;
 data.daily.at(-2).marked_remembered=1;
 data.daily.at(-2).marked_need_review=1;
 data.daily.at(-1).reviews=1;
 data.daily.at(-1).marked_remembered=1;
 data.daily.at(-1).solo_runs=1;
 const report=summarizeLearningInsights(data);
 assert.equal(report.scope,'account-learning-insights');
 assert.equal(report.actor_id,actor);
 assert.deepEqual(report.period,{from:'2026-10-23',to:'2026-10-29'});
 assert.equal(report.summary.reviews,3);
 assert.equal(report.summary.marked_remembered,2);
 assert.equal(report.summary.marked_need_review,1);
 assert.equal(report.summary.remembered_mark_rate,66.7);
 assert.equal(report.summary.active_days,2);
 assert.equal(report.summary.solo_runs,1);
 assert.equal(report.summary.current_known,5);
 assert.equal(report.summary.current_need_review,3);
 assert.equal(report.solo_modes.find(x=>x.mode==='MATCH').runs,1);
 assert.equal(report.solo_modes.find(x=>x.mode==='CAR').runs,0);
 assert.equal(report.focus_words[0].need_review_marks,2);
 assert.equal(validateInsightsResponse(report,actor,7),report);
});

test('UX29 zero-history user shows zero activities and no artificial recall rate',()=>{
 const data=fixture(30);
 data.focus=[];
 data.solo=[];
 data.daily.at(-1).solo_runs=0;
 const report=summarizeLearningInsights(data);
 assert.equal(report.daily.length,30);
 assert.equal(report.summary.remembered_mark_rate,null);
 assert.equal(report.summary.reviews,0);
 assert.equal(report.summary.solo_runs,0);
 assert.equal(report.summary.active_days,0);
 assert.equal(report.focus_words.length,0);
 assert.equal(validateInsightsResponse(report,actor,30),report);
});

test('UX29 fails closed on mixed-account response and tampered rows',()=>{
 const report=summarizeLearningInsights(fixture());
 assert.throws(()=>validateInsightsResponse(report,randomUUID(),7),/tài khoản/);
 assert.throws(()=>validateInsightsResponse(report,actor,30),/tài khoản/);
 assert.throws(()=>validateInsightsResponse({...report,time_zone:'UTC'},actor,7),/tài khoản/);
 const tampered={...report,summary:{...report.summary,reviews:-1}};
 assert.throws(()=>validateInsightsResponse(tampered,actor,7),/không hợp lệ/);
 assert.throws(()=>summarizeLearningInsights({...fixture(),daily:dates(7).slice(1).map(day=>({
  day,reviews:0,marked_remembered:0,marked_need_review:0,solo_runs:0
 }))}),/không hợp lệ/);
 const wrongSolo=fixture();wrongSolo.daily.at(-1).solo_runs=1;wrongSolo.solo=[];
 assert.throws(()=>summarizeLearningInsights(wrongSolo),/Solo không nhất quán/);
});

test('UX29 GET is server-account-scoped, read-only snapshot, no SRS feature gate',()=>{
 const api=source('api/index.js'),query=source('lib/learning-insights.js');
 assert.match(api,/method==='GET'&&key==='learning\/insights'/);
 assert.match(api,/getAccountLearningInsights\(mustPlayer\(req\)\.id,req\.query\|\|\{\}\)/);
 assert.match(api,/setHeader\('cache-control','no-store'\)/);
 assert.match(query,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(query,/transaction_timestamp\(\)/);
 assert.match(query,/AT TIME ZONE 'Asia\/Ho_Chi_Minh'/);
 for(const table of ['ws_learning_flashcard_reviews','ws_personal_card_reviews',
  'ws_solo_runs','ws_learning_word_progress','ws_personal_card_progress',
  'ws_personal_cards']){
  assert.match(query,new RegExp(table));
 }
 assert.match(query,/WHERE user_id=\$1/);
 assert.match(query,/wp\.user_id=\$1/);
 assert.match(query,/pc\.user_id=\$1/);
 assert.match(query,/read-only account learning insights/i);
 assert.doesNotMatch(query,/\bINSERT INTO\b|\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE ws_/);
});

test('UX29 is a no-extra-navigation My Learning section with 7/30 responsive chart',()=>{
 const html=source('public/progress.html');
 const ui=source('public/ux29-insights.js'),style=source('public/ux29-insights.css');
 assert.match(html,/id="ws29Insights"/);
 assert.match(html,/id="ws29Days7"/);
 assert.match(html,/id="ws29Days30"/);
 assert.match(html,/id="ws29Chart"/);
 assert.match(html,/id="ws29Words"/);
 assert.match(html,/src="\/ux29-insights\.js"/);
 assert.match(html,/href="\/ux29-insights\.css"/);
 assert.equal((html.match(/id="ws24Practice"/g)||[]).length,1,
  'no duplicate practice buttons or additional navigation');
 assert.match(ui,/learning\/insights\?days=/);
 assert.match(ui,/await learningApi\('auth\/me'\)/);
 assert.match(ui,/confirm\.actor\.id!==id/);
 assert.match(ui,/replaceChildren\(\)/);
 assert.doesNotMatch(ui,/\.innerHTML|localStorage|sessionStorage/);
 assert.match(style,/\.ws29-chart\.is-month/);
 assert.match(style,/@media\(max-width:620px\)/);
});
