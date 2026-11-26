import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeDailyReviewActivity} from '../lib/daily-review-activity.js';
import {validateDailyActivity} from '../public/ux58-daily-plan-core.js';

const actor='12345678-1234-4234-8234-123456789abc';
const today='2026-11-19',asOf='2026-11-19T07:20:00.000Z';
const make=(rows,day=today)=>summarizeDailyReviewActivity({actorId:actor,today:day,asOf,rows});

test('UX58 M3: confirmed reviews today and unique word count, not a mastery claim',()=>{
 const x=make([{day:today,reviews:4,unique_words:2},{day:'2026-11-18',reviews:1,unique_words:1}]);
 assert.equal(x.reviews_today,4);
 assert.equal(x.unique_words_today,2);
 assert.equal(x.streak_days,2);
 assert.equal(x.completed_goal,null);
 assert.equal(x.streak_ends_on,today);
 assert.equal(x.time_zone,'Asia/Ho_Chi_Minh');
 assert.equal(validateDailyActivity(x,actor),x);
 assert.ok(Object.isFrozen(x));
});

test('UX58 M3: yesterday still counts as an active streak before the first review today',()=>{
 const x=make([{day:'2026-11-18',reviews:3,unique_words:2},{day:'2026-11-17',reviews:1,unique_words:1}]);
 assert.equal(x.reviews_today,0);assert.equal(x.streak_days,2);
 assert.equal(x.streak_ends_on,'2026-11-18');
});

test('UX58 M3: missing yesterday or today breaks streak, no invented local-day activity',()=>{
 assert.equal(make([{day:'2026-11-17',reviews:1,unique_words:1}]).streak_days,0);
 assert.equal(make([]).streak_days,0);
 assert.equal(make([]).reviews_today,0);
 assert.equal(make([{day:today,reviews:1,unique_words:1},{day:'2026-11-17',reviews:1,unique_words:1}]).streak_days,1);
});

test('UX58 M3: Vietnam calendar boundary and leap year consecutive days',()=>{
 const a=make([{day:'2024-03-01',reviews:1,unique_words:1},{day:'2024-02-29',reviews:1,unique_words:1},{day:'2024-02-28',reviews:2,unique_words:1}],'2024-03-01');
 assert.equal(a.streak_days,3);
 const b=make([{day:'2027-01-01',reviews:1,unique_words:1},{day:'2026-12-31',reviews:1,unique_words:1}],'2027-01-01');
 assert.equal(b.streak_days,2);
});

test('UX58 M3: invalid, duplicated and future days fail closed',()=>{
 for(const rows of [
  [{day:today,reviews:0,unique_words:0}],
  [{day:today,reviews:1,unique_words:2}],
  [{day:today,reviews:1,unique_words:1},{day:today,reviews:1,unique_words:1}],
  [{day:'2026-11-20',reviews:1,unique_words:1}],
  [{day:'2026-02-30',reviews:1,unique_words:1}],
  [{day:today,reviews:-1,unique_words:1}]
 ])assert.throws(()=>make(rows));
 assert.throws(()=>make([{day:today,reviews:1,unique_words:1}], '2026-02-30'));
});

test('UX58 M3: bounded history marks 366-day streak as capped, not falsely exact',()=>{
 const rows=Array.from({length:366},(_,i)=>{
  const d=new Date('2026-11-19T00:00:00Z');d.setUTCDate(d.getUTCDate()-i);
  return {day:d.toISOString().slice(0,10),reviews:1,unique_words:1};
 });
 const a=make(rows);assert.equal(a.streak_days,366);assert.equal(a.streak_capped,true);
 assert.throws(()=>make([...rows,rows[0]]));
});

test('UX58 M3: client rejects wrong actor and invalid activity without displaying cross-account streak',()=>{
 const x=make([{day:today,reviews:1,unique_words:1}]);
 assert.throws(()=>validateDailyActivity(x,'someone-else'));
 assert.throws(()=>validateDailyActivity({...x,reviews_today:-2},actor));
 assert.throws(()=>validateDailyActivity({...x,time_zone:'UTC'},actor));
 assert.throws(()=>validateDailyActivity({...x,completed_goal:7},actor));
});

test('UX58 M3: endpoint is gated, authenticated and read only; UI has single practice button',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const lib=readFileSync(new URL('../lib/daily-review-activity.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8');
 assert.match(api,/key==='learning\/daily-activity'/);
 assert.match(api,/getAccountDailyReviewActivity\(mustPlayer\(req\)\.id\)/);
 assert.match(api,/if\(!srsEnabled\(\)\)return output\(res,404/);
 assert.match(lib,/ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(lib,/Asia\/Ho_Chi_Minh/);
 assert.equal((page.match(/id="ws24Practice"/g)||[]).length,1);
 assert.match(ui,/nextActivity=validateDailyActivity\\(result,expectedActorId\\)/);
 assert.match(ui,/const verified=await learningApi\\('auth\\/me'\\)/);
 assert.match(ui,/verified\\.actor\\.id!==expectedActorId/);
 assert.match(ui,/activityBox.hidden=true/);
});
