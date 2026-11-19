import test from 'node:test';
import assert from 'node:assert/strict';
import {computeCandidateState,compareOfflineSchedules} from '../lib/ux59-srs-offline.js';
import {computeSrsState} from '../lib/srs-schedule.js';
const NOW='2026-11-19T08:00:00Z';
const e=(id,remembered,reviewed_at)=>({id,remembered,reviewed_at});
test('new cards remain new',()=>{
 const r=compareOfflineSchedules([{key:'shared:a',history:[]}],{now:NOW});
 assert.equal(r.totals.changed_due_at,0);assert.equal(r.rows[0].candidate_status,'new');
});
test('two consecutive needs followed by remembered schedule 12 hours',()=>{
 const h=[e('1',false,'2026-11-17T00:00:00Z'),e('2',false,'2026-11-17T01:00:00Z'),e('3',true,'2026-11-19T00:00:00Z')];
 assert.equal(computeSrsState(h,{now:NOW}).interval_days,1);
 const c=computeCandidateState(h,{now:NOW});
 assert.equal(c.interval_days,0.5);assert.equal(c.due_at,'2026-11-19T12:00:00.000Z');
 assert.equal(compareOfflineSchedules([{key:'shared:a',history:h}],{now:NOW}).totals.earlier,1);
});
test('single need review retains existing schedule',()=>{
 const h=[e('1',false,'2026-11-18T00:00:00Z'),e('2',true,'2026-11-19T00:00:00Z')];
 assert.equal(computeCandidateState(h,{now:NOW}).due_at,computeSrsState(h,{now:NOW}).due_at);
});
test('early repeated remembered does not postpone due date',()=>{
 const h=[e('1',false,'2026-11-17T00:00:00Z'),e('2',false,'2026-11-17T01:00:00Z'),e('3',true,'2026-11-19T00:00:00Z'),e('4',true,'2026-11-19T01:00:00Z')];
 assert.equal(computeCandidateState(h,{now:NOW}).due_at,'2026-11-19T12:00:00.000Z');
});
test('duplicate historical IDs are rejected',()=>{
 assert.throws(()=>computeCandidateState([e('1',false,NOW),e('1',false,NOW)],{now:NOW}),/Duplicate/);
});
test('shared and personal keys remain distinct and fixture input unmodified',()=>{
 const h=[e('1',false,NOW)],original=structuredClone(h);
 const r=compareOfflineSchedules([{key:'shared:a',history:h},{key:'personal:a',history:h}],{now:NOW});
 assert.equal(r.totals.cards,2);assert.deepEqual(h,original);
 assert.throws(()=>compareOfflineSchedules([{key:'shared:a',history:h},{key:'shared:a',history:h}],{now:NOW}),/repeated/);
});
test('timezone offsets are normalized to UTC instants',()=>{
 const h=[e('1',false,'2026-11-18T23:30:00+07:00'),e('2',false,'2026-11-19T00:20:00+07:00'),e('3',true,'2026-11-19T01:00:00+07:00')];
 assert.equal(computeCandidateState(h,{now:NOW}).due_at,'2026-11-19T06:00:00.000Z');
});
