import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectLearningView} from '../public/ux11-dashboard-model.js';
import {summarize,filterWords} from '../public/ux10-progress.js';

const browser={words:[{key:'Food:apple',topic:'Food',english:'apple',meaning:'Táo'}],learned:{'Food:apple':true},initialized:true,error:null};
const catalog=[
  {word_id:'a',topic:'Daily Life',english:'wake',meaning:'Thức dậy',ipa:'/weɪk/',example:'I wake up.',translation:'Tôi thức dậy.'},
  {word_id:'b',topic:'Food',english:'apple',meaning:'Quả táo'},
  {word_id:'c',topic:'Daily Life',english:'study',meaning:'Học'}
];
const account={kind:'ready',actor:{id:'u1'},catalog,words:[
  {word_id:'a',remembered:true},{word_id:'b',remembered:false}
]};
test('UX11 uses account catalog+decisions as primary dashboard after login',()=>{
 const view=selectLearningView(browser,account);
 assert.equal(view.source,'account');
 assert.deepEqual(summarize(view.words,view.learned),{total:3,known:1,review:2,percent:33.3});
 assert.equal(view.words[0].key,'account:a');
 assert.equal(view.words[1].key,'account:b');
 assert.equal(view.words[0].ipa,'/weɪk/');
 assert.deepEqual(filterWords(view.words,view.learned,{status:'known'}).map(w=>w.english),['wake']);
 assert.deepEqual(filterWords(view.words,view.learned,{status:'review'}).map(w=>w.english),['apple','study']);
 assert.equal(browser.learned['Food:apple'],true,'must not mutate local state');
});
test('UX11 new browser with same account sees same real account metrics without localStorage',()=>{
 const empty={words:[],learned:{},initialized:false,error:null};
 const a=selectLearningView(empty,account),b=selectLearningView(browser,account);
 assert.deepEqual(summarize(a.words,a.learned),summarize(b.words,b.learned));
 assert.equal(summarize(a.words,a.learned).known,1);
});
test('UX11 guest and unavailable account do not fabricate account zero or erase browser state',()=>{
 for(const state of [{kind:'guest'},{kind:'checking'},{kind:'error',message:'503 migration missing'},null]){
  const view=selectLearningView(browser,state);
  assert.equal(view.source,'browser');assert.equal(view.learned['Food:apple'],true);
  assert.equal(summarize(view.words,view.learned).known,1);
 }
});
test('UX11 false decisions are distinct from never-reviewed records',()=>{
 const view=selectLearningView(browser,account);
 assert.equal(view.learned['account:b'],undefined);
 assert.equal(view.learned['account:c'],undefined);
 assert.equal(account.words[1].remembered,false);
 assert.equal(account.words.length,2,'reviewed count only includes actual events');
});
test('UX11 deduplicates identical UUIDs without joining words by English',()=>{
 const twin=[{...catalog[0]},{...catalog[0]},{...catalog[1],word_id:'other',english:'wake'}];
 const view=selectLearningView(browser,{kind:'ready',catalog:twin,words:[{word_id:'a',remembered:true}]});
 assert.equal(view.words.length,2);assert.equal(view.words.filter(x=>x.english==='wake').length,2);
 assert.equal(summarize(view.words,view.learned).known,1);
});
test('UX11 browser-only fallback preserves corrupt-local read errors; account success does not read bad local data',()=>{
 const local={words:[],learned:{},initialized:true,error:'Dữ liệu cũ không hợp lệ'};
 assert.equal(selectLearningView(local,{kind:'error',message:'503'}).error,local.error);
 assert.equal(selectLearningView(local,account).error,null);
});
test('UX11 account actions never call localStorage and account UI is clearly scoped',()=>{
 const js=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 assert.match(js,/selectLearningView\(state,account\)/);
 assert.match(js,/isAccount \? updateAccountCard\(card, true\) : updateCard\(card, true\)/);
 assert.match(js,/if \(session.actor\?\.role !== 'player' \|\| session.actor.id !== clickedBy\)/);
 assert.match(js,/await postAccountReview\(card.word_id,remembered,clickedBy\)/);
 for(const id of ['ws10HeroScope','ws10SourceBadge','ws10StorageText','ws10TotalHint','ws10ReviewHint','ws10LibraryHint'])
   assert.match(html,new RegExp('id="'+id+'"'));
});
test('UX11 ADR describes planned SRS/game designs without deploying future tables',()=>{
 const doc=readFileSync(new URL('../docs/learning-architecture-adr-001.md',import.meta.url),'utf8');
 assert.match(doc,/Phase 2 — Smart Review/);
 assert.match(doc,/Phase 3 — Game-to-Learn evidence/);
 assert.match(doc,/not deployed/i);
 assert.match(doc,/manual import/i);
});
