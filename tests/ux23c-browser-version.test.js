import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {postUnifiedAccountReview} from '../public/ux10-account-core.js';

const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const word='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function fakeStorage(){
 const entries=new Map();
 return {entries,
  getItem:key=>entries.get(key)??null,
  setItem:(key,value)=>entries.set(key,value),
  removeItem:key=>entries.delete(key)
 };
}

test('UX23C rejects a stale review, refresh/reconfirmation uses a new UUID',async()=>{
 const originalFetch=globalThis.fetch, originalStorage=globalThis.sessionStorage;
 const storage=fakeStorage(),requests=[];
 globalThis.sessionStorage=storage;
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);requests.push(body);
  if(requests.length===1)
   return {ok:false,status:409,json:async()=>({error:'review version changed'})};
  return {ok:true,status:201,json:async()=>({
   scope:'account-review',source:body.source,word_id:body.word_id,
   request_id:body.request_id,remembered:body.remembered,replayed:false
  })};
 };
 try{
  await assert.rejects(()=>postUnifiedAccountReview('personal',word,true,actor,-1),
   /Phiên bản tiến độ/);
  assert.equal(requests.length,0);
  await assert.rejects(()=>postUnifiedAccountReview('personal',word,true,actor,0),
   error=>error.status===409);
  assert.equal(storage.entries.size,0,'409 is definitive and discards pending request ID');
  await postUnifiedAccountReview('personal',word,true,actor,1);
  assert.equal(requests[0].expected_review_count,0);
  assert.equal(requests[1].expected_review_count,1);
  assert.notEqual(requests[0].request_id,requests[1].request_id);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalStorage===undefined)delete globalThis.sessionStorage;
  else globalThis.sessionStorage=originalStorage;
 }
});

test('UX23C uncertain network retry keeps the FIRST observed version and request ID',async()=>{
 const originalFetch=globalThis.fetch,originalStorage=globalThis.sessionStorage;
 const storage=fakeStorage(),requests=[];
 globalThis.sessionStorage=storage;
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);requests.push(body);
  if(requests.length===1)throw Error('connection dropped after commit');
  return {ok:true,status:200,json:async()=>({
   scope:'account-review',source:body.source,word_id:body.word_id,
   request_id:body.request_id,remembered:body.remembered,replayed:true
  })};
 };
 try{
  await assert.rejects(()=>postUnifiedAccountReview('shared',word,false,actor,4),
   /connection dropped/);
  assert.equal(storage.entries.size,1);
  const pending=JSON.parse([...storage.entries.values()][0]);
  assert.equal(pending.expected_review_count,4);
  await postUnifiedAccountReview('shared',word,false,actor,7);
  assert.equal(requests[0].request_id,requests[1].request_id);
  assert.equal(requests[0].expected_review_count,requests[1].expected_review_count);
  assert.equal(requests[1].expected_review_count,4,'retry cannot silently adopt a newer state');
  assert.equal(storage.entries.size,0);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalStorage===undefined)delete globalThis.sessionStorage;
  else globalThis.sessionStorage=originalStorage;
 }
});

test('UX23C each signed-in review surface forwards server-observed version and shows conflicts',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 assert.match(read('lib/unified-learning.js'),/review_count:row\.review_count\?\?0/);
 assert.match(read('public/ux19-unified-account.js'),/review_count:item\.review_count/);
 const dashboard=read('public/ux10-progress.js');
 assert.match(dashboard,/remembered,actorId,card\.review_count/);
 assert.match(dashboard,/if\(e\.status===409\)/);
 const manager=read('public/ux18-personal.js');
 assert.match(manager,/progress\?\.review_count\?\?0/);
 assert.match(manager,/if\(e\.status===409\)/);
 const flash=read('public/ux18-flash-sync.js');
 assert.match(flash,/sharedVersions\.get\(wordId\)\?\?0/);
 assert.match(flash,/personalVersions\.get\(wordId\)\?\?0/);
 assert.match(flash,/if\(e\.status===409\)/);
});
