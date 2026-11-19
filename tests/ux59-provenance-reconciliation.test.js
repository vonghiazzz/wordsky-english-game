import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileDelayedRecallEvidence as reconcile} from '../lib/ux59-provenance-reconciliation.js';
import {RECALL_CONSENT,RECALL_PROTOCOL,RECALL_KIND} from '../lib/ux43b-recall-evidence.js';
const due='2026-11-19T00:00:00Z';
const assignment=(trial_id,extra={})=>({trial_id,account_id:'account-a',word_id:'word-a',
 answer_revision:'approved-1',assigned_at:'2026-11-10T00:00:00Z',due_at:due,independent:true,...extra});
const event=(trial_id,extra={})=>({trial_id,account_id:'account-a',word_id:'word-a',
 answer_revision:'approved-1',protocol:RECALL_PROTOCOL,prompt_kind:RECALL_KIND,
 consent_version:RECALL_CONSENT,curated:true,answer_hidden:true,hints_used:false,
 attempt_index:1,result:'correct',issued_at:'2026-11-19T00:01:00Z',
 observed_at:'2026-11-19T00:02:00Z',...extra});
test('counts graded vs scheduled missing without exporting identities',()=>{
 const a=reconcile([assignment('one'),assignment('two')],[event('one')]);
 assert.equal(a.scheduled,2);assert.equal(a.eligible_attempts,1);
 assert.equal(a.missing,1);assert.equal(a.correct,1);
 assert.equal(a.eligible_accuracy,1);assert.equal(a.eligible_coverage,0.5);
 assert.ok(!JSON.stringify(a).includes('account-a'));
 assert.ok(!JSON.stringify(a).includes('word-a'));
});
test('identical replay is deduplicated; conflicting retry fails closed',()=>{
 const e=event('one');
 assert.equal(reconcile([assignment('one')],[e,{...e}]).duplicate_replays,1);
 assert.throws(()=>reconcile([assignment('one')],[e,{...e,result:'incorrect'}]),/Conflicting/);
});
test('rejects cross-account, cross-word, orphan and protocol mismatch',()=>{
 assert.throws(()=>reconcile([assignment('one')],[event('one',{account_id:'account-b'})]),/provenance mismatch/);
 assert.throws(()=>reconcile([assignment('one')],[event('one',{word_id:'word-b'})]),/provenance mismatch/);
 assert.throws(()=>reconcile([],[event('one')]),/Orphan/);
 assert.throws(()=>reconcile([assignment('one')],[event('one',{protocol:'fake'})]),/protocol/);
});
test('separately excludes withdrawn consent, revision drift, and exposed or assisted answers',()=>{
 const a=[assignment('a'),assignment('b'),assignment('c'),assignment('d')];
 const r=reconcile(a,[event('a',{consent_version:'none'}),event('b',{answer_revision:'new'}),
 event('c',{answer_hidden:false}),event('d',{hints_used:true})]);
 assert.equal(r.eligible_attempts,0);assert.equal(r.excluded_total,4);
 for(const k of ['not-consented','revision-mismatch','answer-exposed','assisted'])
  assert.equal(r.excluded[k],1);
});
test('enforces independent preassignment and delayed issuance',()=>{
 assert.throws(()=>reconcile([assignment('a',{independent:false})],[]),/independently/);
 assert.throws(()=>reconcile([assignment('a',{assigned_at:'2026-11-20T00:00:00Z'})],[]),/independently/);
 const r=reconcile([assignment('a')],[event('a',{issued_at:'2026-11-18T23:59:00Z'})]);
 assert.equal(r.excluded['trial-outside-window'],1);
});
test('recognizes first attempt, assessment window and valid timezone offsets',()=>{
 const a=[assignment('a'),assignment('b'),assignment('c')];
 const r=reconcile(a,[event('a',{attempt_index:2}),event('b',{observed_at:'2026-11-20T00:02:00Z'}),
 event('c',{issued_at:'2026-11-19T07:00:00+07:00',observed_at:'2026-11-19T07:01:00+07:00'})]);
 assert.equal(r.excluded.repeat,1);assert.equal(r.excluded['observation-outside-window'],1);
 assert.equal(r.eligible_attempts,1);
});
test('malformed timestamps, reversed events and bounds fail closed',()=>{
 assert.throws(()=>reconcile([assignment('a',{due_at:'2026-11-19'})],[]),/timezone-aware/);
 assert.throws(()=>reconcile([assignment('a')],[event('a',{observed_at:'2026-11-19T00:00:00Z',issued_at:'2026-11-19T00:01:00Z'})]),/predates/);
 assert.throws(()=>reconcile([],[],{windowHours:0}),/bounds/);
 assert.throws(()=>reconcile([assignment('a'),assignment('a')],[]),/Duplicate/);
});
