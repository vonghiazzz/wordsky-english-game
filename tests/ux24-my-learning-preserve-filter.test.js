import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterWords,retainTopicFilterSelection} from '../public/ux10-progress.js';

const words=[
  {key:'shared:1',topic:'Daily Life',english:'sleep',meaning:'Ngủ'},
  {key:'shared:2',topic:'Daily Life',english:'wake',meaning:'Thức dậy'},
  {key:'shared:3',topic:'Food',english:'apple',meaning:'Táo'}
];

test('My Learning retains Daily Life filter while account review refresh is in flight',()=>{
 let selected='Daily Life';
 const learned={'shared:1':true,'shared:2':true,'shared:3':false};
 assert.deepEqual(filterWords(words,learned,{topic:selected,status:'review'}),[]);
 // refreshUnified briefly had an empty list; this must not replace the
 // user's chosen topic with the implicit All Topics default.
 selected=retainTopicFilterSelection(selected,[],true);
 assert.equal(selected,'Daily Life');
 // The confirmed review of sleep changed only that card to Need review.
 const current={...learned,'shared:1':false};
 selected=retainTopicFilterSelection(selected,['Daily Life','Food'],false);
 const filtered=filterWords(words,current,{topic:selected,status:'review'});
 assert.deepEqual(filtered.map(w=>w.english),['sleep']);
 assert.equal(selected,'Daily Life');
});

test('My Learning keeps search and status selections; drops filters not in final account snapshot',()=>{
 const options={query:'sl',topic:'Daily Life',status:'review'};
 let chosen=retainTopicFilterSelection(options.topic,[],true);
 chosen=retainTopicFilterSelection(chosen,['Daily Life','Food']);
 assert.equal(filterWords(words,{'shared:1':false},{...options,topic:chosen})[0].english,'sleep');
 assert.equal(retainTopicFilterSelection(chosen,['Food'],false),'');
 assert.equal(retainTopicFilterSelection('',[],false),'');
});

test('My Learning review refresh preserves same-account list but re-checks actor before showing another account',()=>{
 const ui=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 assert.match(ui,/const preserveReady=unified\.kind==='ready'&&/);
 assert.match(ui,/if\(!preserveReady\)\{unified=\{kind:'checking'\};render\(\);\}/);
 assert.match(ui,/if\(preserveReady&&actorId!==preserveReadyActorId\)/);
 assert.match(ui,/await refreshUnified\(\{preserveReadyActorId:actorId\}\)/);
 assert.match(ui,/selectedTopicFilter=retainTopicFilterSelection\(selectedTopicFilter,topics,waitingAccount\)/);
 assert.match(ui,/if\(!waitingAccount\)\{\s*topicFilter\.replaceChildren/);
 assert.match(ui,/if\(element===topicFilter\)selectedTopicFilter=topicFilter\.value/);
 assert.match(ui,/for \(const button of \[knownBtn, reviewBtn\]\) button\.type = 'button'/);
});
