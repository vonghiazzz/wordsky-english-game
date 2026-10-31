import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fingerprintRecallDraft,assessRecallReviewGate} from '../lib/ux43e2-review-gate.js';

const word={id:randomUUID(),english:'walk',enabled:true,topic_enabled:true};
const draft={id:randomUUID(),word_id:word.id,prompt_vi:'Đi bộ',
 accepted_english:['walk','walk on foot'],answer_revision:'rev1',
 curator:'owner',approved:false,active:false};
const roster=[0,1].map(i=>({id:randomUUID(),person_key:'reviewer-person-'+(i+1),
 auth_subject:'verified-provider:'+(i+1),active:true,
 identity_verified:true,bilingual_verified:true}));
const digest=fingerprintRecallDraft(draft,word);
const receipts=roster.map(r=>({id:randomUUID(),prompt_id:draft.id,
 reviewer_id:r.id,answer_revision:'rev1',snapshot_sha256:digest,
 phase:'blind-initial',peer_decision_visible:false,decision:'approve',
 reviewed_at:'2026-10-31T00:00:00Z'}));
const assess=changes=>assessRecallReviewGate({draft,word,roster,receipts,...changes});

test('UX43E2A two independent blinded approvals only establish prerequisites, NEVER activation',()=>{
 const result=assess();
 assert.equal(result.review_gate_preconditions_met,true);
 assert.equal(result.authorized_to_activate_prompts,false);
 assert.equal(result.immutable_database_receipts_verified,false);
 assert.equal(result.independently_authenticated_reviewer_service_available,false);
 assert.equal(JSON.stringify(result).includes(word.id),false);
 assert.equal(JSON.stringify(result).includes(draft.prompt_vi),false);
});
test('UX43E2A lacks two reviewers, rejects owner, disabled/unknown identity, duplicate humans',()=>{
 for(const inputs of [
  {receipts:[receipts[0]]},
  {roster:[{...roster[0],person_key:'owner'},roster[1]]},
  {roster:[{...roster[0],bilingual_verified:false},roster[1]]},
  {roster:[{...roster[0],identity_verified:false},roster[1]]},
  {roster:[{...roster[0],active:false},roster[1]]},
  {roster:[roster[0],{...roster[1],person_key:roster[0].person_key}]},
  {roster:[roster[0],{...roster[1],auth_subject:roster[0].auth_subject}]},
  {roster:[roster[0]]}
 ])assert.equal(assess(inputs).review_gate_preconditions_met,false);
});
test('UX43E2A rejects replays, disclosure, mismatched snapshot, vote disagreement',()=>{
 for(const inputs of [
  {receipts:[receipts[0],receipts[0]]},
  {receipts:[receipts[0],{...receipts[1],reviewer_id:roster[0].id}]},
  {receipts:[receipts[0],{...receipts[1],peer_decision_visible:true}]},
  {receipts:[receipts[0],{...receipts[1],phase:'open-review'}]},
  {receipts:[receipts[0],{...receipts[1],answer_revision:'other'}]},
  {receipts:[receipts[0],{...receipts[1],snapshot_sha256:'0'.repeat(64)}]},
  {receipts:[receipts[0],{...receipts[1],decision:'reject'}]}
 ])assert.equal(assess(inputs).review_gate_preconditions_met,false);
});
test('UX43E2A draft revision/answer/order changes invalidate signed context',()=>{
 for(const changes of [
  {answer_revision:'rev2'},
  {prompt_vi:'Đi bộ nhanh'},
  {accepted_english:['walk on foot','walk']},
  {accepted_english:['walk']}
 ]){
  const changed={...draft,...changes};
  assert.notEqual(fingerprintRecallDraft(changed,word),digest);
  assert.equal(assess({draft:changed}).review_gate_preconditions_met,false);
 }
});
test('UX43E2A disallows currently active word and ambiguous shared cue collision',()=>{
 assert.deepEqual(assess({activePrompts:[{
  word_id:word.id,prompt_vi:'Khác',approved:true,active:true
 }]}).blocked_by,['active_word_collision']);
 assert.deepEqual(assess({activePrompts:[{
  word_id:randomUUID(),prompt_vi:'  ĐI   BỘ ',approved:true,active:true
 }]}).blocked_by,['ambiguous_shared_cue']);
});
test('UX43E2A rejects disabled catalog or stale approved/active draft',()=>{
 assert.ok(assess({draft:{...draft,approved:true}}).blocked_by.includes('draft_not_reviewable'));
 assert.ok(assess({word:{...word,topic_enabled:false}}).blocked_by.includes('draft_not_reviewable'));
});
test('UX43E2A rejects malformed snapshots, repeated variants and invalid receipts',()=>{
 assert.throws(()=>fingerprintRecallDraft({...draft,accepted_english:['walk','WALK']},word));
 assert.throws(()=>fingerprintRecallDraft({...draft,answer_revision:'invalid #'},word));
 assert.throws(()=>fingerprintRecallDraft({...draft,accepted_english:['run']},word));
 assert.throws(()=>assess({receipts:[null]}));
 assert.throws(()=>assess({receipts:Array(26).fill(receipts[0])}));
 assert.throws(()=>assess({roster:'not array'}));
});
