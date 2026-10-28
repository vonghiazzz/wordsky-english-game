import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {srsEnabled,srsScheduleWritesEnabled} from '../lib/srs-release-gates.js';
import {srsShadowEnabled} from '../lib/srs-shadow.js';
import {planAccountSrsBackfill} from '../lib/srs-backfill.js';
import {rebuildSrsProjection} from '../lib/srs-projection.js';

const word='11111111-1111-4111-8111-111111111111';
const pword='22222222-2222-4222-8222-222222222222';
const evt={id:'33333333-3333-4333-8333-333333333333',word_id:word,
 remembered:true,reviewed_at:'2026-10-27T07:00:00Z'};
const personal={id:'44444444-4444-4444-8444-444444444444',personal_word_id:pword,
 remembered:false,reviewed_at:'2026-10-27T07:03:00Z'};
const progress=[
 {source:'shared',word_id:word,review_count:1},
 {source:'personal',word_id:pword,review_count:1}
];
test('UX24E Production requires BOTH explicit release flags; Preview flags cannot unlock it',()=>{
 const prod={VERCEL_ENV:'production',WORDSKY_SRS_PREVIEW_ENABLED:'true',WORDSKY_SRS_SHADOW_ENABLED:'true'};
 for(const env of [prod,{...prod,WORDSKY_SRS_PRODUCTION_ENABLED:'true'},
  {...prod,WORDSKY_SRS_PRODUCTION_SHADOW_ENABLED:'true'}]){
  assert.equal(srsEnabled(env),false);
  assert.equal(srsScheduleWritesEnabled(env),false);
  assert.equal(srsShadowEnabled(env),false);
 }
 const release={...prod,WORDSKY_SRS_PRODUCTION_ENABLED:'true',
  WORDSKY_SRS_PRODUCTION_SHADOW_ENABLED:'true'};
 assert.equal(srsEnabled(release),true);
 assert.equal(srsScheduleWritesEnabled(release),true);
 assert.equal(srsShadowEnabled(release),true);
 assert.equal(srsEnabled({...release,WORDSKY_SRS_PRODUCTION_SHADOW_ENABLED:'TRUE'}),false);
 assert.equal(srsEnabled({VERCEL_ENV:'preview',WORDSKY_SRS_PREVIEW_ENABLED:'true'}),true);
 assert.equal(srsScheduleWritesEnabled({VERCEL_ENV:'preview',WORDSKY_SRS_SHADOW_ENABLED:'true'}),true);
 assert.equal(srsEnabled({}),false);
});
test('UX24E backfill plans source-separated missing words from complete accepted histories',()=>{
 const plan=planAccountSrsBackfill({shared:[evt],personal:[personal],progress});
 assert.equal(plan.status,'partial');
 assert.equal(plan.historical_words,2);
 assert.equal(plan.ready_to_insert,2);
 assert.equal(plan.pending.find(x=>x.source==='shared').due_at,'2026-10-28T07:00:00.000Z');
 assert.equal(plan.pending.find(x=>x.source==='personal').interval_days,0);
 assert.equal(plan.pending.find(x=>x.source==='personal').remembered,false);
});
test('UX24E accepts matching prior shadow but never overwrites an existing mismatch',()=>{
 const previous={source:'shared',word_id:word,...rebuildSrsProjection([evt])};
 const plan=planAccountSrsBackfill({shared:[evt],personal:[personal],progress,
  schedules:[previous]});
 assert.equal(plan.matched,1);
 assert.equal(plan.ready_to_insert,1);
 assert.equal(plan.pending[0].source,'personal');
 assert.throws(()=>planAccountSrsBackfill({shared:[evt],personal:[personal],progress,
  schedules:[{...previous,review_count:3}]}),error=>error.status===409);
 assert.throws(()=>planAccountSrsBackfill({shared:[],personal:[],progress:[],
  schedules:[previous]}),error=>error.status===409);
});
test('UX24E refuses progress/history gaps, fabricated counts, and duplicates',()=>{
 assert.throws(()=>planAccountSrsBackfill({shared:[evt],progress:[]}),error=>error.status===503);
 assert.throws(()=>planAccountSrsBackfill({shared:[],progress:[progress[0]]}),error=>error.status===503);
 assert.throws(()=>planAccountSrsBackfill({shared:[evt],progress:[
  {...progress[0],review_count:2}]}),error=>error.status===503);
 assert.throws(()=>planAccountSrsBackfill({shared:[evt],progress:[
  progress[0],progress[0]]}),error=>error.status===503);
 assert.throws(()=>planAccountSrsBackfill({shared:[evt,evt],progress:[
  {...progress[0],review_count:2}]}),/Duplicate/);
});
test('UX24E Preview CLI cannot write Production and dry-run is default',()=>{
 const script=readFileSync(new URL('../scripts/preview-backfill-srs.mjs',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const gates=readFileSync(new URL('../lib/srs-release-gates.js',import.meta.url),'utf8');
 assert.match(script,/VERIFIED_PREVIEW_REF='zbdnvvvdjxmdurucfjpe'/);
 assert.match(script,/process\.env\.VERCEL_ENV==='production'/);
 assert.match(script,/const apply=args\.has\('--apply'\)/);
 assert.match(script,/process\.env\.VERCEL_ENV='preview'/);
 assert.match(api,/if\(!srsEnabled\(\)\)/);
 assert.equal((api.match(/if\(!srsEnabled\(\)\)/g)||[]).length,2);
 assert.doesNotMatch(gates,/WORDSKY_SRS_PREVIEW_ENABLED==='true'\)\s*return true/);
});
