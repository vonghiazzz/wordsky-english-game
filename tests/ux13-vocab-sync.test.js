import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseServerCatalog,readCachedServerCatalog,saveCachedServerCatalog,VOCAB_CACHE_KEY} from '../public/ux13-vocab-sync.js';

const a={word_id:'00000000-0000-4000-8000-000000000001',topic:'Daily Life',english:'wake',
  ipa:'/weɪk/',meaning:'Thức dậy (wake up)',example:'I wake up at seven.',translation:'Tôi thức dậy lúc bảy giờ.'};
const b={...a,word_id:'00000000-0000-4000-8000-000000000002',topic:'Food',english:'apple'};
const payload={scope:'catalog',words:[a,b]};
test('UX13 groups authoritative server rows with UUID and full text, without altering source',()=>{
 const p=parseServerCatalog(payload);
 assert.equal(p.count,2);assert.equal(p.topicCount,2);
 assert.deepEqual(p.topics['Daily Life'][0],
  ['wake','/weɪk/','Thức dậy (wake up)','I wake up at seven.','Tôi thức dậy lúc bảy giờ.']);
 assert.equal(p.words[0].word_id,a.word_id);
 assert.equal(Object.keys(p.topics).length,2);
 assert.equal(payload.words[0].english,'wake');
});
test('UX13 refuses malformed or ambiguous catalogs rather than guessing browser progress mapping',()=>{
 for(const data of [null,{}, {scope:'account',words:[a]}, {scope:'catalog',words:[{...a,word_id:'invalid'}]},
   {scope:'catalog',words:[{...a,meaning:null}]},
   {scope:'catalog',words:[a,{...a,word_id:b.word_id,english:'WAKE'}]},
   {scope:'catalog',words:[a,a]},
   {scope:'catalog',words:Array.from({length:5001},()=>a)}])
   assert.throws(()=>parseServerCatalog(data));
});
test('UX13 separate server cache never modifies personal Flashcard deck or learned state',()=>{
 const values=new Map([['wordsky_vocab_v2','personal cards'],['wordsky_learned','{"Daily Life:wake":true}']]);
 const storage={getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)};
 assert.equal(saveCachedServerCatalog(storage,payload,1700000000000),true);
 assert.ok(values.has(VOCAB_CACHE_KEY));
 assert.equal(readCachedServerCatalog(storage,1700000000100).count,2);
 assert.equal(values.get('wordsky_vocab_v2'),'personal cards');
 assert.equal(values.get('wordsky_learned'),'{"Daily Life:wake":true}');
 assert.equal(readCachedServerCatalog(storage,1700700000000),null,'cache expires after seven days');
 assert.equal(readCachedServerCatalog(storage,1600000000000),null,'future cache not trusted');
});
test('UX13 failures in browser storage are non-destructive',()=>{
 const denied={getItem(){throw new Error('denied')},setItem(){throw new Error('denied')}};
 assert.equal(readCachedServerCatalog(denied),null);
 assert.equal(saveCachedServerCatalog(denied,payload),false);
});
test('UX13 server source is independent of personal manager and falling words game',()=>{
 const learn=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const sync=readFileSync(new URL('../public/ux13-vocab-sync.js',import.meta.url),'utf8');
 assert.match(backend,/key==='learning\/vocabulary'/);
 assert.match(backend,/return output\(res,200,await getFlashcardCatalog\(\)\)/);
 for(const id of ['flashSource','refreshVocabulary','flashVocabularyStatus','topic','managerTopic','gameTopic'])
   assert.ok(learn.includes('id="'+id+'"'),id);
 assert.match(learn,/function flashTopics\(\)/);
 assert.match(learn,/flashSource==='server'&&SERVER_DATA/);
 assert.match(learn,/DATA=clone\(DEFAULT_DATA\)/);
 assert.match(learn,/const STORE='wordsky_vocab_v2'/);
 assert.match(sync,/fetch\('\/api\/learning\/vocabulary'/);
 assert.match(sync,/cache:'no-store'/);
 assert.match(sync,/window\.addEventListener\('focus'/);
});
