import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 UX43D_AUDIT_VERSION,auditCuratedPromptCatalog,auditUx43cEvidenceReadiness
} from '../lib/ux43d-curation-readiness.js';

const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const catalog=[
 {id:uuid(1),english:'walk',enabled:true,topic_enabled:true},
 {id:uuid(2),english:'run',enabled:true,topic_enabled:true},
 {id:uuid(3),english:'sleep',enabled:true,topic_enabled:true},
 {id:uuid(4),english:'read',enabled:false,topic_enabled:true}
];
const prompt=(id,wordId,promptVi,acceptedEnglish,extra={})=>({
 id:uuid(id),word_id:uuid(wordId),prompt_vi:promptVi,
 accepted_english:[acceptedEnglish],answer_revision:'review-1',
 approved:true,active:true,curator:'owner',...extra
});
const prompts=[
 prompt(11,1,'Đi bộ','walk'),
 prompt(12,2,'Chạy','run'),
 prompt(13,3,' CHẠY ','sleep'),
 prompt(14,3,'Ngủ','nap'),
 prompt(15,1,'Tiến bước','walk',{active:false}),
 prompt(16,4,'Đọc','read')
];

test('UX43D reports lexical eligibility and corpus-level ambiguity without approving records',()=>{
 const result=auditCuratedPromptCatalog({vocabulary:catalog,prompts});
 assert.equal(result.version,UX43D_AUDIT_VERSION);
 assert.deepEqual(result.population,{
  catalog_words:4,enabled_words:3,reviewed_prompt_records:6,
  active_approved_records:5,inactive_or_unapproved_records:1,
  lexically_eligible_records:1,lexically_blocked_records:4,
  lexically_eligible_distinct_words:1,enabled_words_without_eligible_prompt:2
 });
 assert.equal(result.blocked_by_reason.ambiguous_shared_cue,2);
 assert.equal(result.blocked_by_reason.duplicate_active_word,2);
 assert.equal(result.blocked_by_reason.catalog_answer_missing,1);
 assert.equal(result.blocked_by_reason.missing_or_disabled_word,1);
 assert.equal(result.human_semantic_review_required,true);
 assert.equal(result.verified_bilingual_meaning_equivalence,false);
 assert.equal(result.authorized_to_activate_prompts,false);
 assert.match(result.conclusion,/never auto-approve/);
});

test('UX43D does not treat simple catalog membership as automatic human approval',()=>{
 const results=auditCuratedPromptCatalog({
  vocabulary:catalog,
  prompts:[
   prompt(21,1,'Đi bộ','walk',{approved:false}),
   prompt(22,2,'Chạy','run',{active:false}),
   prompt(23,3,'Ngủ','sleep',{curator:'not-owner'})
  ]
 });
 assert.equal(results.population.active_approved_records,1);
 assert.equal(results.population.lexically_eligible_records,0);
 assert.equal(results.population.inactive_or_unapproved_records,2);
 assert.equal(results.blocked_by_reason.untrusted_curator,1);
});

test('UX43D rejects exposed English, duplicate variants, uncurated phrasing and stale English',()=>{
 const bad=[
  prompt(31,1,'Đi bộ (walk)','walk'),
  prompt(32,1,'Đi bộ','walk',{accepted_english:['walk',' WALK ']}),
  prompt(33,1,'Đi bộ','walk',{accepted_english:['wolk']}),
  prompt(34,1,'Đi bộ','walk',{accepted_english:['walk.']}),
  prompt(35,1,'Đi bộ','walk',{answer_revision:'bad revision #'}),
  prompt(36,1,' ','walk')
 ];
 for(const row of bad){
  const out=auditCuratedPromptCatalog({vocabulary:catalog,prompts:[row]});
  assert.equal(out.population.lexically_eligible_records,0,row.id);
  assert.equal(out.population.lexically_blocked_records,1,row.id);
 }
 const exposed=auditCuratedPromptCatalog({vocabulary:catalog,prompts:[bad[0]]});
 assert.equal(exposed.blocked_by_reason.invalid_prompt_or_variants,1);
 const unmatched=auditCuratedPromptCatalog({vocabulary:catalog,prompts:[bad[2]]});
 assert.equal(unmatched.blocked_by_reason.catalog_answer_missing,1);
});

test('UX43D detects multiple active versions of the same word even when cues differ',()=>{
 const report=auditCuratedPromptCatalog({
  vocabulary:catalog,
  prompts:[
   prompt(41,1,'Bước đi','walk',{answer_revision:'v1'}),
   prompt(42,1,'Đi bộ','walk',{answer_revision:'v2'})
  ]
 });
 assert.equal(report.blocked_by_reason.duplicate_active_word,2);
 assert.equal(report.population.lexically_eligible_records,0);
});

test('UX43D stable aggregate report cannot disclose individual words or prompt identifiers',()=>{
 const a=auditCuratedPromptCatalog({vocabulary:catalog,prompts});
 const b=auditCuratedPromptCatalog({vocabulary:[...catalog].reverse(),prompts:[...prompts].reverse()});
 assert.deepEqual(a,b);
 const serialized=JSON.stringify(a);
 for(const secret of ['walk','sleep','Chạy','Đi bộ',uuid(1),uuid(11),'not-owner'])
  assert.equal(serialized.includes(secret),false,secret);
 assert.doesNotMatch(serialized,/word_id|prompt_vi|accepted_english/);
 assert.throws(()=>auditCuratedPromptCatalog({
  vocabulary:catalog,prompts:[prompts[0],prompts[0]]
 }),/duplicate prompt ID/);
 assert.throws(()=>auditCuratedPromptCatalog({
  vocabulary:[catalog[0],catalog[0]],prompts:[]
 }),/duplicate catalog/);
 assert.throws(()=>auditCuratedPromptCatalog({
  vocabulary:catalog,prompts:[{...prompts[0],word_id:'not-an-id'}]
 }),/invalid prompt word ID/);
 assert.throws(()=>auditCuratedPromptCatalog({vocabulary:catalog,prompts:null}),/invalid or oversized/);
});

const e=(n,actor,word,result,observed,extra={})=>({
 trial_id:uuid(n),user_id:uuid(actor),word_id:uuid(word),
 request_id:uuid(n+1000),answer_revision:'qa-v1',
 prompt_kind:'vi-to-en-typed',
 result,response_latency:'5-15s',
 consent_version:'ux43b-opt-in-v1',
 observed_at:observed,...extra
});
const evidence=[
 e(101,501,1,'correct','2026-10-01T00:00:00Z'),
 e(102,501,1,'incorrect','2026-10-10T00:00:00Z'),
 e(103,502,2,'incorrect','2026-10-05T00:00:00Z')
];
const audit=rows=>auditUx43cEvidenceReadiness({
 events:rows,as_of:'2026-10-31T12:00:00Z'
});

test('UX43D evaluates actual persisted UX43C evidence columns, not prototype-only fields',()=>{
 const result=audit(evidence);
 assert.equal(result.version,UX43D_AUDIT_VERSION);
 assert.deepEqual(result.observations,{
  total:3,accounts:2,words:2,unique_account_word_pairs:2,
  first_account_word_observations:2,
  repeat_account_word_observations:1,
  repeats_separated_by_at_least_7d:1,
  outcomes:{correct:1,incorrect:2},
  latency_buckets:{'under-1s':0,'1-5s':0,'5-15s':3,'15-60s':0,'60s-plus':0}
 });
 assert.equal(result.privacy.small_cohort_do_not_publish,true);
 assert.equal(result.valid_to_estimate_long_term_retention,false);
 assert.equal(result.valid_to_compare_srs_v2_effectiveness,false);
 assert.ok(result.missing_required_evaluation_evidence.includes('randomized-or-identified-policy-assignment'));
 assert.match(result.conclusion,/not retention/);
 assert.deepEqual(audit([...evidence].reverse()),result);
});

test('UX43D refuses fabricated evidence, replay duplicates and unstated timezones',()=>{
 assert.throws(()=>audit([evidence[0],evidence[0]]),/duplicate/);
 assert.throws(()=>audit([evidence[0],{...evidence[1],request_id:evidence[0].request_id}]),/duplicate/);
 assert.throws(()=>audit([e(1,501,1,'wrong','2026-10-01T00:00:00Z')]),/unconsented/);
 assert.throws(()=>audit([e(1,501,1,'correct','2026-10-01T00:00:00Z',{consent_version:'none'})]),/unconsented/);
 assert.throws(()=>audit([e(1,501,1,'correct','2026-10-01T00:00:00Z',{prompt_kind:'unknown'})]),/unconsented/);
 assert.throws(()=>audit([e(1,501,1,'correct','2026-10-01T00:00:00Z',{response_latency:'25ms'})]),/unconsented/);
 assert.throws(()=>audit([e(1,501,1,'correct','2026-10-01T00:00:00')]),/timezone/);
 assert.throws(()=>audit([e(1,501,1,'correct','2026-11-01T00:00:00Z')]),/snapshot/);
 assert.throws(()=>audit([e(1,501,1,'correct','2026-10-01T00:00:00Z',{typed_answer:'walk'})]),/raw private data/);
 assert.throws(()=>auditUx43cEvidenceReadiness({events:[],as_of:'2026-10-31T12:00:00Z',min_public_accounts:1}),/threshold/);
});

test('UX43D empty private cohort never suggests v2 is ready',()=>{
 const report=audit([]);
 assert.equal(report.observations.total,0);
 assert.equal(report.privacy.small_cohort_do_not_publish,true);
 assert.equal(report.valid_to_compare_srs_v2_effectiveness,false);
 assert.equal('estimated_retention' in report,false);
 assert.equal('model_accuracy' in report,false);
 const serialized=JSON.stringify(audit(evidence));
 for(const secret of [uuid(501),uuid(502),uuid(101),uuid(1)])
  assert.equal(serialized.includes(secret),false);
});

test('UX43D offline QA imports neither database access nor live SRS mutation paths',()=>{
 const source=readFileSync(new URL('../lib/ux43d-curation-readiness.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/from ['"].*(db|srs-schedule|srs-projection|unified-review|game\.js)/);
 assert.doesNotMatch(source,/UPDATE public|INSERT INTO|DELETE FROM|fetch\(|process\.env|localStorage|sessionStorage/);
 assert.match(source,/OFFLINE ONLY/);
});
