#!/usr/bin/env node
/*
 * UX43B: deterministic OFFLINE evidence quality fixture. This script never
 * connects to a user account, database, network, API or the SRS scheduler.
 * The synthetic actor and answer sets are locally generated ephemeral data.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {
 RECALL_CONSENT,prepareTypedRecallTrial,gradeTypedRecallTrial,
 aggregateTypedRecallEvidence
} from '../lib/ux43b-recall-evidence.js';

const user=randomUUID(),sourceWord=randomUUID();
const make=({answer='walk',prompt='Đi bộ',source='shared',
 consent=true,...extra}={})=>prepareTypedRecallTrial({
 trial_id:randomUUID(),account_id:user,source,word_id:sourceWord,
 prompt_vi:prompt,accepted_english:[answer],
 answer_revision:'synthetic-qa-v1',
 issued_at:'2026-10-31T00:00:00Z',
 expires_at:'2026-10-31T00:03:00Z',
 prompt_curation_approved:true,answer_hidden:true,
 research_consent:consent,
 ...(consent?{consent_version:RECALL_CONSENT}:{}),
 ...extra
});
const submit=(trial,response,extra={})=>gradeTypedRecallTrial(trial,{
 trial_id:trial.trial_id,response,
 server_submitted_at:'2026-10-31T00:00:06Z',
 server_attempt_index:1,server_hints_used:false,server_answer_revealed:false,
 ...extra
});
const pass=submit(make(),'walk');
const miss=submit(make({answer:'run',prompt:'Chạy'}),'walk');
const skipped=submit(make({consent:false}),'walk');
const exposed=submit(make(),'walk',{server_answer_revealed:true});
const repeated=submit(make(),'walk',{server_attempt_index:2});
assert.equal(pass.evidence.result,'correct');
assert.equal(miss.evidence.result,'incorrect');
for(const excluded of [skipped,exposed,repeated])assert.equal(excluded.evidence,null);
assert.equal(skipped.exclusion,'no-consent');
assert.equal(exposed.exclusion,'assisted-or-exposed');
assert.equal(repeated.exclusion,'repeat');

const report=aggregateTypedRecallEvidence([pass.evidence,miss.evidence],{
 as_of:'2026-10-31T00:05:00Z'
});
assert.equal(report.total_graded_events,2);
assert.deepEqual(report.outcomes,{correct:1,incorrect:1});
const json=JSON.stringify(report);
assert.equal(json.includes(user),false);
assert.equal(json.includes(sourceWord),false);
assert.equal(json.includes('walk'),false);
console.log(JSON.stringify({
 dataset:'synthetic-offline-no-db',
 excluded:{no_consent:1,assisted_or_exposed:1,repeat:1},
 ...report
}));
console.log('PASS: UX43B opt-in typed recall offline contract; no user writes');
