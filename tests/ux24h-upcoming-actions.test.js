import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {srsActionLabels} from '../public/ux24-srs-panel.js';
import {computeSrsState} from '../lib/srs-schedule.js';

test('UX24H Upcoming has distinct early-review actions',()=>{
 assert.deepEqual(srsActionLabels('scheduled'),[
  ['↻ Cần ôn ngay',false],
  ['✓ Ôn sớm (giữ nguyên lịch)',true]
 ]);
 for(const status of ['due','new']){
  assert.deepEqual(srsActionLabels(status),[
   ['✓ Đã nhớ',true],['↻ Cần ôn',false]
  ]);
 }
});

test('UX24H early remembered review preserves the due date',()=>{
 const a={
  id:'11111111-1111-4111-8111-111111111111',
  remembered:true,
  reviewed_at:'2026-10-27T08:00:00Z'
 };
 const b={
  id:'22222222-2222-4222-8222-222222222222',
  remembered:true,
  reviewed_at:'2026-10-27T09:00:00Z'
 };
 const now='2026-10-27T10:00:00Z';
 const initial=computeSrsState([a],{now});
 const early=computeSrsState([a,b],{now});

 assert.equal(initial.status,'scheduled');
 assert.equal(early.status,'scheduled');
 assert.equal(early.due_at,initial.due_at);
 assert.equal(early.interval_days,initial.interval_days);
 assert.equal(early.consecutive_remembered,
  initial.consecutive_remembered);
 assert.equal(early.review_count,2);

 const needReview=computeSrsState(
  [a,{...b,remembered:false}],{now}
 );
 assert.equal(needReview.status,'due');
 assert.equal(needReview.interval_days,0);
});

test('UX24H UI uses scheduled-specific copy and labels',()=>{
 const src=readFileSync(
  new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8'
 );
 const css=readFileSync(
  new URL('../public/ux24-srs-panel.css',import.meta.url),'utf8'
 );
 assert.match(src,/srsActionLabels\(word\.status\)/);
 assert.match(src,/word\.status==='scheduled'&&remembered/);
 assert.match(src,/ws24-early-hint/);
 assert.match(css,/\.ws24-early-hint/);
});
