import test from 'node:test';
import assert from 'node:assert/strict';
import {listVerbEntries,findVerbEntries} from '../public/verb-dictionary.js';
import {createVerbQuiz} from '../public/verb-practice-core.js';
import {getVerbCefrSenseReview,getApprovedVerbCefrLevel,listProposedVerbCefrSenses,VERB_CEFR_LEVELS} from '../public/verb-cefr-sense-review.js';

test('UX53B 20 reviewed candidates with twelve sourced and explicitly approved senses',()=>{
 const list=listProposedVerbCefrSenses();
 assert.equal(list.length,20);
 assert.equal(new Set(list.map(x=>x.v1)).size,20);
 const catalog=listVerbEntries();
 assert.equal(catalog.length,300);
 for(const row of list){
  const entry=catalog.find(e=>e.v1===row.v1);
  assert.ok(entry,row.v1);
  assert.equal(row.meaning,entry.meaning,row.v1);
  assert.equal(row.status,['buy','come','drink','eat','find','go','have','know','learn','read','see','write'].includes(row.v1)?'approved':'proposed',row.v1);
  assert.equal(row.level,entry.cefr.level,row.v1);
  assert.equal(row.source_id,entry.cefr.source_id,row.v1);
  assert.equal(getApprovedVerbCefrLevel(row.v1,row.meaning),['buy','come','drink','eat','find','go','have','know','learn','read','see','write'].includes(row.v1)?'A1':null,row.v1);
 }
 assert.equal(list.filter(r=>r.status==='approved').length,12);
 for(const [v1,sourceId] of [
  ['drink','cambridge_learner_drink_liquid_A1'],
  ['have','cambridge_learner_have_own_A1']
 ]){
  const row=list.find(v=>v.v1===v1);
  assert.equal(row.status,'approved',v1);
  assert.equal(row.level,'A1',v1);
  assert.equal(row.sense_source_id,sourceId,v1);
  assert.equal(row.sense_source_url,'https://dictionary.cambridge.org/us/dictionary/learner-english/'+v1);
  assert.equal(getApprovedVerbCefrLevel(v1,row.meaning+' khác'),null,v1);
 }
 const buy=list.find(r=>r.v1==='buy');
 assert.equal(buy.sense_source_id,'cambridge_learner_buy_purchase_A1');
 assert.match(buy.sense_source_url,/dictionary\.cambridge\.org/);
 assert.deepEqual(VERB_CEFR_LEVELS,['A1','A2','B1','B2','C1']);
});
test('UX53B CEFR quiz admits only approved sense and legacy quiz unchanged',()=>{
 for(const level of ['A2','B1','B2','C1','Z9','all','']){
  assert.deepEqual(createVerbQuiz({cefrLevel:level,random:()=>0}),[],level);
  assert.deepEqual(createVerbQuiz({cefrLevel:level,kind:'irregular',random:()=>0}),[],level);
 }
 const approved=createVerbQuiz({cefrLevel:'A1',random:()=>0});
 assert.equal(approved.length,10);
 assert.equal(new Set(approved.map(v=>v.v1)).size,10);
 assert.ok(approved.every(v=>getApprovedVerbCefrLevel(v.v1,v.meaning)==='A1'));
 const all=createVerbQuiz({cefrLevel:'A1',count:20,random:()=>0});
 assert.deepEqual(all.map(v=>v.v1).sort(),['buy','come','drink','eat','find','go','have','know','learn','read','see','write']);
 assert.deepEqual(createVerbQuiz({cefrLevel:'A1',kind:'regular',random:()=>0}).map(q=>q.v1),['learn']);
 const normal=createVerbQuiz({random:()=>0.5});
 assert.equal(normal.length,10);
 assert.equal(new Set(normal.map(q=>q.v1)).size,10);
 assert.ok(normal.every(q=>['v1','v2','v3'].includes(q.target)));
 assert.equal(createVerbQuiz({kind:'regular',random:()=>0.5}).length,10);
 assert.equal(findVerbEntries('went')[0].v1,'go');
});
test('UX53B meaning drift and missing/unsupported source cannot gain eligibility',()=>{
 assert.equal(getVerbCefrSenseReview('go','di').status,'unreviewed');
 assert.equal(getApprovedVerbCefrLevel('go','di'),null);
 assert.equal(getVerbCefrSenseReview('forbid','cấm').status,'unreviewed');
 assert.equal(getVerbCefrSenseReview('practice','luyện tập').status,'unreviewed');
 assert.equal(getVerbCefrSenseReview('unknown','x').status,'unreviewed');
 assert.equal(listVerbEntries().filter(v=>getApprovedVerbCefrLevel(v.v1,v.meaning)).length,12);
 assert.equal(getApprovedVerbCefrLevel('buy','mua hàng'),null);
 for(const v1 of ['come','drink','eat','find','go','have','know','learn','read','see','write']){
  const row=listVerbEntries().find(e=>e.v1===v1);
  assert.equal(getVerbCefrSenseReview(v1,row.meaning).status,'approved');
  assert.match(getVerbCefrSenseReview(v1,row.meaning).sense_source_url,/dictionary\.cambridge\.org/);
  assert.equal(getApprovedVerbCefrLevel(v1,row.meaning+' khác'),null);
 }
 assert.deepEqual(createVerbQuiz({cefrLevel:'A1',kind:'regular',random:()=>0}).map(q=>q.v1),['learn']);
});
