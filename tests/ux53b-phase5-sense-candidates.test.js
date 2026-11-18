import test from 'node:test';
import assert from 'node:assert/strict';
import {listVerbSenseCandidates,findVerbSenseCandidates,getApprovedVerbSenseLevel} from '../public/verb-cefr-sense-candidates.js';
import {getApprovedVerbCefrLevel,getVerbCefrSenseReview} from '../public/verb-cefr-sense-review.js';
import {listVerbEntries} from '../public/verb-dictionary.js';
import {createVerbQuiz} from '../public/verb-practice-core.js';

test('UX53B phase 5: exactly sixteen unique, unapproved sense splits for eight ambiguous headwords',()=>{
 const entries=listVerbSenseCandidates();
 assert.equal(entries.length,16);
 assert.equal(new Set(entries.map(x=>x.id)).size,16);
 assert.deepEqual([...new Set(entries.map(x=>x.v1))].sort(),
  ['be','begin','do','get','give','make','speak','take']);
 for(const entry of entries){
  assert.equal(entry.status,'proposed');
  assert.equal(entry.cefrLevel,null);
  assert.equal(entry.sense_source_id,null);
  assert.equal(entry.sense_source_url,null);
  assert.equal(getApprovedVerbSenseLevel(entry.id),null);
  assert.ok(entry.meaning_vi.trim()&&entry.example_en.trim());
  assert.ok(listVerbEntries().some(v=>v.v1===entry.v1));
  assert.equal(findVerbSenseCandidates(entry.v1).length,2);
 }
 assert.equal(getApprovedVerbSenseLevel('unknown.invalid'),null);
 assert.equal(getApprovedVerbSenseLevel('begin.event-start'),null);
});

test('UX53B phase 5: proposed senses cannot enter approved quiz or change legacy glosses',()=>{
 for(const v1 of ['be','begin','do','get','give','make','speak','take']){
  const word=listVerbEntries().find(x=>x.v1===v1);
  assert.equal(getApprovedVerbCefrLevel(v1,word.meaning),null,v1);
  assert.equal(getVerbCefrSenseReview(v1,word.meaning).status,'proposed',v1);
 }
 const eligible=createVerbQuiz({cefrLevel:'A1',count:30,random:()=>0});
 assert.equal(eligible.length,12);
 assert.ok(eligible.every(q=>!['be','begin','do','get','give','make','speak','take'].includes(q.v1)));
 assert.equal(createVerbQuiz({random:()=>0.5}).length,10);
 assert.deepEqual(createVerbQuiz({cefrLevel:'A2',random:()=>0}),[]);
 assert.deepEqual(createVerbQuiz({cefrLevel:'C1',random:()=>0}),[]);
});
