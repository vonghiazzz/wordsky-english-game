import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCycleReport} from '../scripts/ux59-cycles-report.mjs';

test('UX59 M2 report has four fixed synthetic scenarios',()=>{
 const a=makeCycleReport(),b=makeCycleReport();
 assert.deepEqual(a,b);
 assert.equal(a.scenarios.length,4);
 assert.deepEqual(a.scenarios.map(x=>x.id),[
  'always-remember-30d','always-remember-90d','threshold-2d-30d','threshold-7d-90d']);
 assert.match(a.caveat,/not real measured retention/);
 for(const scenario of a.scenarios){
  assert.equal(scenario.delta.total_reviews,
   scenario.candidate.total_reviews-scenario.baseline.total_reviews);
  assert.equal(scenario.delta.marked_need_review,
   scenario.candidate.marked_need_review-scenario.baseline.marked_need_review);
  assert.ok(scenario.baseline.total_reviews>0);
  assert.ok(scenario.candidate.total_reviews>0);
 }
});
