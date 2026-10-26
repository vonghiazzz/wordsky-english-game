import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleServerImports} from '../public/ux16-account-import.js';
const a='00000000-0000-4000-8000-000000000001';
const b='00000000-0000-4000-8000-000000000002';
const c='00000000-0000-4000-8000-000000000003';
const card=(word_id,english)=>({word_id,topic:'Food',card:[english,'/ipa/','Quả',english+' is fruit.','Đây là quả.']});
const server={words:[card(a,'apple'),card(b,'pear'),card(c,'orange')]};
const asAccount=row=>({word_id:row.word_id,topic:row.topic,english:row.card[0],ipa:row.card[1],meaning:row.card[2],example:row.card[3],translation:row.card[4]});
const catalog=server.words.map(asAccount);
test('UX16 imports UUID-validated server marks without touching personal progress',()=>{
 const marks={learned:{[a]:true,[b]:true},error:null};
 const plan=eligibleServerImports(server,marks,catalog,[]);
 assert.deepEqual(plan.eligible.map(w=>w.word_id),[a,b]);
 assert.equal(plan.unmatched,0);
 assert.equal(plan.alreadyReviewed,0);
 assert.equal(plan.error,null);
 assert.deepEqual(marks.learned,{[a]:true,[b]:true});
});
test('UX16 never overwrites an existing false account decision',()=>{
 const p=eligibleServerImports(server,{learned:{[a]:true,[b]:true}},catalog,[{word_id:a,remembered:false}]);
 assert.deepEqual(p.eligible.map(w=>w.word_id),[b]);
 assert.equal(p.alreadyReviewed,1);
});
test('UX16 stale UUID, changed meaning and cross-project IDs cannot sync',()=>{
 const changed=catalog.map(row=>row.word_id===a?{...row,meaning:'Edited meaning'}:row);
 const plan=eligibleServerImports(server,{learned:{[a]:true,[b]:true,[c]:true,
  '33333333-3333-4333-8333-333333333333':true}},[...changed.filter(row=>row.word_id!==b)],[]);
 assert.equal(plan.eligible.length,1);
 assert.deepEqual(plan.eligible.map(w=>w.word_id),[c]);
 assert.equal(plan.unmatched,3);
});
test('UX16 malformed marks fail closed',()=>{
 const p=eligibleServerImports(server,{learned:{},error:'Invalid UUID state'},catalog,[]);
 assert.ok(p.error);assert.deepEqual(p.eligible,[]);
 assert.ok(eligibleServerImports(server,{learned:null},catalog,[]).error);
});
test('UX16 import requires explicit confirmation, binds actor, and is limited to 20 per action',()=>{
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 assert.match(html,/id="ws16ServerImport"/);
 assert.match(html,/id="ws16ServerImportInfo"/);
 assert.match(js,/const batch=plan\.eligible\.slice\(0,20\)/);
 assert.match(js,/window\.confirm\('Chuyển '/);
 assert.match(js,/await postAccountReview\(entry.word_id,true,clickedBy\)/);
 assert.match(js,/session\.actor\?\.role!=='player'\|\|session\.actor\.id!==clickedBy/);
 assert.match(js,/if\(account\.kind==='ready'\)queueReview\(card,remembered\)/);
 assert.match(js,/Không ghi đè quyết định cũ/);
});
