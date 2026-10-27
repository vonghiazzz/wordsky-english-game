import test from 'node:test';
import assert from 'node:assert/strict';
import {computeSrsState,buildSrsQueue,SRS_INTERVAL_DAYS} from '../lib/srs-schedule.js';

const T='2026-10-27T00:00:00Z';
const review=(id,remembered,reviewed_at=T)=>({id,remembered,reviewed_at});

test('UX24 unseen cards are new; never silently counted as overdue',()=>{
 const s=computeSrsState([],{now:T});
 assert.deepEqual(s,{
  status:'new',review_count:0,remembered:null,consecutive_remembered:0,
  interval_days:0,last_reviewed_at:null,due_at:null
 });
});

test('UX24 success schedules deterministic intervals; a need-review resets the streak',()=>{
 assert.deepEqual(SRS_INTERVAL_DAYS,[1,3,7,14,30,60,90]);
 const first=computeSrsState([review('a',true)],{now:T});
 assert.equal(first.status,'scheduled');
 assert.equal(first.due_at,'2026-10-28T00:00:00.000Z');
 assert.equal(first.consecutive_remembered,1);
 const second=computeSrsState([
  review('b',true,'2026-10-28T00:00:00Z'),
  review('a',true,T) // deliberate out-of-order input
 ],{now:'2026-10-29T00:00:00Z'});
 assert.equal(second.interval_days,3);
 assert.equal(second.consecutive_remembered,2);
 assert.equal(second.due_at,'2026-10-31T00:00:00.000Z');
 const reset=computeSrsState([
  review('a',true,T),review('b',true,'2026-10-28T00:00:00Z'),
  review('c',false,'2026-10-29T00:00:00Z')
 ],{now:'2026-10-29T00:00:00Z'});
 assert.equal(reset.status,'due');
 assert.equal(reset.interval_days,0);
 assert.equal(reset.consecutive_remembered,0);
 assert.equal(reset.remembered,false);
 const relearn=computeSrsState([
  review('a',true,T),review('b',false,'2026-10-29T00:00:00Z'),
  review('c',true,'2026-10-29T00:02:00Z')
 ],{now:'2026-10-29T12:00:00Z'});
 assert.equal(relearn.consecutive_remembered,1);
 assert.equal(relearn.due_at,'2026-10-30T00:02:00.000Z');
});

test('UX24 interval saturates rather than growing without bound',()=>{
 const history=Array.from({length:15},(_,i)=>
  review('event-'+i,true,new Date(Date.parse(T)+i*24*3600*1000).toISOString()));
 const state=computeSrsState(history,{now:T});
 assert.equal(state.review_count,15);
 assert.equal(state.consecutive_remembered,15);
 assert.equal(state.interval_days,90);
});

test('UX24 timestamps require an explicit timezone; equal-time event order is stable',()=>{
 assert.throws(()=>computeSrsState([review('a',true,'2026-10-27T07:00:00')]),/timezone/);
 assert.throws(()=>computeSrsState([review('a',true,'not a date')]),/timezone/);
 assert.throws(()=>computeSrsState([], {now:'2026-10-27T00:00:00'}),/timezone/);
 assert.throws(()=>computeSrsState([review('a',true),review('a',true)]),/Duplicate/);
 assert.throws(()=>computeSrsState([{id:'a',remembered:'yes',reviewed_at:T}]),/boolean/);
 const tie=[review('z',false,T),review('a',true,T)];
 const a=computeSrsState(tie,{now:T});
 const b=computeSrsState(tie.reverse(),{now:T});
 assert.deepEqual(a,b);
 assert.equal(a.remembered,false); // tie-break by event ID, never input order
 assert.equal(a.status,'due');
});

test('UX24 absolute instant semantics are timezone invariant',()=>{
 const utc=computeSrsState([review('a',true,'2026-10-27T00:00:00Z')],
  {now:'2026-10-27T01:00:00Z'});
 const vietnam=computeSrsState([review('a',true,'2026-10-27T07:00:00+07:00')],
  {now:'2026-10-27T08:00:00+07:00'});
 assert.deepEqual(utc,vietnam);
});

test('UX24 queue keeps personal/shared IDs distinct and never caps at 20',()=>{
 const duplicateId='aaa';
 const cards=[
  {source:'shared',id:duplicateId,english:'apple'},
  {source:'personal',id:duplicateId,english:'apple'},
  ...Array.from({length:25},(_,i)=>({source:'shared',id:'word-'+i,english:'word '+i}))
 ];
 const events=new Map([
  ['shared:'+duplicateId,[review('a',false,'2026-10-26T00:00:00Z')]],
  ['personal:'+duplicateId,[review('b',true,'2026-10-26T23:00:00Z')]]
 ]);
 const q=buildSrsQueue(cards,events,{now:T});
 assert.deepEqual(q.summary,{due:1,upcoming:1,new:25,total:27});
 assert.equal(q.due[0].source,'shared');
 assert.equal(q.upcoming[0].source,'personal');
 assert.equal(q.new.length,25);
 assert.throws(()=>buildSrsQueue([cards[0],cards[0]],events,{now:T}),/Duplicate/);
});

test('UX24 same canonical history yields same queue on multiple devices',()=>{
 const cards=[{source:'shared',id:'w2'},{source:'personal',id:'w1'},
  {source:'shared',id:'w1'}];
 const m=new Map([
  ['shared:w1',[review('a',false,'2026-10-25T00:00:00Z')]],
  ['shared:w2',[review('b',true,'2026-10-20T00:00:00Z')]]
 ]);
 const first=buildSrsQueue(cards,m,{now:T});
 const second=buildSrsQueue([...cards].reverse(),m,{now:T});
 assert.deepEqual(first,second,'sorting is independent of browser catalog order');
 assert.deepEqual(first.due.map(w=>w.id),['w2','w1']); // oldest due first
});
