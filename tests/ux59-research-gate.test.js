import test from 'node:test';
import assert from 'node:assert/strict';
import {assessUx59Research} from '../lib/ux59-research-gate.js';

test('UX59 M3 evaluation remains HOLD absent observed evidence and preview',()=>{
 const r=assessUx59Research();
 assert.equal(r.recommendation,'HOLD_NO_RUNTIME_CHANGE');
 assert.equal(r.simulation.fixed_scenarios,9);
 assert.equal(r.simulation.cycle_scenarios,4);
 assert.equal(r.simulation.later,1);
 assert.ok(r.blockers.some(x=>x.includes('No validated human')));
 assert.ok(r.blockers.some(x=>x.includes('Preview')));
});
test('passing superficial evidence cannot authorize a release',()=>{
 const r=assessUx59Research({approvedPreviewGate:true,
  observedRecall:{kind:'simulation',approved:true,sample_size:10000,reviewed_protocol:true}});
 assert.equal(r.recommendation,'HOLD_NO_RUNTIME_CHANGE');
 assert.ok(r.blockers.some(x=>x.includes('No validated human')));
});
test('even hypothetical reviewed evidence does not auto-promote',()=>{
 const r=assessUx59Research({approvedPreviewGate:true,
  observedRecall:{kind:'validated-human-recall-study',approved:true,sample_size:100,reviewed_protocol:true}});
 assert.equal(r.recommendation,'HOLD_NO_RUNTIME_CHANGE');
 assert.ok(r.blockers.some(x=>x.includes('later due dates')));
});
