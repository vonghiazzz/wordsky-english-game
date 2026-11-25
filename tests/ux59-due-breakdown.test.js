import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dueBreakdownFromQueue} from '../lib/srs-queue.js';
import {srsDueBreakdown,srsReviewCards} from '../public/ux24-srs-panel.js';

const actor='12345678-1234-4234-8234-123456789abc';
const base=()=>({
 scope:'account-srs',actor_id:actor,status:'due',topic:'',
 page:0,total:2,total_pages:1,topics:[],words:[],
 summary:{due:4,upcoming:1,new:2,total:7},
 due_breakdown:{overdue:2,today:2}
});

test('UX59.4 counts whole due queue before pagination and never counts new/upcoming',()=>{
 const whole=[{status:'due',overdue_days:5},{status:'due',overdue_days:1},
  {status:'due',overdue_days:0},{status:'due',overdue_days:0}];
 assert.deepEqual(dueBreakdownFromQueue(whole),{overdue:2,today:2});
 assert.deepEqual(dueBreakdownFromQueue([]),{overdue:0,today:0});
 assert.throws(()=>dueBreakdownFromQueue([{status:'scheduled',overdue_days:0}]));
 assert.throws(()=>dueBreakdownFromQueue([{status:'due',overdue_days:-1}]));
});

test('UX59.4 validates counts from the same account and rejects inconsistent global due totals',()=>{
 const p=base();
 assert.deepEqual(srsDueBreakdown(p),{overdue:2,today:2});
 assert.equal(srsReviewCards(p,actor),p);
 assert.throws(()=>srsReviewCards(p,'another-actor'));
 assert.throws(()=>srsReviewCards({...p,due_breakdown:{overdue:4,today:1}},actor),/không nhất quán/);
});

test('UX59.4 topic-scoped due count uses filtered full group, never current page',()=>{
 const p={...base(),topic:'Daily Life',total:2,due_breakdown:{overdue:6,today:2}};
 assert.deepEqual(srsDueBreakdown(p),p.due_breakdown);
 assert.throws(()=>srsDueBreakdown({...p,due_breakdown:{overdue:1,today:0}}),/nhất quán/);
 const other={...base(),status:'new',topic:'Daily Life',due_breakdown:{overdue:6,today:2}};
 assert.deepEqual(srsDueBreakdown(other),other.due_breakdown);
});

test('UX59.4 invalid or legacy payload never invents account statistics',()=>{
 assert.equal(srsDueBreakdown({...base(),due_breakdown:undefined}),null);
 for(const b of [null,{},[],{overdue:-1,today:3},{overdue:'2',today:2},
  {overdue:Infinity,today:0},{overdue:1.5,today:2}]){
  assert.throws(()=>srsDueBreakdown({...base(),due_breakdown:b}));
 }
});

test('UX59.4 UI displays compact counts only for loaded due group; keeps practice entry',()=>{
 const ui=readFileSync(new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../lib/srs-queue.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/ux24-srs-panel.css',import.meta.url),'utf8');
 assert.match(backend,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(backend,/const due_breakdown=dueBreakdownFromQueue\(matchingDue\)/);
 assert.match(backend,/words:rows\.slice\(start,start\+size\)/);
 assert.match(ui,/data&&actorId&&!pending&&data\.status==='due'/);
 assert.match(ui,/count\.textContent\+=' · '/);
 assert.match(ui,/practice\.addEventListener\('click'/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/#ws24Count\{flex:1 1 100%/);
});
