import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

function extract(from,to){
 const start=app.indexOf('function '+from+'(');
 const end=app.indexOf('\nfunction '+to+'(',start);
 assert.ok(start!==-1&&end>start,`${from} -> ${to} block must exist`);
 return app.slice(start,end);
}
const escapeHtml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;');
const bombModule=new Function('escapeHtml','localTimeOffset',
 extract('bombLaneCount','bombArenaMarkup')+'\nreturn {bombLaneCount,bombLaneIndex,bombCardMarkup,bombCardsMarkup};'
)(escapeHtml,0);

function bomb(id,slot,spawnAt,deadline){return{id,meaning:'Nghĩa '+id,slot,spawnAt,deadline}}

// Structural checks: a fixed number of columns must be created ONCE, not one new track for every bomb.
test('Solo and Multiplayer render 1-3 fixed columns, not one track per bomb',()=>{
 assert.match(app,/class="bomb-arena bomb-fixed-columns solo-bomb-arena"/);
 assert.match(app,/class="bomb-arena bomb-fixed-columns" id="bombArena"/);
 assert.match(app,/style="--bomb-lanes:\$\{bombLaneCount\(rd\)\}"/);
 assert.match(css,/grid-template-columns:repeat\(var\(--bomb-lanes,2\),minmax\(0,1fr\)\)/);
 assert.match(css,/\.bomb-fixed-lane\{[\s\S]*?position:relative/);
 assert.match(css,/\.bomb-fixed-columns \.bomb-falling\{[\s\S]*?position:absolute;top:0;left:50%!important/);
 assert.doesNotMatch(css,/\.bomb-arena\.bomb-fixed-columns\{[^}]*overflow-x:auto/);
 assert.doesNotMatch(app,/bomb-fall-track|bomb-falling-lanes/);
});

test('each later-wave bomb is rendered within its ORIGINAL server slot',()=>{
 const t=Date.now();
 const words=[bomb('old-left',0,t-7000,t+13000),bomb('old-right',1,t-7000,t+13000),
              bomb('new-left',0,t,t+20000),bomb('new-right',1,t,t+20000)];
 const html=bombModule.bombCardsMarkup({bombs:words,left:4},{bomb_batch_size:2});
 const lane0=html.slice(html.indexOf('data-lane="0"'),html.indexOf('data-lane="1"'));
 const lane1=html.slice(html.indexOf('data-lane="1"'));
 assert.equal((html.match(/class="bomb-fixed-lane"/g)||[]).length,2);
 assert.equal((html.match(/class="bomb-falling"/g)||[]).length,4);
 assert.match(lane0,/data-bomb-id="old-left"/);assert.match(lane0,/data-bomb-id="new-left"/);
 assert.doesNotMatch(lane0,/data-bomb-id="old-right"|data-bomb-id="new-right"/);
 assert.match(lane1,/data-bomb-id="old-right"/);assert.match(lane1,/data-bomb-id="new-right"/);
 assert.doesNotMatch(lane1,/data-bomb-id="old-left"|data-bomb-id="new-left"/);
});

test('one, two and three column settings remain stable without horizontal overflow',()=>{
 const t=Date.now();
 for(const count of [1,2,3]){
  const rd={bomb_batch_size:count};
  const words=Array.from({length:count*3},(_,i)=>bomb('b'+i,i%count,t+i*1000,t+60000));
  const html=bombModule.bombCardsMarkup({bombs:words,left:words.length},rd);
  assert.equal((html.match(/class="bomb-fixed-lane"/g)||[]).length,count);
  for(let lane=0;lane<count;lane++)assert.equal((html.match(new RegExp(`data-bomb-slot="${lane}"`,'g'))||[]).length,3);
 }
 assert.equal(bombModule.bombLaneCount({bomb_batch_size:99}),3);
 assert.equal(bombModule.bombLaneIndex({slot:-1},{bomb_batch_size:2}),0);
 assert.equal(bombModule.bombLaneIndex({slot:2},{bomb_batch_size:3}),2);
});

test('new bombs are inserted into their persistent lane, not into the arena flex/grid root',()=>{
 const src=extract('reconcileBombCards','syncBombArena');
 assert.doesNotMatch(src,/arena\.innerHTML\s*=/);
 assert.doesNotMatch(src,/arena\.insertAdjacentHTML/);
 assert.match(src,/arena\.querySelector\(`\.bomb-fixed-lane\[data-lane=/);
 assert.match(src,/lane\.insertAdjacentHTML\('beforeend',bombCardMarkup\(bomb,rd\)\)/);
 assert.match(src,/if\(!visible\.has\(node\.dataset\.bombId\)\)\{node\._fallMotion\?\.cancel\(\);node\.remove\(\)\}/);
 assert.doesNotMatch(src,/\.bomb-fixed-lane.*\.remove\(/);
 assert.match(app,/function syncSoloBombArena\(\)/);
 assert.match(app,/function syncBombArena\(\)/);
});

test('polling adds the next wave without replacing existing nodes or shifting columns',()=>{
 const code=extract('reconcileBombCards','syncBombArena');
 const lanes=[{inserted:[]},{inserted:[]}],old=[{dataset:{bombId:'old-left'},removed:false},{dataset:{bombId:'old-right'},removed:false}];
 let animateCount=0;
 const reconcile=new Function('bombLaneIndex','bombCardMarkup','animateBombs',code+'\nreturn reconcileBombCards;')(
  bombModule.bombLaneIndex,bombModule.bombCardMarkup,()=>{animateCount++});
 const headline={textContent:''};
 const arena={
  querySelector(selector){if(selector==='.bomb-topline')return headline;
   const matched=selector.match(/^\.bomb-fixed-lane\[data-lane="(\d+)"\]$/);
   return matched?{insertAdjacentHTML:(position,html)=>lanes[Number(matched[1])].inserted.push(html)}:null;
  },
  querySelectorAll(selector){assert.equal(selector,'.bomb-falling');return old.filter(v=>!v.removed)}
 };
 const now=Date.now();
 reconcile(arena,{left:4,bombs:[bomb('old-left',0,now-2000,now+8000),bomb('old-right',1,now-2000,now+8000),bomb('new-left',0,now,now+10000),bomb('new-right',1,now,now+10000)]},{bomb_batch_size:2});
 assert.equal(lanes[0].inserted.length,1);assert.match(lanes[0].inserted[0],/new-left/);
 assert.equal(lanes[1].inserted.length,1);assert.match(lanes[1].inserted[0],/new-right/);
 assert.ok(old.every(x=>x.removed===false));
 assert.equal(animateCount,1);
});

test('server-clock animation moves each bomb vertically without changing its X lane or resetting on poll',()=>{
 const source=extract('animateBombs','updateCountdowns');
 const animate=new Function('window','localTimeOffset','$',source+'\nreturn animateBombs;')(
  {matchMedia:()=>({matches:false})},0,()=>null);
 const now=Date.now();let frames=null,number=0;
 const card={
  dataset:{bombSpawn:String(now-2000),bombDeadline:String(now+8000)},offsetHeight:66,style:{},
  closest:selector=>selector==='.bomb-fixed-lane'?{clientHeight:164}:null,
  querySelector:selector=>selector==='small'?{textContent:''}:null,
  animate:(input)=>{frames=input;number++;return{currentTime:0,cancel(){}}}
 };
 const arena={clientHeight:340,querySelectorAll:()=>[card]};
 animate(arena);const motion=card._fallMotion;
 assert.equal(number,1);
 assert.equal(frames[0].transform,'translate(-50%,5px)');
 assert.equal(frames[1].transform,'translate(-50%,90px)');
 animate(arena);
 assert.equal(number,1);assert.strictEqual(card._fallMotion,motion);
 assert.match(source,/const height=track\?track\.clientHeight:arena\.clientHeight/);
 assert.match(source,/animation\.currentTime=elapsed/);
});

test('a removed bomb cannot remove, resize or reorder the shared lane',()=>{
 const source=extract('reconcileBombCards','syncBombArena');
 let deleted=0,cancelled=0;
 const oldNode={dataset:{bombId:'expired'},_fallMotion:{cancel(){cancelled++}},remove(){deleted++}};
 let laneTouched=0;
 const lane={insertAdjacentHTML(){laneTouched++}};
 const arena={
  querySelector:s=>s==='.bomb-topline'?{textContent:''}:lane,
  querySelectorAll:()=>[oldNode]
 };
 const reconcile=new Function('bombLaneIndex','bombCardMarkup','animateBombs',source+'\nreturn reconcileBombCards;')(
  bombModule.bombLaneIndex,bombModule.bombCardMarkup,()=>{});
 reconcile(arena,{left:0,bombs:[]},{bomb_batch_size:2});
 assert.equal(deleted,1);assert.equal(cancelled,1);assert.equal(laneTouched,0);
});
