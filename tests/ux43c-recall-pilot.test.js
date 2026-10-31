import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recallPilotEnabled} from '../lib/ux43c-recall-service.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('UX43C must be enabled explicitly and cannot run in Production',()=>{
 assert.equal(recallPilotEnabled({}),false);
 assert.equal(recallPilotEnabled({WORDSKY_RECALL_PREVIEW_ENABLED:'true'}),true);
 assert.equal(recallPilotEnabled({VERCEL_ENV:'preview',WORDSKY_RECALL_PREVIEW_ENABLED:'true'}),true);
 assert.equal(recallPilotEnabled({VERCEL_ENV:'production',WORDSKY_RECALL_PREVIEW_ENABLED:'true'}),false);
 assert.equal(recallPilotEnabled({VERCEL_ENV:'production',WORDSKY_RECALL_PREVIEW_ENABLED:'false'}),false);
 assert.equal(recallPilotEnabled({WORDSKY_RECALL_PREVIEW_ENABLED:'TRUE'}),false);
});

test('UX43C only uses signed player identity and strict Origin, never client correctness',()=>{
 const api=read('../api/index.js'),service=read('../lib/ux43c-recall-service.js');
 for(const key of ['learning/recall/status','learning/recall/consent',
  'learning/recall/trials','learning/recall/submit'])
  assert.ok(api.includes("key==='"+key+"'"),key);
 assert.match(api,/const account=mustPlayer\(req\)/);
 assert.match(api,/req\.headers\?\.origin!==expected/);
 assert.match(service,/input\.expected_actor_id!==actor\.id/);
 assert.match(service,/SELECT session_version FROM public\.ws_users WHERE id=\$1 FOR UPDATE/);
 assert.match(service,/consented\(db,id\)/);
 assert.match(service,/server_attempt_index:1/);
 assert.match(service,/server_hints_used:false,server_answer_revealed:false/);
 assert.match(service,/if\(saved\.submitted_request_id!==input\.request_id\)/);
 assert.match(service,/gradeTypedRecallTrial\(trial,/);
 assert.match(service,/LIMIT 1/);
 assert.doesNotMatch(service,/input\.correct|input\.result|input\.answer_revision|input\.user_id/);
});

test('UX43C withdrawal cascades private records, and never modifies SRS or game scores',()=>{
 const service=read('../lib/ux43c-recall-service.js');
 const migration=read('../db/migrations/20261031_ux43c_typed_recall_pilot.sql');
 assert.match(service,/DELETE FROM public\.ws_recall_consents WHERE user_id=\$1/);
 assert.match(migration,/public\.ws_recall_consents\(user_id\)\s*\n\s*ON DELETE CASCADE/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.ws_recall_evidence/);
 assert.match(migration,/UNIQUE\(user_id,request_id\)/);
 assert.match(migration,/FOREIGN KEY \(user_id,trial_id\)/);
 for(const table of ['ws_recall_curated_prompts','ws_recall_consents',
  'ws_recall_trials','ws_recall_evidence']){
  assert.ok(migration.includes('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY'),table);
  assert.ok(migration.includes('public.'+table),table);
 }
 assert.match(migration,/REVOKE ALL ON TABLE/);
 assert.match(migration,/'anon','authenticated'/);
 assert.doesNotMatch(migration,/CREATE POLICY|GRANT ALL|GRANT SELECT/i);
 assert.doesNotMatch(service,/UPDATE public\.ws_learning|ws_user_srs_schedules|ws_solo_runs|ws_checkins|UPDATE public\.ws_users SET/);
});

test('UX43C UI requires explicit opt-in and includes withdrawal & mobile shared nav',()=>{
 const html=read('../public/recall.html');
 const js=read('../public/recall.js');
 const css=read('../public/recall.css');
 for(const id of ['ws43cOptIn','ws43cConsentCheck','ws43cAgree','ws43cWithdraw',
 'ws43cWithdrawCheck','ws43cAnswerForm','ws43cAnswer','ws43cSubmit','ws43cResult'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/data-ws-page="progress"/);
 assert.match(html,/shared-nav\.js/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(js,/expected_actor_id:actor/);
 assert.match(js,/crypto\.randomUUID\(\)/);
 assert.match(js,/replayed/);
 assert.match(js,/requestId/);
 assert.match(js,/confirm_withdraw:true/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|sendBeacon|console\.log\(|innerHTML/);
});

test('UX43C research prompt catalog never auto-promotes words or past remembered decisions',()=>{
 const migration=read('../db/migrations/20261031_ux43c_typed_recall_pilot.sql');
 const service=read('../lib/ux43c-recall-service.js');
 assert.match(migration,/approved boolean NOT NULL DEFAULT false/);
 assert.match(migration,/active boolean NOT NULL DEFAULT false/);
 assert.match(service,/p\.approved=true AND p\.active=true/);
 assert.match(service,/accepted_english\.some/);
 assert.match(service,/MAX_TRIALS_PER_DAY=25/);
 assert.doesNotMatch(service,/recordUnifiedReview|remembered:|SRS_INTERVAL_DAYS|syncFinishedSoloReview/);
});
