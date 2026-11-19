import test from 'node:test';
import assert from 'node:assert/strict';
import {makeReport,exampleFixtures,AS_OF} from '../scripts/ux59-offline-report.mjs';
import {compareOfflineSchedules} from '../lib/ux59-srs-offline.js';

test('synthetic research report is stable and does not include personal data',()=>{
 const a=makeReport(),b=makeReport();
 assert.deepEqual(a,b);
 assert.equal(a.as_of,AS_OF);
 assert.equal(a.totals.cards,8);
 assert.equal(a.totals.changed_due_at,2);
 assert.equal(a.totals.earlier,2);
 assert.equal(a.totals.later,0);
 assert.equal(a.totals.unchanged,6);
 assert.equal(a.totals.cards,a.totals.earlier+a.totals.later+a.totals.unchanged);
 assert.equal(a.rows.some(x=>'user_id' in x),false);
});
test('comparison rejects duplicate card identifiers even across scenario reruns',()=>{
 const fixtures=exampleFixtures();
 assert.throws(()=>compareOfflineSchedules([...fixtures,fixtures[0]],{now:AS_OF}),/repeated/);
});
test('scheduling fixture metrics do not claim observed retention',()=>{
 const r=makeReport();
 assert.match(r.interpretation,/NOT proven better retention/);
 assert.match(r.limitation,/No reliable recall outcome/);
 assert.equal(r.totals.candidate_due>=0,true);
});
