import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBrowserPersonal,planBrowserPersonalImport} from '../public/ux18-personal-core.js';
const key='wordsky_vocab_v2',flag='wordsky_learned';
const deck={version:2,topics:{Food:[['apple','/a/','Táo','Apple is red.','Táo màu đỏ.'],['pear','','Lê','','']]}};
const saved=JSON.stringify(deck),learned=JSON.stringify({'Food:apple':true});
const storage=(v=saved,l=learned)=>({getItem:k=>k===key?v:k===flag?l:null});
const existing=(english,meaning,id)=>({id,topic:'Food',english,ipa:english==='apple'?'/a/':'',meaning,example:english==='apple'?'Apple is red.':'',translation:english==='apple'?'Táo màu đỏ.':''});
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
test('UX18 reads browser vocabulary and marked words without changing localStorage',()=>{
 const original={ [key]:saved,[flag]:learned};const state=readBrowserPersonal(storage());
 assert.equal(state.error,null);assert.equal(state.words.length,2);
 assert.equal(state.words[0].known,true);assert.equal(state.words[1].known,false);
 assert.equal(original[key],saved);assert.equal(original[flag],learned);
});
test('UX18 imports missing cards; matching existing cards can get remembered only when not reviewed',()=>{
 const state=readBrowserPersonal(storage());
 const plan=planBrowserPersonalImport(state,[existing('apple','Táo',a)],[]);
 assert.deepEqual(plan.entries.map(x=>x.type),['remember','create']);
 assert.equal(plan.entries[0].id,a);
 assert.equal(plan.entries[1].word.english,'pear');
 assert.equal(plan.conflicts,0);
 const skip=planBrowserPersonalImport(state,[existing('apple','Táo',a)],[{personal_word_id:a,remembered:false}]);
 assert.deepEqual(skip.entries.map(x=>x.type),['create']);
 assert.equal(skip.existing,1);
});
test('UX18 cannot overwrite same topic+word with edited meaning',()=>{
 const state=readBrowserPersonal(storage());
 const p=planBrowserPersonalImport(state,[existing('apple','khác',a),existing('pear','Lê',b)],[]);
 assert.equal(p.conflicts,1);assert.equal(p.entries.length,0);
 assert.equal(p.existing,1);
});
test('UX18 never imports corrupt, duplicate, or oversized browser decks',()=>{
 const corrupt=[
 storage('not-json'),storage(JSON.stringify({topics:{Food:[['apple']]}})),
 storage(JSON.stringify({topics:{Food:[deck.topics.Food[0],deck.topics.Food[0]]}})),
 storage(saved,'not-json'),storage(JSON.stringify({topics:{Food:'wrong'}}))
 ];
 for(const x of corrupt){const state=readBrowserPersonal(x);assert.ok(state.error);assert.equal(planBrowserPersonalImport(state,[],[]).entries.length,0)}
});
test('UX18 account page uses authenticated mutations, manual confirmation and clear local-vs-account labels',()=>{
 const html=readFileSync(new URL('../public/personal.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ux18-personal.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 assert.match(js,/learningApi\('auth\/me'\)/);
 assert.match(js,/expected_actor_id:actor.id/);
 assert.match(js,/window.confirm\('Chuyển '/);
 assert.match(js,/plan.entries.slice\(0,20\)/);
 assert.match(js,/learning\/personal\/reviews/);
 assert.match(html,/id="personalImportButton"/);
 assert.match(html,/id="personalForm"/);
 assert.match(source,/id="ws18AccountSummary"/);
 assert.match(source,/href="\/personal.html"/);
});
