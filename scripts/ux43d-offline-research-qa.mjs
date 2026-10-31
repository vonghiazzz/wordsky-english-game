#!/usr/bin/env node
/*
 * UX43D fully synthetic, offline, aggregate-only research QA fixture.
 * No DB connection, Preview secrets, Vercel build or real account data.
 */
import assert from 'node:assert/strict';
import {
 auditCuratedPromptCatalog,auditUx43cEvidenceReadiness
} from '../lib/ux43d-curation-readiness.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const vocabulary=[
 {id:id(1),english:'walk',enabled:true,topic_enabled:true},
 {id:id(2),english:'run',enabled:true,topic_enabled:true},
 {id:id(3),english:'sleep',enabled:true,topic_enabled:true}
];
const prompt=(p,w,cue,answer)=>({
 id:id(p),word_id:id(w),prompt_vi:cue,
 accepted_english:[answer],answer_revision:'qa-v1',
 curator:'owner',approved:true,active:true
});
const curatedPrompts=[
 prompt(11,1,'Đi bộ','walk'),
 prompt(12,2,'Chạy','run'),
 prompt(13,3,' CHẠY ','sleep'),
 prompt(14,3,'Ngủ','nap')
];
const cue=auditCuratedPromptCatalog({
 vocabulary,prompts:curatedPrompts
});
assert.equal(cue.population.lexically_eligible_records,1);
assert.equal(cue.population.lexically_blocked_records,3);
assert.equal(cue.blocked_by_reason.ambiguous_shared_cue,2);
assert.equal(cue.authorized_to_activate_prompts,false);
const event=(trial,user,word,result,date)=>({
 trial_id:id(trial),user_id:id(user),word_id:id(word),
 request_id:id(trial+1000),
 answer_revision:'qa-v1',prompt_kind:'vi-to-en-typed',
 result,response_latency:'5-15s',consent_version:'ux43b-opt-in-v1',
 observed_at:date
});
const evidence=[
 event(201,501,1,'correct','2026-10-01T00:00:00Z'),
 event(202,501,1,'incorrect','2026-10-10T00:00:00Z'),
 event(203,502,2,'incorrect','2026-10-05T00:00:00Z')
];
const research=auditUx43cEvidenceReadiness({
 events:evidence,as_of:'2026-10-31T12:00:00Z'
});
assert.equal(research.observations.total,3);
assert.equal(research.observations.repeats_separated_by_at_least_7d,1);
assert.equal(research.privacy.small_cohort_do_not_publish,true);
assert.equal(research.valid_to_compare_srs_v2_effectiveness,false);
const report=JSON.stringify({
 dataset:'synthetic-offline-research-fixture-no-database',
 curation:cue,readiness:research
});
for(const secret of [
 id(1),id(11),id(201),id(501),'Đi bộ','Chạy','walk','sleep',
 'accepted_english','prompt_vi','word_id'
])assert.equal(report.includes(secret),false,'Private/corpus field exposed');
console.log(report);
console.log('PASS: UX43D synthetic curation and research-readiness gate; no real data or writes');
