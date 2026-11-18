import test from 'node:test';
import assert from 'node:assert/strict';
import {paginateVerbs,acceptedVerbForms,isVerbAnswerCorrect,createVerbQuiz,PAGE_SIZE} from '../public/verb-practice-core.js';
import {findVerbEntries} from '../public/verb-dictionary.js';
test('UX48 300 verbs paginate into 15 pages with no duplication',()=>{
 const all=findVerbEntries();
 assert.equal(PAGE_SIZE,20);
 const pages=Array.from({length:15},(_,i)=>paginateVerbs(all,i+1));
 assert.deepEqual(pages.map(p=>p.items.length),Array(15).fill(20));
 assert.equal(new Set(pages.flatMap(p=>p.items.map(v=>v.v1))).size,300);
 assert.equal(paginateVerbs(all,0).page,1);
 assert.equal(paginateVerbs(all,100).page,15);
 assert.equal(paginateVerbs(findVerbEntries('went'),15).page,1);
});
test('UX48 answers support listed alternatives, not arbitrary strings',()=>{
 assert.deepEqual(acceptedVerbForms('was / were'),['was','were']);
 assert.equal(isVerbAnswerCorrect(' WENT ','went'),true);
 assert.equal(isVerbAnswerCorrect('were','was / were'),true);
 assert.equal(isVerbAnswerCorrect('gotten','got / gotten'),true);
 assert.equal(isVerbAnswerCorrect('goed','went'),false);
 assert.equal(isVerbAnswerCorrect('gone','went'),false);
 assert.equal(isVerbAnswerCorrect('','went'),false);
});
test('UX48 quiz yields 10 unique prompts and rotating V1/V2/V3, scope respected',()=>{
 const q=createVerbQuiz({random:()=>0.5});
 assert.equal(q.length,10);
 assert.equal(new Set(q.map(x=>x.v1)).size,10);
 assert.deepEqual(q.map(x=>x.target),['v1','v2','v3','v1','v2','v3','v1','v2','v3','v1']);
 assert.ok(createVerbQuiz({kind:'irregular',random:()=>0.3}).every(x=>x.v2!==undefined));
 assert.ok(createVerbQuiz({kind:'regular',random:()=>0.4}).every(x=>x.v3!==undefined));
});
