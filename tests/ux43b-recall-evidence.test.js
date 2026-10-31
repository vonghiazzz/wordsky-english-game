import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 RECALL_PROTOCOL,RECALL_CONSENT,RECALL_KIND,
 normalizeTypedEnglish,prepareTypedRecallTrial,
 gradeTypedRecallTrial,aggregateTypedRecallEvidence
} from '../lib/ux43b-recall-evidence.js';

const USER=randomUUID(),WORD=randomUUID(),ISSUED='2026-10-31T00:00:00Z';
const EXPIRES='2026-10-31T00:04:00Z';
function trial(overrides={}){
 return prepareTypedRecallTrial({
  trial_id:randomUUID(),account_id:USER,source:'shared',word_id:WORD,
  prompt_vi:'Đi bộ',accepted_english:['walk','walk on foot'],
  answer_revision:'catalog-qa-1',issued_at:ISSUED,expires_at:EXPIRES,
  prompt_curation_approved:true,answer_hidden:true,
  research_consent:true,consent_version:RECALL_CONSENT,
  ...overrides
 });
}
function grade(t,response='walk',overrides={}){
 return gradeTypedRecallTrial(t,{
  trial_id:t.trial_id,response,server_submitted_at:'2026-10-31T00:00:06Z',
  server_attempt_index:1,server_hints_used:false,server_answer_revealed:false,
  ...overrides
 });
}

test('UX43B exposes only challenge content; server-only answer set cannot serialize or be forged',()=>{
 const t=trial();
 assert.equal(t.prompt_kind,RECALL_KIND);
 assert.deepEqual(Object.keys(t).sort(),['expires_at','prompt_kind','prompt_vi','trial_id']);
 assert.ok(Object.isFrozen(t));
 const exposed=JSON.stringify(t);
 for(const sensitive of [USER,WORD,'walk','catalog-qa-1','accepted_english','answer_revision'])
  assert.equal(exposed.includes(sensitive),false);
 assert.throws(()=>grade({...t},'walk'),/untrusted/);
 assert.throws(()=>grade(JSON.parse(JSON.stringify(t)),'walk'),/untrusted/);
 assert.equal(grade(t).feedback.correct,true);
});

test('UX43B exact typed-English normalization is deterministic; no stemming or fuzzy matches',()=>{
 assert.equal(normalizeTypedEnglish("  DON'T  "),"don't");
 assert.equal(normalizeTypedEnglish("  Don’t   walk  "),"don't walk");
 assert.equal(normalizeTypedEnglish('  WALK  '),'walk');
 assert.equal(normalizeTypedEnglish('walks'),'walks');
 assert.equal(grade(trial(),'  WALK  ').evidence.result,'correct');
 assert.equal(grade(trial(),'walks').evidence.result,'incorrect');
 assert.equal(grade(trial(),'wolk').evidence.result,'incorrect');
 assert.equal(grade(trial(),'').exclusion,'blank');
 assert.throws(()=>normalizeTypedEnglish(12),/invalid typed/);
 assert.throws(()=>normalizeTypedEnglish('a'.repeat(161)),/invalid typed/);
 assert.throws(()=>normalizeTypedEnglish('line\nfeed'),/invalid typed/);
});

test('UX43B graded evidence is first-attempt, answer-hidden, opted-in, nonexpired ONLY',()=>{
 const t=trial();
 const positive=grade(t,'walk');
 assert.equal(positive.evidence.protocol,RECALL_PROTOCOL);
 assert.equal(positive.evidence.consent_version,RECALL_CONSENT);
 assert.equal(positive.evidence.result,'correct');
 assert.equal(positive.evidence.first_attempt,true);
 assert.equal(positive.evidence.response_latency,'5-15s');
 assert.equal(positive.exclusion,null);
 assert.equal(grade(t,'walk',{server_attempt_index:2}).exclusion,'repeat');
 assert.equal(grade(t,'walk',{server_hints_used:true}).exclusion,'assisted-or-exposed');
 assert.equal(grade(t,'walk',{server_answer_revealed:true}).exclusion,'assisted-or-exposed');
 assert.equal(grade(t,'walk',{server_submitted_at:'2026-10-31T00:04:01Z'}).exclusion,'expired');
 const noOptIn=trial({research_consent:false,consent_version:undefined});
 assert.equal(grade(noOptIn).feedback.correct,true);
 assert.equal(grade(noOptIn).evidence,null);
 assert.equal(grade(noOptIn).exclusion,'no-consent');
 assert.throws(()=>grade(t,'walk',{server_attempt_index:undefined}),/provenance/);
 assert.throws(()=>grade(t,'walk',{server_hints_used:undefined}),/provenance/);
 assert.throws(()=>grade(t,'walk',{server_answer_revealed:undefined}),/provenance/);
 assert.throws(()=>grade(t,'walk',{server_submitted_at:'2026-10-30T23:59:00Z'}),/predates/);
 assert.throws(()=>grade(t,'walk',{trial_id:randomUUID()}),/identity mismatch/);
});

test('UX43B invalid prompts, unreviewed translations, ambiguous flags and answer leakage fail closed',()=>{
 const invalid=[
  {prompt_curation_approved:false},
  {answer_hidden:false},
  {prompt_vi:'Hãy viết walk bằng tiếng Anh'},
  {accepted_english:['walk',' WALK ']},
  {accepted_english:[]},
  {accepted_english:['walk.']},
  {accepted_english:Array(9).fill('test')},
  {answer_revision:'untrusted revision #1'},
  {expires_at:'2026-10-31T01:00:00Z'},
  {expires_at:'2026-10-31T00:00:00Z'},
  {issued_at:'2026-10-31T00:00:00'},
  {source:'guest'},
  {consent_version:undefined},
  {research_consent:'yes'},
  {word_id:'not-an-id'}
 ];
 for(const options of invalid)
  assert.throws(()=>trial(options),undefined,JSON.stringify(options).slice(0,100));
});

test('UX43B supports personal cards, accepted curated aliases and Unicode apostrophes',()=>{
 const t=trial({
  source:'personal',
  word_id:randomUUID(),
  prompt_vi:'Đừng làm việc này',
  accepted_english:["don't do that"],
  answer_revision:'qa-2'
 });
 const outcome=grade(t,' Don’t   do that  ');
 assert.equal(outcome.evidence.result,'correct');
 assert.equal(outcome.evidence.source,'personal');
 assert.equal(outcome.evidence.response_latency,'5-15s');
 assert.deepEqual(outcome.feedback,{correct:true});
});

test('UX43B minimal evidence excludes raw responses, expected answers and learner-facing prompt',()=>{
 const t=trial();
 const out=grade(t,'a personally written answer string');
 assert.equal(out.evidence.result,'incorrect');
 const serialized=JSON.stringify(out);
 for(const secret of ['a personally written answer string','walk','Đi bộ','accepted_english','password','remembered'])
  assert.equal(serialized.includes(secret),false);
 assert.deepEqual(Object.keys(out).sort(),['evidence','exclusion','feedback']);
});

test('UX43B aggregate counts without exposing user or word IDs; rejects subjective or replayed evidence',()=>{
 const one=grade(trial(),'walk').evidence;
 const two=grade(trial({trial_id:randomUUID(),source:'personal',
  prompt_vi:'Đừng đi',accepted_english:["don't go"],
  answer_revision:'qa-3'}),'dont go').evidence;
 const summary=aggregateTypedRecallEvidence([one,two],{as_of:'2026-10-31T12:00:00Z'});
 assert.equal(summary.total_graded_events,2);
 assert.deepEqual(summary.outcomes,{correct:1,incorrect:1});
 assert.deepEqual(summary.source,{shared:1,personal:1});
 assert.equal(summary.latency['5-15s'],2);
 for(const secret of [USER,WORD,one.trial_id,two.trial_id,'Đi bộ','walk'])
  assert.equal(JSON.stringify(summary).includes(secret),false);
 assert.equal('retention_rate' in summary,false);
 assert.equal('accuracy' in summary,false);
 assert.match(summary.conclusion,/not long-term retention/);
 assert.throws(()=>aggregateTypedRecallEvidence([one,one],{as_of:'2026-10-31T12:00:00Z'}),/duplicate/);
 assert.throws(()=>aggregateTypedRecallEvidence([{remembered:true}],{as_of:'2026-10-31T12:00:00Z'}),/unverified/);
 assert.throws(()=>aggregateTypedRecallEvidence([{...one,first_attempt:false}],{as_of:'2026-10-31T12:00:00Z'}),/unverified/);
 assert.throws(()=>aggregateTypedRecallEvidence([{...one,consent_version:'none'}],{as_of:'2026-10-31T12:00:00Z'}),/unverified/);
 assert.throws(()=>aggregateTypedRecallEvidence([{...one,observed_at:'2026-11-01T00:00:00Z'}],{as_of:'2026-10-31T12:00:00Z'}),/snapshot/);
 assert.throws(()=>aggregateTypedRecallEvidence([one],{as_of:'2026-10-31T12:00:00'}),/timezone/);
});

test('UX43B cannot accidentally update v1 SRS, game scores or learner records',()=>{
 const src=readFileSync(new URL('../lib/ux43b-recall-evidence.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/from ['"].*(db|unified-review|srs-shadow|game\.js)/);
 assert.doesNotMatch(src,/UPDATE public|INSERT INTO|DELETE FROM|localStorage|fetch\(|process\.env/);
 assert.match(src,/No DB\/API\/SRS writes/);
});
