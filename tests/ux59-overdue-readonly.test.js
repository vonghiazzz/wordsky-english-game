import test from 'node:test';
import assert from 'node:assert/strict';
import {computeSrsState,buildSrsQueue} from '../lib/srs-schedule.js';
const event=(id,remembered,reviewed_at)=>({id,remembered,reviewed_at});

test('UX59.1 new words have no overdue age',()=>{
 const state=computeSrsState([],{now:'2026-11-25T00:00:00Z'});
 assert.equal(state.status,'new');
 assert.equal(state.overdue_days,null);
});
test('UX59.1 early repeat does not move scheduled due date',()=>{
 const history=[event('a',true,'2026-11-20T00:00:00Z'),event('b',true,'2026-11-20T12:00:00Z')];
 const state=computeSrsState(history,{now:'2026-11-25T00:00:00Z'});
 assert.equal(state.due_at,'2026-11-21T00:00:00.000Z');
 assert.equal(state.overdue_days,4);
 assert.equal(state.consecutive_remembered,1);
});
test('UX59.1 overdue age changes only at full-day boundaries',()=>{
 const history=[event('a',true,'2026-11-24T00:00:00Z')];
 assert.equal(computeSrsState(history,{now:'2026-11-24T23:59:59Z'}).overdue_days,0);
 assert.equal(computeSrsState(history,{now:'2026-11-25T00:00:00Z'}).overdue_days,0);
 assert.equal(computeSrsState(history,{now:'2026-11-26T00:00:00Z'}).overdue_days,1);
});
test('UX59.1 need-review remains actionable immediately',()=>{
 const state=computeSrsState([event('a',false,'2026-11-24T12:00:00Z')],{now:'2026-11-25T00:00:00Z'});
 assert.equal(state.status,'due');
 assert.equal(state.interval_days,0);
 assert.equal(state.overdue_days,0);
});
test('UX59.1 queue keeps existing ordering and summary',()=>{
 const cards=[{source:'shared',id:'2'},{source:'shared',id:'1'}];
 const history=new Map([
  ['shared:2',[event('b',true,'2026-11-24T00:00:00Z')]],
  ['shared:1',[event('a',true,'2026-11-20T00:00:00Z')]]
 ]);
 const queue=buildSrsQueue(cards,history,{now:'2026-11-25T00:00:00Z'});
 assert.deepEqual(queue.due.map(x=>x.id),['1','2']);
 assert.deepEqual(queue.due.map(x=>x.overdue_days),[4,0]);
 assert.deepEqual(queue.summary,{due:2,upcoming:0,new:0,total:2});
});
