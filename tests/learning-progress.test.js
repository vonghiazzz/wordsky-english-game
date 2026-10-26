import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBrowserVocabulary,parseLearned,cardKey,summarize,filterWords,saveRemembered} from '../public/ux10-progress.js';
import {validateFlashcardReview,summarizeAccountReviews} from '../lib/learning-progress-core.js';
const cards={version:2,topics:{'Daily Life':[['hello','','Xin chào','',''],['study','','Học','','']],'Food':[['apple','','Quả táo','','']]}};
const parse=()=>parseBrowserVocabulary(JSON.stringify(cards));
test('UX10 reads real browser-only Flashcard vocabulary and topic+word keys',()=>{
 const parsed=parse();assert.equal(parsed.words.length,3);assert.equal(parsed.words[0].key,'Daily Life:hello');assert.equal(cardKey('Food','Apple'),'Food:apple');
 assert.deepEqual(summarize(parsed.words,{'Daily Life:hello':true}),{total:3,known:1,review:2,percent:33.3});
});
test('UX10 does not fabricate missing or malformed vocabulary',()=>{
 assert.deepEqual(parseBrowserVocabulary(null),{words:[],initialized:false,error:null});
 assert.ok(parseBrowserVocabulary('{bad').error);assert.ok(parseLearned('[]').error);assert.equal(parseLearned(null).error,null);
});
test('UX10 preserves unrelated progress when marking known and review',()=>{
 const mem=new Map([['wordsky_learned',JSON.stringify({'Food:apple':true,'legacy:key':true})]]);
 const storage={getItem:key=>mem.has(key)?mem.get(key):null,setItem:(key,val)=>mem.set(key,val)};
 const card=parse().words[0];saveRemembered(storage,card,true);assert.equal(JSON.parse(mem.get('wordsky_learned'))[card.key],true);
 saveRemembered(storage,card,false);const state=JSON.parse(mem.get('wordsky_learned'));assert.equal(state[card.key],undefined);assert.equal(state['legacy:key'],true);
});
test('UX10 refuses to overwrite malformed legacy progress',()=>{
 let writes=0;const storage={getItem:()=>'{bad',setItem:()=>{writes++}};
 assert.throws(()=>saveRemembered(storage,parse().words[0],true));assert.equal(writes,0);
});
test('UX10 filters topic, status, English and Vietnamese',()=>{
 const words=parse().words,learned={'Daily Life:hello':true};
 assert.equal(filterWords(words,learned,{status:'known'}).length,1);
 assert.equal(filterWords(words,learned,{status:'review',topic:'Food'}).length,1);
 assert.equal(filterWords(words,learned,{query:'Quả táo'})[0].english,'apple');
});
test('Account API uses exact UUID and explicit boolean',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 assert.deepEqual(validateFlashcardReview({word_id:id,remembered:false}),{word_id:id,remembered:false});
 assert.throws(()=>validateFlashcardReview({word_id:'Food:apple',remembered:true}));
 assert.throws(()=>validateFlashcardReview({word_id:id,remembered:'true'}));
 assert.deepEqual(summarizeAccountReviews([{remembered:true},{remembered:false}]),{reviewed:2,known:1,needs_review:1});
});
test('UX10 routes and links do not change gameplay scoring',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../public/shared-nav.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
 assert.match(api,/learning\/flashcards\/reviews/);assert.match(api,/learning\/flashcards\/progress/);
 assert.match(nav,/\/progress\.html/);assert.match(html,/Xem toàn bộ tiến độ/);
});

test('UX10 includes shared desktop/mobile dock stylesheet in correct order',()=>{
 const progress=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const mobile=readFileSync(new URL('../public/ux02-home-nav.css',import.meta.url),'utf8');
 const expected=['/shared-nav.css','/ux-design-system.css','/ux02-home-nav.css','/ux10-progress.css'];
 const refs=[...progress.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(refs,expected);
 assert.match(mobile,/#wsSharedNav \.ws-mobile-dock\{display:none\}/);
 assert.match(mobile,/@media\(max-width:680px\)/);
 assert.match(mobile,/#wsSharedNav:not\(\.ws-dock-hidden\) \.ws-mobile-dock/);
});

test('Flashcard first visit persists its actual sample vocabulary without replacing existing saved decks',()=>{
 const html=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
 assert.match(html,/installTopicPackOnce\(\);[\s\S]*?if\(!loaded&&safeStorage\.read\(STORE\)===null\)saveTopics\(\);/);
 assert.match(html,/if\(!\(server\?saveServerLearned\(\):saveLearned\(\)\)\)/);
 assert.match(html,/if\(previous===undefined\)delete progress\[mark\]/);
});

test('UX10 displays fractional progress for first remembered card in large deck',()=>{
 const words=Array.from({length:260},(_,i)=>({key:'Topic:word'+i}));
 assert.deepEqual(summarize(words,{'Topic:word0':true}),{total:260,known:1,review:259,percent:0.4});
 assert.equal(summarize(words,{}).percent,0);
 assert.equal(summarize(words,Object.fromEntries(words.map(w=>[w.key,true]))).percent,100);
});

test('UX10 account catalog is authenticated and exposes full word identity, never browser key',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../lib/learning-progress.js',import.meta.url),'utf8');
 assert.match(api,/key==='learning\/flashcards\/catalog'\)\{mustPlayer\(req\)/);
 assert.match(service,/w\.id AS word_id,t\.title AS topic,w\.english,w\.ipa,w\.meaning,w\.example,w\.translation/);
 assert.match(api,/e\.code==='42P01'&&requestSegments\[0\]==='learning'/);
});
test('UX10 new public tables deny Data API roles by RLS and grants',()=>{
 const migration=readFileSync(new URL('../db/migrations/20261025_ux10_flashcard_progress.sql',import.meta.url),'utf8');
 for(const name of ['ws_learning_flashcard_reviews','ws_learning_word_progress']){
  assert.match(migration,new RegExp('ALTER TABLE public\\.'+name+' ENABLE ROW LEVEL SECURITY'));
  assert.match(migration,new RegExp('REVOKE ALL ON public\\.'+name+' FROM PUBLIC;'));
 }
});

test('UX10 migration remains compatible with PostgreSQL without Supabase Data API roles',()=>{
 const migration=readFileSync(new URL('../db/migrations/20261025_ux10_flashcard_progress.sql',import.meta.url),'utf8');
 assert.match(migration,/IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = role_name\)/);
 assert.match(migration,/EXECUTE format\('REVOKE ALL ON TABLE public\.%I FROM %I'/);
});
