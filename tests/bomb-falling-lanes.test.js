import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

function extractFunction(name,next){
 const begin=app.indexOf('function '+name+'(');
 const end=app.indexOf('\nfunction '+next+'(',begin);
 assert.ok(begin!==-1&&end>begin,name+' must be present');
 return app.slice(begin,end);
}

test('both BOMB modes use independent falling lanes, not a static queue',()=>{
 assert.match(app,/class="bomb-arena bomb-falling-lanes solo-bomb-arena"/);
 assert.match(app,/class="bomb-arena bomb-falling-lanes" id="bombArena"/);
 assert.doesNotMatch(app,/bomb-queue-layout/);
 assert.match(css,/\.bomb-arena\.bomb-falling-lanes\{\s*display:grid/);
 assert.match(css,/\.bomb-fall-track\{\s*position:relative/);
 assert.match(css,/\.bomb-arena\.bomb-falling-lanes \.bomb-falling\{\s*position:absolute/);
 assert.doesNotMatch(css,/\.bomb-arena\.bomb-falling-lanes \.bomb-falling\{[^}]*transform:none!important/);
});

test('each active bomb receives its own track, including bombs from a later wave',()=>{
 const render=new Function('escapeHtml','localTimeOffset',extractFunction('bombCardMarkup','bombCardsMarkup')+'\nreturn bombCardMarkup;')(
  v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;'),0);
 const now=Date.now();
 const words=[{id:'old-a',meaning:'Con mèo',slot:0},{id:'old-b',meaning:'Con chó',slot:1},{id:'new-a',meaning:'Xe đạp',slot:0},{id:'new-b',meaning:'Đi học',slot:1}];
 const cards=words.map((b,i)=>render({...b,spawnAt:now+i*1000,deadline:now+15000+i*1000},{bomb_batch_size:2})).join('');
 assert.equal((cards.match(/class="bomb-fall-track"/g)||[]).length,4);
 assert.equal((cards.match(/class="bomb-falling"/g)||[]).length,4);
 for(const b of words){assert.ok(cards.includes(`data-bomb-track="${b.id}"`));assert.ok(cards.includes(b.meaning))}
});

test('polling retains active nodes and deletes expired wrapper with card',()=>{
 const fn=extractFunction('reconcileBombCards','syncBombArena');
 assert.match(fn,/if\(!present\.has\(String\(bomb\.id\)\)\)arena\.insertAdjacentHTML/);
 assert.match(fn,/node\.closest\('\.bomb-fall-track'\)/);
 assert.doesNotMatch(fn,/arena\.innerHTML\s*=/);
 assert.match(app,/function syncSoloBombArena\(\)/);
 assert.match(app,/function syncBombArena\(\)/);
 assert.match(css,/overflow-y:auto/);
});

test('falling animation uses server deadline and individual track distance',()=>{
 const source=extractFunction('animateBombs','updateCountdowns');
 const animate=new Function('window','localTimeOffset','$',source+'\nreturn animateBombs;')(
  {matchMedia:()=>({matches:false})},0,()=>null);
 const now=Date.now();
 let frames=null,animations=0;
 const bomb={dataset:{bombSpawn:String(now-2000),bombDeadline:String(now+8000)},offsetHeight:66,style:{},
   closest:selector=>selector==='.bomb-fall-track'?{clientHeight:164}:null,
   querySelector:selector=>selector==='small'?{textContent:''}:null,
   animate:(input)=>{frames=input;animations++;return{currentTime:0,cancel(){}}}};
 const arena={clientHeight:340,querySelectorAll:selector=>selector==='.bomb-falling'?[bomb]:[]};
 animate(arena);
 assert.equal(animations,1);
 assert.equal(frames[0].transform,'translate(-50%,5px)');
 assert.equal(frames[1].transform,'translate(-50%,90px)');
 const active=bomb._fallMotion;
 animate(arena);
 assert.strictEqual(bomb._fallMotion,active,'server polling should not reset the fall animation');
 assert.equal(animations,1);
});
