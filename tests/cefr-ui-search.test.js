import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const begin=code.indexOf('function cefrSearchMatches(');
const end=code.indexOf('\nfunction filterAdminCefr(',begin);
assert.ok(begin>=0&&end>begin,'Find pure CEFR matching function');
const search=vm.runInNewContext('('+code.slice(begin,end).trim()+')');
const rows=[
 {topic:'Greetings - Chào hỏi',w:{english:'hello',meaning:'xin chào',cefr_level:'A1',cefr_review_status:'APPROVED'}},
 {topic:'Food',w:{english:'apple',meaning:'quả táo',cefr_level:'A1',cefr_review_status:'APPROVED'}},
 {topic:'Travel - Du lịch',w:{english:'itinerary',meaning:'lịch trình',cefr_level:'C1',cefr_review_status:'APPROVED'}},
 {topic:'Technology - Công nghệ',w:{english:'software',meaning:'phần mềm',cefr_level:'B1',cefr_review_status:'PROVISIONAL'}},
];
test('search hello without CEFR filter finds the A1 word',()=>{
 assert.deepEqual(search(rows,'ALL','ALL','hello').map(x=>x.w.english),['hello']);
 assert.equal(search(rows,'A2','ALL','hello').length,0);
});
test('search supports Vietnamese meaning and diacritics',()=>{
 assert.deepEqual(search(rows,'ALL','ALL','phan mem').map(x=>x.w.english),['software']);
 assert.deepEqual(search(rows,'ALL','ALL','du lich').map(x=>x.w.english),['itinerary']);
});
test('CEFR and review status filter compose without hiding valid rows',()=>{
 assert.deepEqual(search(rows,'B1','PROVISIONAL','').map(x=>x.w.english),['software']);
 assert.equal(search(rows,'B1','APPROVED','').length,0);
});
test('quick table renders next to filters and enables edit action',()=>{
 assert.match(code,/id="cefrResultList"/);
 assert.match(code,/data-cefr-open/);
 assert.match(code,/openCefrEditor\(button\.dataset\.cefrOpen\)/);
 assert.match(code,/filterAdminCefr\(\);renderAdminFeatures/);
 assert.match(css,/wordsky-cefr-quick-results-v1/);
});
