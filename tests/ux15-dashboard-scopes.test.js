import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseServerProgress,serverCatalogView,saveServerProgress,lastPersonalSelection,loadCachedCatalog,validateAndCacheCatalog,SERVER_PROGRESS_KEY,SOURCE_PREFERENCE_KEY} from '../public/ux15-dashboard-data.js';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
const one=(id,english)=>({word_id:id,topic:'Food',card:[english,'/ipa/','Nghĩa','Example','Bản dịch']});
const store=initial=>{const map=new Map(Object.entries(initial));return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),dump:()=>Object.fromEntries(map)}};
test('UX15 server dashboard computes real server 365 and UUID remembered count',()=>{
 const parsed={words:[one(a,'apple'),one(b,'pear')],count:2,topicCount:1};
 const progress=parseServerProgress(JSON.stringify({[a]:true}));
 const view=serverCatalogView(parsed,progress);
 assert.equal(view.source,'server');assert.equal(view.words.length,2);
 assert.equal(view.learned['server:'+a],true);
 assert.equal(view.learned['server:'+b],undefined);
 assert.equal(view.words[0].english,'apple');
});
test('UX15 server word content edit preserves UUID decision, new UUID never inherits it',()=>{
 const saved=parseServerProgress(JSON.stringify({[a]:true}));
 assert.equal(serverCatalogView({words:[one(a,'new apple')]},saved).learned['server:'+a],true);
 assert.deepEqual(serverCatalogView({words:[one(b,'apple')]},saved).learned,{});
});
test('UX15 marking server UUID never mutates legacy local 10/260 progress',()=>{
 const initial={'wordsky_learned':'{"Daily Life:wake":true}','wordsky_vocab_v2':'legacy deck'};
 const s=store(initial);
 const saved=saveServerProgress(s,a,true);
 assert.equal(saved[a],true);assert.equal(s.dump()[SERVER_PROGRESS_KEY],JSON.stringify({[a]:true}));
 assert.equal(s.dump().wordsky_learned,initial.wordsky_learned);
 assert.equal(s.dump().wordsky_vocab_v2,'legacy deck');
 saveServerProgress(s,a,false);
 assert.deepEqual(JSON.parse(s.dump()[SERVER_PROGRESS_KEY]),{});
 assert.equal(s.dump().wordsky_learned,initial.wordsky_learned);
});
test('UX15 malformed UUID-progress fails closed rather than deleting previous state',()=>{
 const original='{"not-an-uuid":true}';const s=store({[SERVER_PROGRESS_KEY]:original});
 assert.ok(parseServerProgress(original).error);
 assert.throws(()=>saveServerProgress(s,a,true));
 assert.equal(s.dump()[SERVER_PROGRESS_KEY],original);
 assert.ok(parseServerProgress('{bad').error);
 assert.ok(parseServerProgress('[]').error);
 assert.ok(parseServerProgress('{"00000000-0000-4000-8000-000000000001":false}').error);
});
test('UX15 public catalog cache validated and preference can select personal deck',()=>{
 const s=store({[SOURCE_PREFERENCE_KEY]:'local'});
 assert.equal(lastPersonalSelection(s),true);
 const payload={scope:'catalog',words:[{word_id:a,topic:'Food',english:'apple',ipa:'',meaning:'Táo',example:'',translation:''}]};
 const parsed=validateAndCacheCatalog(s,payload,1700000000000);
 assert.equal(parsed.count,1);
 assert.equal(loadCachedCatalog(s,1700000000010).count,1);
 assert.equal(lastPersonalSelection(store({})),false);
 assert.throws(()=>validateAndCacheCatalog(s,{scope:'catalog',words:[{word_id:'invalid'}]}));
});
test('UX15 browser selector distinguishes account/server/personal without cross-browser claims',()=>{
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 assert.match(html,/id="ws15Scope"/);
 assert.match(html,/value="account"/);assert.match(html,/value="server"/);assert.match(html,/value="local"/);
 assert.match(js,/const view = scopeView\(\)/);
 assert.match(js,/isServer \? updateServerCard\(card,true\) : updateCard\(card,true\)/);
 assert.match(js,/saveServerProgress\(localStorage,card.word_id,remembered\)/);
 assert.match(js,/Không tự chia sẻ tiến độ giữa Chrome, Safari hoặc điện thoại/);
});
