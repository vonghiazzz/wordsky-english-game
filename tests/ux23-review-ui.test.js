import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {postUnifiedAccountReview} from '../public/ux10-account-core.js';

const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const word='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('UX23B retries the SAME request UUID after uncertain network failure',async()=>{
 const oldFetch=globalThis.fetch,oldSession=globalThis.sessionStorage;
 const saved=new Map(),payloads=[];
 globalThis.sessionStorage={
  getItem:key=>saved.get(key)||null,
  setItem:(key,value)=>saved.set(key,value),
  removeItem:key=>saved.delete(key)
 };
 globalThis.fetch=async (url,options)=>{
  assert.equal(url,'/api/learning/reviews');
  const p=JSON.parse(options.body);payloads.push(p);
  if(payloads.length===1)throw Error('Connection dropped after send');
  return {ok:true,status:200,json:async()=>({
    scope:'account-review',source:p.source,word_id:p.word_id,
    request_id:p.request_id,remembered:p.remembered,version:p.expected_version+1,
    replayed:payloads.length===2,reviewed_at:'2026-10-27T00:00:00Z'
  })};
 };
 try{
  await assert.rejects(
   ()=>postUnifiedAccountReview('shared',word,true,actor,0),/Connection dropped/);
  assert.equal(saved.size,1,'transport UUID survives ambiguous failure');
  const replay=await postUnifiedAccountReview('shared',word,true,actor,0);
  assert.equal(replay.replayed,true);
  assert.equal(payloads[0].request_id,payloads[1].request_id,
    'a retry cannot increment the server review counter');
  assert.equal(saved.size,0,'clear pending metadata after confirmation');
  await postUnifiedAccountReview('shared',word,true,actor,1);
  assert.notEqual(payloads[2].request_id,payloads[1].request_id,
    'a deliberate later review gets a new operation UUID');
 }finally{
  globalThis.fetch=oldFetch;
  if(oldSession===undefined)delete globalThis.sessionStorage;
  else globalThis.sessionStorage=oldSession;
 }
});
test('UX23B screens use one review transport, not two different account review APIs',()=>{
 const flash=readFileSync(new URL('../public/ux18-flash-sync.js',import.meta.url),'utf8');
 const dashboard=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 const manager=readFileSync(new URL('../public/ux18-personal.js',import.meta.url),'utf8');
 assert.match(flash,/postUnifiedAccountReview\('shared',wordId,true,id,/);
 assert.match(flash,/postUnifiedAccountReview\('personal',wordId,true,id,/);
 assert.match(dashboard,/postUnifiedAccountReview\(card\.source,/);
 assert.match(manager,/postUnifiedAccountReview\('personal',wordId,remembered,actor\.id,expectedVersion\)/);
 assert.match(manager,/scopedUnifiedReview\(word\.id,true\)/);
 assert.match(manager,/scopedUnifiedReview\(word\.id,false\)/);
 assert.doesNotMatch(manager,/scopedRequest\('learning\/personal\/reviews'/);
});
