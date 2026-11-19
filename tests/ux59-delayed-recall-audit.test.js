import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDelayedRecallAssessments as audit} from '../lib/ux59-delayed-recall-audit.js';
const due='2026-11-19T00:00:00Z',within='2026-11-19T06:00:00Z',late='2026-11-21T00:00:00Z';
const row=(trial_id,overrides={})=>({
 trial_id,due_at:due,observed_at:within,result:'correct',
 consent:true,curated:true,independent:true,answer_hidden:true,
 hints_used:false,attempt_index:1,...overrides
});
test('aggregates eligible accuracy without treating missing as incorrect',()=>{
 const r=audit([row('a'),row('b',{result:'incorrect'}),
  row('c',{observed_at:null,result:null,attempt_index:0})]);
 assert.equal(r.scheduled,3);assert.equal(r.eligible_attempts,2);
 assert.equal(r.correct,1);assert.equal(r.incorrect,1);assert.equal(r.missing,1);
 assert.equal(r.eligible_accuracy,0.5);assert.equal(r.eligible_coverage,2/3);
 assert.equal(r.completion_coverage,2/3);
 assert.equal('trial_id' in r,false);
});
test('replayed identical trial is counted once, conflicting duplicate fails closed',()=>{
 const a=row('same');
 const r=audit([a,{...a}]);assert.equal(r.scheduled,1);
 assert.equal(r.duplicate_replays,1);
 assert.throws(()=>audit([a,{...a,result:'incorrect'}]),/Conflicting duplicate/);
});
test('exclusion reasons are separate from eligible denominator',()=>{
 const rows=[row('c',{consent:false}),row('u',{curated:false}),
  row('i',{independent:false}),row('e',{answer_hidden:false}),
  row('h',{hints_used:true}),row('r',{attempt_index:2}),
  row('w',{observed_at:late})];
 const r=audit(rows);
 assert.equal(r.eligible_attempts,0);assert.equal(r.eligible_accuracy,null);
 assert.equal(r.excluded_total,7);assert.equal(r.scheduled,7);
 for(const k of ['no-consent','unapproved-prompt','not-independent',
  'answer-exposed','assisted','repeat','outside-window'])
  assert.equal(r.excluded[k],1);
});
test('window is inclusive and timezone-aware',()=>{
 const r=audit([row('start',{observed_at:due}),
 row('end',{observed_at:'2026-11-20T07:00:00+07:00'})]);
 assert.equal(r.eligible_attempts,2);
 assert.equal(audit([row('early',{observed_at:'2026-11-18T23:59:59Z'})]).excluded['outside-window'],1);
});
test('empty cohort does not claim accuracy or coverage',()=>{
 const r=audit([]);
 assert.equal(r.scheduled,0);assert.equal(r.eligible_accuracy,null);
 assert.equal(r.eligible_coverage,null);assert.equal(r.completion_coverage,null);
});
test('malformed, ambiguous and oversize inputs fail closed',()=>{
 assert.throws(()=>audit([row('x',{due_at:'2026-11-19'})]),/timezone-aware/);
 assert.throws(()=>audit([row('x',{observed_at:null})]),/Missing assessment/);
 assert.throws(()=>audit([row('x',{consent:undefined})]),/server-confirmed/);
 assert.throws(()=>audit([row('x',{result:'maybe'})]),/result/);
 assert.throws(()=>audit([row('x',{attempt_index:0})]),/result/);
 assert.throws(()=>audit([], {windowHours:0}),/bounds/);
 assert.throws(()=>audit(Array.from({length:10001},(_,i)=>row(String(i)))),/bounds/);
});
