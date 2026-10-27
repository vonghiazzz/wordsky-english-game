import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUnifiedReview} from '../lib/unified-review.js';

const request_id='11111111-1111-4111-8111-111111111111';
const word_id='22222222-2222-4222-8222-222222222222';
const input={request_id,word_id,source:'shared',remembered:false};

test('UX23A account review requires stable request_id and an explicit remembered boolean',()=>{
 assert.deepEqual(validateUnifiedReview(input),{...input,expected_review_count:null});
 assert.deepEqual(validateUnifiedReview({...input,source:'personal',remembered:true}),
  {...input,source:'personal',remembered:true,expected_review_count:null});
 for(const wrong of [
  null,[],{}, {...input,request_id:'bad'}, {...input,request_id:undefined},
  {...input,word_id:'Food:apple'}, {...input,source:'device'},
  {...input,source:'game'}, {...input,remembered:'true'},
  {...input,remembered:1}, {...input,remembered:undefined}
 ])assert.throws(()=>validateUnifiedReview(wrong));
});
test('UX23A request UUID normalized for equivalent string representations',()=>{
 const p=validateUnifiedReview({...input,
  request_id:request_id.toUpperCase(),word_id:word_id.toUpperCase()});
 assert.equal(p.request_id,request_id);
 assert.equal(p.word_id,word_id);
});
test('UX23A SQL migration has owner scoped unique idempotency key with RLS and revokes',()=>{
 const sql=readFileSync(new URL('../db/migrations/20261027_ux23_idempotent_review_requests.sql',import.meta.url),'utf8');
 assert.match(sql,/PRIMARY KEY \(user_id, request_id\)/);
 assert.match(sql,/REFERENCES public\.ws_users\(id\) ON DELETE CASCADE/);
 assert.match(sql,/source IN \('shared','personal'\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.ws_learning_review_requests FROM PUBLIC/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.ws_learning_review_requests FROM %I/);
 assert.doesNotMatch(sql,/\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/);
});
test('UX23A one transaction, ledger first, one review+progress per new request',()=>{
 const src=readFileSync(new URL('../lib/unified-review.js',import.meta.url),'utf8');
 assert.match(src,/return await transaction\(async db=>/);
 assert.match(src,/ON CONFLICT\(user_id,request_id\) DO NOTHING/);
 assert.match(src,/if\(!claim\.rows\.length\)/);
 assert.match(src,/saved\.source!==request\.source/);
 assert.match(src,/saved\.word_id!==request\.word_id/);
 assert.match(src,/saved\.remembered!==request\.remembered/);
 assert.match(src,/request_id đã được dùng cho một thao tác học khác/);
 assert.match(src,/replayed:true/);
 assert.match(src,/replayed:false/);
 assert.match(src,/ws_learning_flashcard_reviews/);
 assert.match(src,/ws_personal_card_reviews/);
 assert.match(src,/ws_learning_word_progress\.review_count\+1/);
 assert.match(src,/ws_personal_card_progress\.review_count\+1/);
});
test('UX23A account actor validated by session before mutation, no user ID from client',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/method==='POST'&&key==='learning\/reviews'/);
 assert.match(api,/const userId=mustPlayer\(req\)\.id,review=body\(req\)/);
 assert.match(api,/review\.expected_actor_id!==undefined&&review\.expected_actor_id!==userId/);
 assert.match(api,/recordUnifiedReview\(userId,review\)/);
 assert.match(api,/result\.replayed\?200:201/);
});
test('UX23A old review endpoints remain available until frontend migration',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/key==='learning\/flashcards\/reviews'/);
 assert.match(api,/key==='learning\/personal\/reviews'/);
 assert.match(api,/recordFlashcardReview\(userId,review\)/);
 assert.match(api,/markPersonalCard\(userId,input\)/);
});
