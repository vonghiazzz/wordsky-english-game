import test from 'node:test';
import assert from 'node:assert/strict';
import {srsDueLabel,srsQuery,srsActionLabels} from '../public/ux24-srs-panel.js';
import {readFileSync} from 'node:fs';

test('UX59.3 labels only whole overdue days and never mislabels due-now',()=>{
 assert.equal(srsDueLabel({status:'due',overdue_days:4}),'Quá hạn 4 ngày');
 assert.equal(srsDueLabel({status:'due',overdue_days:1}),'Quá hạn 1 ngày');
 assert.equal(srsDueLabel({status:'due',overdue_days:0}),'Đến hạn');
 assert.equal(srsDueLabel({status:'due'}),'Đến hạn');
});
test('UX59.3 does not show overdue label for new/upcoming or unknown state',()=>{
 assert.equal(srsDueLabel({status:'new',overdue_days:null}),'Từ mới');
 assert.equal(srsDueLabel({status:'scheduled',overdue_days:0}),'Sắp đến hạn');
 assert.equal(srsDueLabel({status:'invalid'}),'');
 assert.equal(srsDueLabel(null),'');
});
test('UX59.3 untrusted or malformed overdue days never render as a number',()=>{
 for(const days of ['9',NaN,Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(srsDueLabel({status:'due',overdue_days:days}),'Đến hạn');
 }
});
test('UX59.3 existing account SRS filters and actions remain stable',()=>{
 assert.equal(srsQuery({status:'due',topic:'Daily life',page:1,size:20}),
  'learning/srs/queue?status=due&topic=Daily+life&page=1&size=20');
 assert.deepEqual(srsActionLabels('due'),[['✓ Đã nhớ',true],['↻ Cần ôn',false]]);
});
test('UX59.3 My Learning renders a compact label, with no new buttons or writes',()=>{
 const js=readFileSync(new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/ux24-srs-panel.css',import.meta.url),'utf8');
 assert.match(js,/if\(dueLabel&&word\.status==='due'\)/);
 assert.match(js,/make\('small',dueLabel,'ws59-due-label'\)/);
 assert.match(css,/\.ws24-card-body \.ws59-due-label/);
 assert.doesNotMatch(css,/position:\s*absolute/);
});
