import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSrsQueue,computeSrsState} from '../lib/srs-schedule.js';

const T='2026-11-25T00:00:00Z';
const card=(id,source='shared')=>({id,source});
const history=(entries)=>new Map(entries.map(([id,remembered,reviewed_at])=>[
 'shared:'+id,[{id:'review-'+id,remembered,reviewed_at}]
]));

test('UX59.2 overdue cards precede due-today cards, no SRS mutation',()=>{
 const cards=[card('today'),card('old'),card('yesterday')];
 const h=history([
  ['today',false,'2026-11-25T00:00:00Z'],
  ['old',true,'2026-11-20T00:00:00Z'],
  ['yesterday',true,'2026-11-23T00:00:00Z']
 ]);
 const before=structuredClone([...h]);
 const q=buildSrsQueue(cards,h,{now:T});
 assert.deepEqual(q.due.map(x=>x.id),['old','yesterday','today']);
 assert.deepEqual(q.due.map(x=>x.overdue_days),[4,1,0]);
 assert.equal(q.due[0].due_at,'2026-11-21T00:00:00.000Z');
 assert.deepEqual([...h],before);
 assert.deepEqual(q.summary,{due:3,upcoming:0,new:0,total:3});
});

test('UX59.2 tied overdue age uses exact due timestamp then stable source/id',()=>{
 const cards=[card('b'),card('a'),card('later'),card('personal','personal')];
 const h=history([
  ['a',true,'2026-11-23T00:00:00Z'],
  ['b',true,'2026-11-23T00:00:00Z'],
  ['later',true,'2026-11-23T12:00:00Z']
 ]);
 h.set('personal:personal',[{id:'p',remembered:true,reviewed_at:'2026-11-23T00:00:00Z'}]);
 const q=buildSrsQueue(cards,h,{now:T});
 assert.deepEqual(q.due.map(x=>x.id),['personal','a','b','later']);
 assert.deepEqual(q.due.map(x=>x.overdue_days),[1,1,1,0]);
});

test('UX59.2 scheduling remains unchanged for early repeats and upcoming',()=>{
 const early=[
  {id:'r1',remembered:true,reviewed_at:'2026-11-24T00:00:00Z'},
  {id:'r2',remembered:true,reviewed_at:'2026-11-24T01:00:00Z'}
 ];
 const state=computeSrsState(early,{now:T});
 assert.equal(state.status,'scheduled');
 assert.equal(state.due_at,'2026-11-25T00:00:00.000Z');
 assert.equal(state.consecutive_remembered,1);
 assert.equal(state.interval_days,1);
 const h=new Map([['shared:future',early]]);
 const q=buildSrsQueue([card('future')],h,{now:'2026-11-24T23:00:00Z'});
 assert.equal(q.upcoming.length,1);
 assert.equal(q.due.length,0);
});

test('UX59.2 sorting is independent of catalog order and paginatable',()=>{
 const cards=Array.from({length:30},(_,i)=>card('w'+String(i).padStart(2,'0')));
 const entries=cards.map((c,i)=>[c.id,false,new Date(Date.parse(T)-i*86400000).toISOString()]);
 const h=history(entries);
 const a=buildSrsQueue(cards,h,{now:T});
 const b=buildSrsQueue([...cards].reverse(),h,{now:T});
 assert.deepEqual(a,b);
 assert.equal(a.due.length,30);
 assert.equal(a.due[0].id,'w29');
 assert.equal(a.due[29].id,'w00');
 assert.deepEqual(a.due.slice(0,20).map(x=>x.id),b.due.slice(0,20).map(x=>x.id));
});
