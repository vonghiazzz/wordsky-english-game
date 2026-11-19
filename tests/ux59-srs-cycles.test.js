import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateSrsCycles,compareSrsCycles} from '../lib/ux59-srs-cycles.js';

test('multi-cycle simulation is deterministic and bounded',()=>{
 const a=compareSrsCycles({days:90}),b=compareSrsCycles({days:90});
 assert.deepEqual(a,b);
 assert.equal(a.window_days,90);
 assert.equal(a.baseline.timings.length,a.baseline.total_reviews);
 assert.equal(a.candidate.timings.length,a.candidate.total_reviews);
 assert.ok(a.baseline.total_reviews>2);
 assert.ok(a.candidate.total_reviews>2);
});
test('two initial needs make candidate first success due in 12h, control 24h',()=>{
 const x=compareSrsCycles({days:30});
 assert.equal(x.baseline.timings[2].interval_days,1);
 assert.equal(x.candidate.timings[2].interval_days,0.5);
 assert.equal(Date.parse(x.baseline.timings[2].due_at)-Date.parse(x.candidate.timings[2].due_at),12*3600000);
});
test('policy-dependent event timing is explicit, rather than fixed-history replay',()=>{
 const x=compareSrsCycles({days:30});
 assert.notEqual(x.baseline.timings[3].at,x.candidate.timings[3].at);
});
test('synthetic forgetting model is clearly labeled and never called measured recall',()=>{
 const x=compareSrsCycles({days:30,forgetAfterDays:2});
 assert.match(x.evidence,/not measured retention/);
 assert.match(x.assumption,/gap since prior review/);
 assert.equal(x.baseline.marked_remembered+x.baseline.marked_need_review,x.baseline.total_reviews);
 assert.equal(x.candidate.marked_remembered+x.candidate.marked_need_review,x.candidate.total_reviews);
});
test('invalid time, policy and bounds are rejected',()=>{
 assert.throws(()=>simulateSrsCycles({start:'2026-01-01'}),/timezone-aware/);
 assert.throws(()=>simulateSrsCycles({policy:'production'}),/Unknown policy/);
 assert.throws(()=>simulateSrsCycles({days:366}),/bounds/);
 assert.throws(()=>simulateSrsCycles({maxReviews:1}),/safety bound/);
 assert.throws(()=>simulateSrsCycles({forgetAfterDays:0}),/bounds/);
});
test('simulate safely across Vietnam-midnight offset',()=>{
 const x=compareSrsCycles({days:30,start:'2026-01-01T00:30:00+07:00'});
 assert.equal(x.baseline.first_review_at,'2025-12-31T17:30:00.000Z');
 assert.equal(x.candidate.first_review_at,x.baseline.first_review_at);
});
