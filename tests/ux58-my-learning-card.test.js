import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dailyPlanFromSrsQueue} from '../public/ux58-daily-plan-core.js';

const actor='12345678-1234-4234-8234-123456789abc';
const payload=()=>({
 scope:'account-srs',actor_id:actor,
 status:'due',topic:'School',page:2,size:20,total:3,
 summary:{due:27,new:14,upcoming:8,total:49},
 words:[]
});
test('UX58 M2: global summary wins over paginated topic count',()=>{
 const p=dailyPlanFromSrsQueue(payload(),actor);
 assert.deepEqual(p.tasks.map(x=>[x.available,x.planned]),[[27,10],[14,10]]);
 assert.equal(p.totalPlanned,20);
 assert.equal(p.upcoming,8);
 assert.equal(p.completed,null);
 assert.equal(p.streak,null);
});
test('UX58 M2: no other account can read plan',()=>{
 assert.throws(()=>dailyPlanFromSrsQueue(payload(),'other-account'),/khớp tài khoản/);
 assert.throws(()=>dailyPlanFromSrsQueue({...payload(),actor_id:null},actor),/khớp tài khoản/);
 assert.throws(()=>dailyPlanFromSrsQueue({...payload(),scope:'catalog'},actor),/khớp tài khoản/);
});
test('UX58 M2: mismatched or invalid global summary fails closed',()=>{
 const p=payload();
 for(const summary of [
  null,{}, {...p.summary,total:1}, {...p.summary,due:-1},
  {...p.summary,new:NaN},{...p.summary,upcoming:2.4}
 ])assert.throws(()=>dailyPlanFromSrsQueue({...p,summary},actor));
});
test('UX58 M2: zero queue is honest, no streak or inferred completed activity',()=>{
 const p=dailyPlanFromSrsQueue({...payload(),summary:{due:0,new:0,upcoming:0,total:0}},actor);
 assert.equal(p.totalPlanned,0);assert.equal(p.hasWork,false);
 assert.equal(p.completed,null);assert.equal(p.streak,null);
});
test('UX58 M2: daily card stays under existing SRS gate and uses single Luyện từ button',()=>{
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8');
 assert.match(html,/<section class="ws24-panel" id="ws24Srs"[^>]*hidden>/);
 assert.match(html,/<section class="ws58-daily" id="ws58DailyPlan"[^>]*hidden>/);
 assert.equal((html.match(/id="ws24Practice"/g)||[]).length,1);
 assert.equal((html.match(/id="ws58DailyPlan"/g)||[]).length,1);
 assert.match(js,/dailyPlanFromSrsQueue\(data,actorId\)/);
 assert.match(js,/daily.hidden=true/);
 assert.match(js,/if\(!data\|\|pending\|\|!actorId\)return/);
 assert.doesNotMatch(html,/id="ws58Practice"/);
});
