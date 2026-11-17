import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVerbMistakeSummary,buildVerbRetryQuestions} from '../public/verb-mistake-retry.js';
const q=[
 {index:1,v1:'go',v2:'went',v3:'gone',meaning:'đi',target:'v2'},
 {index:2,v1:'eat',v2:'ate',v3:'eaten',meaning:'ăn',target:'v3'},
 {index:3,v1:'write',v2:'wrote',v3:'written',meaning:'viết',target:'v1'}
];
test('UX50 records wrong forms, original answer and exact target without re-keying',()=>{
 const result=buildVerbMistakeSummary(q,[{given:'goed',correct:false},{given:'eaten',correct:true},{given:'writee',correct:false}]);
 assert.equal(result.total,3);assert.equal(result.correct,1);assert.equal(result.incorrect,2);
 assert.deepEqual(result.missed.map(x=>[x.v1,x.target,x.given]),[['go','v2','goed'],['write','v1','writee']]);
 const retry=buildVerbRetryQuestions(result.missed);
 assert.deepEqual(retry.map(x=>[x.index,x.v1,x.target]),[[1,'go','v2'],[2,'write','v1']]);
 const clean=buildVerbMistakeSummary(retry,[{given:'went',correct:true},{given:'write',correct:true}]);
 assert.equal(clean.incorrect,0);assert.equal(clean.correct,2);
});
test('UX50 full score does not offer retry and invalid partial attempts fail closed',()=>{
 const result=buildVerbMistakeSummary(q,q.map(()=>({given:'ok',correct:true})));
 assert.equal(result.incorrect,0);assert.deepEqual(result.missed,[]);
 assert.deepEqual(buildVerbRetryQuestions(result.missed),[]);
 assert.throws(()=>buildVerbMistakeSummary(q,[]),/Incomplete practice attempt/);
});
