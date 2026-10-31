import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateSrsV1} from '../lib/srs-v1-audit.js';
import {rebuildSrsProjection} from '../lib/srs-projection.js';

const AS_OF='2026-10-31T12:00:00Z';
const a=(id,remembered,reviewed_at)=>({
 user_id:'alice',source:'shared',word_id:'shared-vocab-1',id,remembered,reviewed_at
});
const p=(id,remembered,reviewed_at)=>({
 user_id:'alice',source:'personal',word_id:'personal-vocab-1',id,remembered,reviewed_at
});
function fixture(){
 const events=[
  a('shared-1',true,'2026-10-01T00:00:00Z'),
  a('shared-2',true,'2026-10-01T01:00:00Z'), // early, due stays Oct 2
  a('shared-3',true,'2026-10-02T00:00:00Z'), // due, next Oct 5
  a('shared-4',false,'2026-10-06T00:00:00Z'), // >24h overdue
  p('personal-1',false,'2026-10-03T00:00:00Z'),
  p('personal-2',true,'2026-10-03T01:00:00Z')
 ];
 const progressRows=[
  {user_id:'alice',source:'shared',word_id:'shared-vocab-1',
   review_count:4,remembered:false,last_reviewed_at:'2026-10-06T00:00:00Z'},
  {user_id:'alice',source:'personal',word_id:'personal-vocab-1',
   review_count:2,remembered:true,last_reviewed_at:'2026-10-03T01:00:00Z'}
 ];
 const proj=rebuildSrsProjection(events.filter(e=>e.source==='shared'));
 const scheduleRows=[{user_id:'alice',source:'shared',word_id:'shared-vocab-1',...proj}];
 return {events,progressRows,scheduleRows,asOf:AS_OF};
}

test('UX43A reports v1 timing, subjective choices, parity and partial shadow explicitly',()=>{
 const r=evaluateSrsV1(fixture());
 assert.equal(r.policy,'ux24-fixed-v1');
 assert.equal(r.population.accounts_with_history,1);
 assert.equal(r.population.reviewed_cards,2);
 assert.equal(r.population.shared_events,4);
 assert.equal(r.population.personal_events,2);
 assert.equal(r.decisions.marked_remembered,4);
 assert.equal(r.decisions.marked_need_review,2);
 assert.deepEqual(r.timing,{
  first_review_events:2,repeat_review_events:4,
  before_due:1,at_or_after_due:3,more_than_24h_after_due:0,
  more_than_7d_after_due:0,early_remembered_preserved_due:1,
  same_instant_repeats:0
 });
 assert.deepEqual(r.current_reviewed_cards,{due:2,scheduled:0});
 assert.deepEqual(r.parity,{matched:2,mismatched:0});
 assert.deepEqual(r.progress,{matched:2,mismatched:0,missing:0,orphaned:0});
 assert.deepEqual(r.shadow,{matched:1,mismatched:0,missing:1,orphaned:0});
 assert.match(r.evidence,/not measured recall/);
 assert.match(r.verdict,/insufficient/);
});

test('UX43A is invariant to event row ordering and time-zone equivalent instants',()=>{
 const f=fixture(),expected=evaluateSrsV1(f);
 const shuffled={...f,events:[...f.events].reverse()};
 assert.deepEqual(evaluateSrsV1(shuffled),expected);
 const offset={...f,events:f.events.map(e=>({
  ...e,reviewed_at:new Date(e.reviewed_at).toISOString()
 }))};
 assert.deepEqual(evaluateSrsV1(offset),expected);
});

test('UX43A never conflates equal vocabulary UUIDs of different users and sources',()=>{
 const f=fixture();
 const event={user_id:'bob',source:'shared',word_id:'shared-vocab-1',
  id:'other-user-id',remembered:true,reviewed_at:'2026-10-11T00:00:00Z'};
 const r=evaluateSrsV1({...f,events:[...f.events,event]});
 assert.equal(r.population.accounts_with_history,2);
 assert.equal(r.population.reviewed_cards,3);
 assert.equal(r.progress.missing,1);
 assert.equal(r.shadow.missing,2);
 assert.equal(r.timing.first_review_events,3);
});

test('UX43A reports progress/shadow mismatches, missing and orphaned rows without repairing',()=>{
 const f=fixture();
 const r=evaluateSrsV1({...f,
  progressRows:[
   {...f.progressRows[0],review_count:7},
   {user_id:'alice',source:'shared',word_id:'unknown',
    remembered:true,review_count:1,last_reviewed_at:AS_OF}
  ],
  scheduleRows:[
   {...f.scheduleRows[0],interval_days:90},
   {user_id:'alice',source:'personal',word_id:'not-in-history',
    policy_version:'ux24-fixed-v1',review_count:1}
  ]
 });
 assert.deepEqual(r.progress,{matched:0,mismatched:1,missing:1,orphaned:1});
 assert.deepEqual(r.shadow,{matched:0,mismatched:1,missing:1,orphaned:1});
});

test('UX43A strict fail-closed behavior rejects duplicates and non-timezoned or future data',()=>{
 const f=fixture();
 assert.throws(()=>evaluateSrsV1({...f,events:[...f.events,f.events[0]]}),/duplicate/);
 assert.throws(()=>evaluateSrsV1({...f,events:[{...f.events[0],remembered:'true'}]}),/historical/);
 assert.throws(()=>evaluateSrsV1({...f,events:[{...f.events[0],reviewed_at:'2026-10-01T00:00:00'}]}),/timezone/);
 assert.throws(()=>evaluateSrsV1({...f,events:[{...f.events[0],reviewed_at:'2026-11-01T00:00:00Z'}]}),/future/);
 assert.throws(()=>evaluateSrsV1({...f,events:[{...f.events[0],source:'other'}]}),/identity/);
 assert.throws(()=>evaluateSrsV1({...f,progressRows:[f.progressRows[0],f.progressRows[0]]}),/duplicate/);
 assert.throws(()=>evaluateSrsV1({...f,asOf:'2026-10-31T12:00:00'}),/timezone/);
});

test('UX43A empty cohorts report zero evidence, never false success or fabricated retention',()=>{
 const r=evaluateSrsV1({asOf:AS_OF,events:[]});
 assert.equal(r.population.total_review_events,0);
 assert.equal(r.population.reviewed_cards,0);
 assert.deepEqual(r.parity,{matched:0,mismatched:0});
 assert.match(r.verdict,/insufficient/);
 assert.equal('retention_rate' in r,false);
 assert.equal('accuracy' in r,false);
});

test('UX43A aggregate output never exposes raw user/card/event IDs or password data',()=>{
 const r=evaluateSrsV1(fixture());
 const serialized=JSON.stringify(r);
 for(const privateValue of ['alice','shared-vocab-1','personal-vocab-1','shared-1','personal-2'])
  assert.equal(serialized.includes(privateValue),false);
 assert.doesNotMatch(serialized,/password_hash|email|user_id|word_id|english/);
});

test('UX43A remains bounded for long histories and avoids quadratic per-event replay',()=>{
 const events=Array.from({length:1200},(_,i)=>a('item-'+String(i).padStart(5,'0'),true,
  new Date(Date.parse('2021-01-01T00:00:00Z')+i*90*86400000).toISOString()));
 const result=evaluateSrsV1({events,asOf:'2350-01-01T00:00:00Z'});
 assert.equal(result.population.total_review_events,1200);
 assert.deepEqual(result.parity,{matched:1,mismatched:0});
 assert.equal(result.timing.repeat_review_events,1199);
});

test('UX43A local runner is bound to isolated PostgreSQL and rolls back QA writes',()=>{
 const script=readFileSync(new URL('../scripts/ux43a-srs-local-audit.mjs',import.meta.url),'utf8');
 assert.match(script,/target\.hostname!=='127\.0\.0\.1'/);
 assert.match(script,/target\.port!=='5547'/);
 assert.match(script,/target\.pathname!=='\/wordsky_v6_test'/);
 assert.match(script,/READ ONLY/);
 assert.match(script,/ROLLBACK/);
 assert.doesNotMatch(script,/COMMIT|process\.env\.SUPABASE_URL/);
 assert.match(script,/MAX_EVENTS|50001/);
 assert.doesNotMatch(script,/console\.log\([^)]*username|console\.log\([^)]*owner/);
});
