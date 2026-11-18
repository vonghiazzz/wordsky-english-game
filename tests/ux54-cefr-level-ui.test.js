import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVerbQuiz} from '../public/verb-practice-core.js';
import {getApprovedVerbCefrLevel} from '../public/verb-cefr-sense-review.js';

test('UX54 learner UI includes A1 filter and disables unsupported A2-C1 levels',()=>{
 const html=readFileSync(new URL('../public/verbs.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/verbs.js',import.meta.url),'utf8');
 assert.match(html,/<select id="ws54Level"[^>]*>/);
 assert.match(html,/<option value="A1">A1/);
 for(const level of ['A2','B1','B2','C1']){
  assert.match(html,new RegExp('<option value="'+level+'" disabled>'));
 }
 assert.match(html,/id="ws54Availability" role="status"/);
 assert.match(js,/createVerbQuiz\(\{\.\.\.selectedQuizOptions\(\),count:listVerbEntries\(\)\.length/);
 assert.match(js,/const canStart=available>=10;/);
 assert.match(js,/if\(items.length!==10\)/);
 assert.match(js,/ws54Level\.addEventListener\('change',refreshQuizAvailability\)/);
});
test('UX54 exact approved A1 pool is sufficient only for available combinations',()=>{
 const a1=createVerbQuiz({cefrLevel:'A1',count:300,random:()=>0});
 assert.equal(a1.length,12);
 assert.equal(new Set(a1.map(q=>q.v1)).size,12);
 assert.ok(a1.every(q=>getApprovedVerbCefrLevel(q.v1,q.meaning)==='A1'));
 assert.equal(createVerbQuiz({kind:'irregular',cefrLevel:'A1',count:300,random:()=>0}).length,11);
 assert.equal(createVerbQuiz({kind:'regular',cefrLevel:'A1',count:300,random:()=>0}).length,1);
 for(const level of ['A2','B1','B2','C1']){
  assert.deepEqual(createVerbQuiz({cefrLevel:level,random:()=>0}),[]);
 }
 assert.equal(createVerbQuiz({random:()=>0}).length,10);
 assert.equal(createVerbQuiz({kind:'regular',random:()=>0}).length,10);
});
