import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogIndex,exactCatalogMatch,exactFingerprint,eligibleImports,loadAccount,postAccountReview} from '../public/ux10-account-core.js';

const uuid1='00000000-0000-4000-8000-000000000001';
const uuid2='00000000-0000-4000-8000-000000000002';
const local = {topic:'Daily Life',english:'wake',ipa:'/weɪk/',meaning:'Thức dậy (wake up)',example:'I wake up at seven.',translation:'Tôi thức dậy lúc bảy giờ.',key:'Daily Life:wake'};
const catalog = {...local,word_id:uuid1};
test('Account sync matches full exact card identity, not English word or topic alone',()=>{
 const index=catalogIndex([catalog]);
 assert.equal(exactCatalogMatch(local,index)?.word_id,uuid1);
 assert.equal(exactCatalogMatch({...local,meaning:'Đánh thức'},index),null);
 assert.equal(exactCatalogMatch({...local,topic:'My Topic'},index),null);
 assert.equal(exactCatalogMatch({...local,example:'Edited example'},index),null);
 assert.equal(exactCatalogMatch({...local,translation:'Changed translation'},index),null);
 assert.equal(exactCatalogMatch({...local,ipa:''},index),null);
 assert.equal(exactCatalogMatch({...local,english:'WAKE'},index)?.word_id,uuid1);
 assert.equal(typeof exactFingerprint(local),'string');
});
test('Ambiguous matches never sync automatically',()=>{
 const index=catalogIndex([catalog,{...catalog,word_id:uuid2}]);
 assert.equal(exactCatalogMatch(local,index),null);
 assert.deepEqual(eligibleImports([local],{'Daily Life:wake':true},index,[]),{eligible:[],unmatched:1,alreadyReviewed:0});
});
test('Old local progress is imported only by explicit action; never overwrite any existing account decision',()=>{
 const index=catalogIndex([catalog]);
 assert.deepEqual(eligibleImports([local],{'Daily Life:wake':true},index,[]).eligible.map(x=>x.word_id),[uuid1]);
 assert.equal(eligibleImports([local],{'Daily Life:wake':true},index,[{word_id:uuid1,remembered:false}]).eligible.length,0);
 assert.equal(eligibleImports([local],{'Daily Life:wake':true},index,[{word_id:uuid1,remembered:true}]).eligible.length,0);
 assert.equal(eligibleImports([local],{'Daily Life:wake':false},index,[]).eligible.length,0);
});
test('Guest account returns guest without making any account-data calls',async()=>{
 const original=globalThis.fetch;
 const calls=[];
 try {
  globalThis.fetch=async (url)=>{calls.push(url);return {ok:true,json:async()=>({actor:null})}};
  assert.deepEqual(await loadAccount(),{kind:'guest'});
  assert.deepEqual(calls,['/api/auth/me']);
 }finally{globalThis.fetch=original;}
});
test('Account fetching uses cookie auth, real DB data, and exposes separately scoped remote state',async()=>{
 const original=globalThis.fetch;
 const requests=[];
 try {
  globalThis.fetch=async(url,opts)=>{
   requests.push({url,credentials:opts.credentials});
   const responses={
    '/api/auth/me':{actor:{role:'player',id:'user-1',profile:{display_name:'Learner'}}},
    '/api/learning/flashcards/catalog':{scope:'catalog',words:[catalog]},
    '/api/learning/flashcards/progress':{scope:'account',words:[{word_id:uuid1,remembered:true,english:'wake',topic:'Daily Life'}]}
   };
   return {ok:true,json:async()=>responses[url]};
  };
  const loaded=await loadAccount();
  assert.equal(loaded.kind,'ready');assert.equal(loaded.words.length,1);
  assert.equal(exactCatalogMatch(local,loaded.index)?.word_id,uuid1);
  assert.equal(requests.length,3);assert.ok(requests.every(x=>x.credentials==='same-origin'));
 }finally{globalThis.fetch=original;}
});
test('Account review is explicitly sent with a UUID and boolean, and errors surface',async()=>{
 const original=globalThis.fetch;
 try {
  let body=null;
  globalThis.fetch=async(url,opts)=>{body=JSON.parse(opts.body);return {ok:true,json:async()=>({scope:'account',word_id:uuid1})}};
  await postAccountReview(uuid1,true);assert.deepEqual(body,{word_id:uuid1,remembered:true});
  globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({error:'Sync unavailable'})});
  await assert.rejects(()=>postAccountReview(uuid1,true),/Sync unavailable/);
 }finally{globalThis.fetch=original;}
});
test('Flashcard persists local first and emits precise review; account remains a separate module',()=>{
 const learn=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
 const progress=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 assert.match(learn,/if\(!saveLearned\(\)\)/);
 assert.match(learn,/new CustomEvent\('wordsky:flashcard-reviewed'/);
 assert.match(learn,/\/ux10-learn-sync\.js/);
 assert.match(progress,/loadAccount\(/);assert.match(progress,/eligibleImports\(/);
 assert.match(progress,/queueReview\(card,remembered\)/);
});

test('Local cards remain visibly separated from account-synced totals and scope',()=>{
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 assert.match(html,/Các số liệu phía trên được đọc từ trình duyệt/);
 assert.match(html,/id="ws10AccountStats"/);
 assert.match(html,/id="ws10AccountKnown"/);
 assert.match(html,/id="ws10Known"/);
 assert.match(html,/id="ws10Import"/);
});

test('UX10 review queue survives focus refresh and never posts under a switched account',()=>{
 const ui=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 const sync=readFileSync(new URL('../public/ux10-learn-sync.js',import.meta.url),'utf8');
 assert.match(ui,/const clickedBy = account\.kind === 'ready' \? account\.actor\.id : null/);
 assert.match(ui,/const currentSession = await learningApi\('auth\/me'\)/);
 assert.match(ui,/if \(clickedBy && clickedBy !== currentSession\.actor\.id\)/);
 assert.match(ui,/await postAccountReview\(target\.word_id, remembered\)/);
 assert.match(ui,/await refreshAccount\(\)/);
 assert.doesNotMatch(ui,/if \(account\.kind !== 'ready' \|\| account\.actor\.id !== sessionId\) return/);
 assert.match(sync,/window\.addEventListener\('focus', \(\) => \{accountPromise = loadAccount\(\)/);
});
