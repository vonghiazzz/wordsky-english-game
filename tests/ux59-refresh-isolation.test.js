import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {srsVisibleRows,srsDueBreakdown,srsReviewCards} from '../public/ux24-srs-panel.js';

const actor='12345678-1234-4234-8234-123456789abc';
const id='abcdefab-1234-4234-8234-123456789abc';
const data=()=>({
 scope:'account-srs',actor_id:actor,status:'due',topic:'',
 page:0,size:20,total:1,total_pages:1,topics:[],
 summary:{due:1,upcoming:0,new:0,total:1},
 due_breakdown:{overdue:1,today:0},
 words:[{id,source:'shared',status:'due',review_count:1,
 english:'learn',topic:'School',overdue_days:3}]
});

test('UX59.5 due rows are not visible while identity is pending, even if cached',()=>{
 const old=data();
 assert.deepEqual(srsVisibleRows(old,actor,true),[]);
 assert.deepEqual(srsVisibleRows(old,null,false),[]);
 assert.deepEqual(srsVisibleRows(null,actor,false),[]);
 assert.equal(srsVisibleRows(old,actor,false),old.words);
});

test('UX59.5 a newly verified account cannot reuse old actor payload',()=>{
 const old=data();
 assert.throws(()=>srsReviewCards(old,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),/không hợp lệ/);
 assert.equal(srsReviewCards(old,actor),old);
 assert.deepEqual(srsDueBreakdown(old),{overdue:1,today:0});
});

test('UX59.5 empty and malformed rows fail closed',()=>{
 assert.deepEqual(srsVisibleRows({words:null},actor,false),[]);
 assert.deepEqual(srsVisibleRows({words:{}},actor,false),[]);
 assert.deepEqual(srsVisibleRows({words:[]},actor,false),[]);
});

test('UX59.5 render hides stale count, pager and rows on refresh',()=>{
 const src=readFileSync(new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8');
 assert.match(src,/const rows=srsVisibleRows\(data,actorId,pending\)/);
 assert.match(src,/count\.textContent=data&&actorId&&!pending\?/);
 assert.match(src,/pageText\.textContent=data&&actorId&&!pending\?/);
 assert.match(src,/if\(!pending&&actorId&&data&&!rows\.length\)/);
 assert.match(src,/received=null;actorId=null;/);
 assert.match(src,/practice\.disabled=pending/);
});

test('UX59.5 360px layout and single practice entry remain in place',()=>{
 const css=readFileSync(new URL('../public/ux24-srs-panel.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/#ws24Count\{flex:1 1 100%/);
 assert.equal((html.match(/id="ws24Practice"/g)||[]).length,1);
});
