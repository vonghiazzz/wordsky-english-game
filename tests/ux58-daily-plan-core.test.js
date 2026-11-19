import test from 'node:test';
import assert from 'node:assert/strict';
import {createDailyLearningPlan} from '../public/ux58-daily-plan-core.js';

test('UX58: due review is prioritized and new words are separately limited',()=>{
 const p=createDailyLearningPlan({due:28,new:16,upcoming:9});
 assert.deepEqual(p.tasks.map(t=>t.planned),[10,10]);
 assert.equal(p.totalPlanned,20);
 assert.equal(p.tasks[0].url,'practice.html?status=due');
 assert.equal(p.tasks[1].url,'practice.html?status=new');
 assert.equal(p.upcoming,9);
 assert.equal(p.source,'account-srs-read-only');
});
test('UX58: empty queue has zero work, no invented streak or completed count',()=>{
 const p=createDailyLearningPlan({due:0,new:0,upcoming:100});
 assert.equal(p.totalPlanned,0);
 assert.equal(p.hasWork,false);
 assert.equal(p.completed,null);
 assert.equal(p.streak,null);
});
test('UX58: targets never exceed availability or silently count upcoming',()=>{
 const a=createDailyLearningPlan({due:2,new:4,upcoming:90},{dueGoal:20,newGoal:30});
 assert.deepEqual(a.tasks.map(t=>t.planned),[2,4]);
 assert.equal(a.totalPlanned,6);
});
test('UX58: source data is not mutated and output is immutable',()=>{
 const counts={due:10,new:3,upcoming:1};
 const original={...counts};
 const result=createDailyLearningPlan(counts,{dueGoal:5,newGoal:0});
 assert.deepEqual(counts,original);
 assert.deepEqual(result.tasks.map(x=>x.planned),[5,0]);
 assert.ok(Object.isFrozen(result));
 assert.ok(Object.isFrozen(result.tasks));
 assert.ok(result.tasks.every(Object.isFrozen));
});
test('UX58: invalid data must fail closed, not misrepresent daily goals',()=>{
 for(const bad of [null,{},[],{due:3,new:4},{due:-1,new:1,upcoming:0},{due:NaN,new:2,upcoming:0},{due:2.5,new:0,upcoming:0},{due:2,new:0,upcoming:Infinity}])
  assert.throws(()=>createDailyLearningPlan(bad));
 for(const bad of [-1,51,1.2,NaN,'10'])
  assert.throws(()=>createDailyLearningPlan({due:20,new:20,upcoming:0},{newGoal:bad}));
});
test('UX58: same SRS snapshot produces same plan on another device',()=>{
 const snapshot={due:13,new:7,upcoming:8};
 const a=createDailyLearningPlan(snapshot);
 const b=createDailyLearningPlan({...snapshot});
 assert.deepEqual(a,b);
});
