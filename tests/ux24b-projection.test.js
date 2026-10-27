import test from 'node:test';
import assert from 'node:assert/strict';
import {
 SRS_POLICY_VERSION,projectAcceptedSrsEvent,rebuildSrsProjection,compareSrsProjection
} from '../lib/srs-projection.js';

const UTC='2026-10-27T00:00:00Z';
const event=(id,remembered,date=UTC)=>({id,remembered,reviewed_at:date});

test('UX24B first accepted review, forget, and due success match whole-history SRS',()=>{
 const history=[
  event('01',true,UTC),
  event('02',true,'2026-10-28T00:00:00Z'),
  event('03',false,'2026-10-28T01:00:00Z'),
  event('04',true,'2026-10-28T01:01:00Z')
 ];
 const result=compareSrsProjection(history,{now:'2026-10-28T02:00:00Z'});
 assert.equal(result.matches,true);
 assert.equal(result.projection.policy_version,SRS_POLICY_VERSION);
 assert.equal(result.projection.review_count,4);
 assert.equal(result.projection.consecutive_remembered,1);
 assert.equal(result.projection.interval_days,1);
 assert.equal(result.projection.due_at,'2026-10-29T01:01:00.000Z');
});

test('UX24B clicking remembered early cannot extend due time despite incrementing history count',()=>{
 const first=projectAcceptedSrsEvent(null,event('a',true));
 const repeat=projectAcceptedSrsEvent(first,event('b',true,'2026-10-27T00:10:00Z'));
 assert.equal(repeat.review_count,2);
 assert.equal(repeat.consecutive_remembered,1);
 assert.equal(repeat.due_at,first.due_at);
 assert.equal(compareSrsProjection([
  event('a',true),event('b',true,'2026-10-27T00:10:00Z')
 ]).matches,true);
});

test('UX24B replay does not advance schedule; reject identical or backward events',()=>{
 const once=projectAcceptedSrsEvent(null,event('a',true));
 assert.throws(()=>projectAcceptedSrsEvent(once,event('a',true)),/duplicate or not/);
 assert.throws(()=>projectAcceptedSrsEvent(once,event('0',false)),/duplicate or not/);
 assert.throws(()=>projectAcceptedSrsEvent(once,event('z',false,'2026-10-26T23:00:00Z')),/duplicate or not/);
 assert.equal(once.review_count,1);
});

test('UX24B policy version mismatch fails closed instead of corrupting a schedule',()=>{
 const one=projectAcceptedSrsEvent(null,event('a',true));
 assert.throws(()=>projectAcceptedSrsEvent({...one,policy_version:'another-policy'},
   event('b',false,'2026-10-28T00:00:00Z')),/policy version/);
 assert.throws(()=>projectAcceptedSrsEvent({...one,consecutive_remembered:999},
   event('b',false,'2026-10-28T00:00:00Z')),/invalid/);
 assert.throws(()=>projectAcceptedSrsEvent(null,event('bad',true,'2026-10-27T07:00:00')),/timezone/);
});

test('UX24B sorted replay handles equivalent offsets, duplicate ids and same-time tie break',()=>{
 const source=[
  event('c',true,'2026-10-27T08:00:00+07:00'),
  event('b',false,'2026-10-27T01:00:00Z'),
  event('a',true,UTC)
 ];
 const sorted=rebuildSrsProjection(source);
 const shuffled=rebuildSrsProjection([...source].reverse());
 assert.deepEqual(sorted,shuffled);
 assert.equal(compareSrsProjection(source).matches,true);
 assert.equal(sorted.last_event_id,'c');
 assert.equal(sorted.remembered,true);
 assert.throws(()=>rebuildSrsProjection([event('a',true),event('a',false)]),/Duplicate/);
 assert.equal(compareSrsProjection([]).matches,true);
});

test('UX24B repeated deterministic mixed history stays equivalent to full recomputation',()=>{
 const patterns=[true,true,true,false,true,true,true,true,false,true];
 for(let n=1;n<=80;n++){
  const history=Array.from({length:n},(_,i)=>event(
   String(i+1).padStart(4,'0'),
   patterns[(i*7+Math.floor(i/3))%patterns.length],
   new Date(Date.parse(UTC)+i*12*3600*1000).toISOString()
  ));
  const result=compareSrsProjection(history,{now:'2026-11-01T00:00:00Z'});
  assert.equal(result.matches,true,'mismatch at history length '+n);
 }
});

test('UX24B backfill must use complete events rather than synthesizing a success streak from review_count',()=>{
 const history=[event('a',true),event('b',false,'2026-10-28T00:00:00Z'),
  event('c',true,'2026-10-28T00:01:00Z')];
 const projected=rebuildSrsProjection(history);
 assert.equal(projected.review_count,3);
 assert.equal(projected.consecutive_remembered,1);
 assert.notEqual(projected.consecutive_remembered,projected.review_count);
});
