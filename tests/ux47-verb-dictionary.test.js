import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findVerbEntries,listVerbEntries} from '../public/verb-dictionary.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('UX47 curated dictionary has meanings and V1/V2/V3 for every entry',()=>{
 const all=listVerbEntries();
 assert.equal(all.length,241);
 assert.equal(new Set(all.map(v=>v.v1)).size,all.length);
 for(const v of all){
  assert.ok(v.v1&&v.v2&&v.v3&&v.meaning,'Missing verb form/translation');
  assert.ok(['irregular','regular'].includes(v.kind));
 }
});
test('UX47 search by any of go/went/gone returns exactly go',()=>{
 for(const term of ['go','went','gone']){
  const results=findVerbEntries(term);
  assert.equal(results.length,1,term);
  assert.equal(results[0].v1,'go');
  assert.equal(results[0].meaning,'đi');
  assert.equal(results[0].examples.length,6);
 }
});
test('UX47 searches meanings and alternative forms',()=>{
 assert.equal(findVerbEntries('đi')[0].v1,'go');
 assert.equal(findVerbEntries('were')[0].v1,'be');
 assert.equal(findVerbEntries('gotten')[0].v1,'get');
 assert.equal(findVerbEntries('studied')[0].v1,'study');
 assert.equal(findVerbEntries('written')[0].v1,'write');
 assert.equal(findVerbEntries('go','regular').length,0);
 assert.equal(findVerbEntries('go','irregular')[0].v1,'go');
});
test('UX47 phrases do not pollute dictionary and account progress stays independent',()=>{
 assert.equal(findVerbEntries('which bus goes to the station').length,0);
 const page=read('public/verbs.html'),progress=read('public/progress.html');
 assert.match(page,/id="ws47Search"/);
 assert.match(page,/id="ws47Rows"/);
 assert.doesNotMatch(page,/<th scope="col">Cách dùng<\/th>/);
 assert.doesNotMatch(page,/class="ws47-usage"/);
 assert.match(progress,/href="\/verbs\.html"/);
 const app=read('public/verbs.js');
 assert.doesNotMatch(app,/fetch\(|localStorage|sessionStorage/);
});
