import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INSIGHTS_SOLO_MODES,summarizeLearningInsights} from '../lib/learning-insights.js';
import {validateInsightsResponse} from '../public/ux29-insights.js';

const actor='ux36-isolated-account';
const today='2026-10-30';
const reportInput=(solo,finished)=>({
 actorId:actor,days:7,asOf:'2026-10-30T12:00:00Z',today,
 daily:Array.from({length:7},(_,i)=>({
  day:new Date(Date.UTC(2026,9,24+i)).toISOString().slice(0,10),
  reviews:0,marked_remembered:0,marked_need_review:0,
  solo_runs:i===6?finished:0
 })),
 current:{current_known:0,current_need_review:0},focus:[],solo
});

test('UX36 five Solo modes reconcile to daily account totals without changing review counts',()=>{
 assert.deepEqual(INSIGHTS_SOLO_MODES,['MATCH','BOMB','CAR','MATRIX','MEMORY']);
 const report=summarizeLearningInsights(reportInput([
  {mode:'MATCH',runs:1},{mode:'MATRIX',runs:1},{mode:'MEMORY',runs:2}
 ],4));
 assert.deepEqual(report.solo_modes.map(row=>[row.mode,row.runs]),[
  ['MATCH',1],['BOMB',0],['CAR',0],['MATRIX',1],['MEMORY',2]
 ]);
 assert.equal(report.summary.solo_runs,4);
 assert.equal(report.summary.active_days,1);
 assert.equal(report.summary.reviews,0);
 assert.equal(report.summary.remembered_mark_rate,null);
 assert.equal(validateInsightsResponse(report,actor,7),report);
});

test('UX36 empty user returns five zero mode counters and no fabricated reviews',()=>{
 const report=summarizeLearningInsights(reportInput([],0));
 assert.deepEqual(report.solo_modes.map(row=>row.runs),[0,0,0,0,0]);
 assert.equal(report.summary.solo_runs,0);
 assert.equal(report.summary.active_days,0);
 assert.equal(validateInsightsResponse(report,actor,7),report);
});

test('UX36 rejects mismatched modes and tampering before displaying account stats',()=>{
 const valid=summarizeLearningInsights(reportInput([
  {mode:'MATRIX',runs:1},{mode:'MEMORY',runs:1}
 ],2));
 const wrongTotal={...valid,solo_modes:valid.solo_modes.map(row=>({...row}))};
 wrongTotal.solo_modes[3].runs=2;
 assert.throws(()=>validateInsightsResponse(wrongTotal,actor,7),/Solo/);
 const wrongOrder={...valid,solo_modes:[...valid.solo_modes].reverse()};
 assert.throws(()=>validateInsightsResponse(wrongOrder,actor,7),/Solo/);
 const invalidMode=reportInput([{mode:'INVENTED',runs:1}],1);
 assert.throws(()=>summarizeLearningInsights(invalidMode),/Solo không hợp lệ/);
 const missing=reportInput([{mode:'MATRIX',runs:1}],2);
 assert.throws(()=>summarizeLearningInsights(missing),/Solo không nhất quán/);
});

test('UX36 SQL reads all five server-owned Solo modes, without analytics writes',()=>{
 const sql=readFileSync(new URL('../lib/learning-insights.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/ux29-insights.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 assert.match(sql,/mode = ANY\(\$5::text\[\]\)/);
 assert.match(sql,/db\.query\(DAILY_SQL,soloParams\)/);
 assert.match(sql,/db\.query\(SOLO_SQL,soloParams\)/);
 assert.match(sql,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.doesNotMatch(sql,/\bINSERT INTO\b|\bDELETE FROM\b|\bTRUNCATE\b|\bUPDATE ws_/);
 for(const mode of ['MATRIX','MEMORY']){
  assert.match(ui,new RegExp('mode\\.'+mode));
  assert.match(html,new RegExp('· '+mode+' 0'));
 }
});
