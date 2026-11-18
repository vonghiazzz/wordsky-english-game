import test from 'node:test';
import assert from 'node:assert/strict';
import {listVerbEntries,findVerbEntries} from '../public/verb-dictionary.js';
import {createVerbQuiz} from '../public/verb-practice-core.js';
import {getVerbCefrSenseReview,getApprovedVerbCefrLevel,listProposedVerbCefrSenses,VERB_CEFR_LEVELS} from '../public/verb-cefr-sense-review.js';

test('UX53B 20 exact Vietnamese senses proposed, none approved for training',()=>{
 const list=listProposedVerbCefrSenses();
 assert.equal(list.length,20);
 assert.equal(new Set(list.map(x=>x.v1)).size,20);
 const catalog=listVerbEntries();
 assert.equal(catalog.length,300);
 for(const row of list){
  const entry=catalog.find(e=>e.v1===row.v1);
  assert.ok(entry,row.v1);
  assert.equal(row.meaning,entry.meaning,row.v1);
  assert.equal(row.status,'proposed',row.v1);
  assert.equal(row.level,entry.cefr.level,row.v1);
  assert.equal(row.source_id,entry.cefr.source_id,row.v1);
  assert.equal(getApprovedVerbCefrLevel(row.v1,row.meaning),null,row.v1);
 }
 assert.equal(list.filter(r=>r.status==='approved').length,0);
 assert.deepEqual(VERB_CEFR_LEVELS,['A1','A2','B1','B2','C1']);
});
test('UX53B CEFR quiz fails closed without reviewed approvals, legacy quiz unchanged',()=>{
 for(const level of ['A1','A2','B1','B2','C1','Z9','all','']){
  assert.deepEqual(createVerbQuiz({cefrLevel:level,random:()=>0}),[],level);
  assert.deepEqual(createVerbQuiz({cefrLevel:level,kind:'irregular',random:()=>0}),[],level);
 }
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
 assert.equal(listVerbEntries().filter(v=>getApprovedVerbCefrLevel(v.v1,v.meaning)).length,0);
});
