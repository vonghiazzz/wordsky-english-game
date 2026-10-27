import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {srsShadowEnabled} from '../lib/srs-shadow.js';

test('UX24B schedule shadow remains off by default and cannot enable on Production',()=>{
 assert.equal(srsShadowEnabled({}),false);
 assert.equal(srsShadowEnabled({VERCEL_ENV:'production',
  WORDSKY_SRS_SHADOW_ENABLED:'true'}),false);
 assert.equal(srsShadowEnabled({VERCEL_ENV:'preview',
  WORDSKY_SRS_SHADOW_ENABLED:'true'}),true);
 assert.equal(srsShadowEnabled({WORDSKY_SRS_SHADOW_ENABLED:'true'}),true);
 assert.equal(srsShadowEnabled({VERCEL_ENV:'preview',
  WORDSKY_SRS_SHADOW_ENABLED:'TRUE'}),false);
});

test('UX24B migration enables RLS, denies data API access, and supports per-account due lookups',()=>{
 const sql=readFileSync(new URL('../db/migrations/20261027_ux24b_shadow_srs_schedules.sql',import.meta.url),'utf8');
 assert.match(sql,/PRIMARY KEY \(user_id,source,word_id\)/);
 assert.match(sql,/ws_user_srs_schedules \(user_id,due_at,source,word_id\)/);
 assert.match(sql,/ALTER TABLE public\.ws_user_srs_schedules ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.ws_user_srs_schedules FROM PUBLIC/);
 assert.match(sql,/\['anon','authenticated'\]/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE ws_learning_word_progress/);
});

test('UX24B account shadow transaction never materializes on a replay, stale request, or failed review',()=>{
 const service=readFileSync(new URL('../lib/unified-review.js',import.meta.url),'utf8');
 const replay=service.indexOf('if(!claim.rows.length){');
 const conflict=service.indexOf('if(request.expected_review_count!==null){');
 const shadow=service.indexOf('if(srsShadowEnabled())');
 const commit=service.indexOf("return {scope:'account-review'",shadow);
 assert.ok(replay>=0&&conflict>replay&&shadow>conflict&&commit>shadow);
 assert.match(service,/await writeSrsShadowSchedule\(db,\{userId,source:request\.source,wordId:request\.word_id\}\)/);
 assert.match(service,/clock_timestamp\(\)/);
});
