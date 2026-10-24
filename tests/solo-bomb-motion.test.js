import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('BOMB poll reconciles stable card nodes by ID, without destroying the arena',()=>{
 assert.match(js,/data-bomb-id="\$\{escapeHtml\(b\.id\)\}"/);
 assert.match(js,/function reconcileBombCards\(arena,g,rd\)/);
 assert.match(js,/if\(!visible\.has\(node\.dataset\.bombId\)\)/);
 assert.match(js,/if\(!present\.has\(String\(bomb\.id\)\)\)arena\.insertAdjacentHTML/);
 for(const name of ['syncBombArena','syncSoloBombArena']){
  const start=js.indexOf('function '+name+'(){');
  assert.ok(start>=0,name+' missing');
  const next=js.indexOf('\nfunction ',start+1);
  const code=js.slice(start,next);
  assert.match(code,/reconcileBombCards\(arena,g,rd\)/);
  assert.doesNotMatch(code,/arena\.innerHTML=/,name+' should never recreate the cards');
 }
});

test('bombs use compositor animation with server timestamps and no polling-driven transition',()=>{
 const start=js.indexOf('function animateBombs(');
 const end=js.indexOf('function updateCountdowns()',start);
 const body=js.slice(start,end);
 assert.match(body,/bomb\.animate\(\[/);
 assert.match(body,/animation\.currentTime=elapsed/);
 assert.match(body,/const key=`\$\{spawn\}:\$\{deadline\}:\$\{floor\}`/);
 assert.match(body,/if\(bomb\._fallKey!==key\|\|!bomb\._fallMotion\)/);
 assert.match(body,/prefers-reduced-motion: reduce/);
 assert.match(css,/\.bomb-falling\{will-change:transform\}/);
});

test('BOMB Solo preserves live arena while answering, retrying and losing health',()=>{
 assert.match(js,/pending\.mode==='BOMB'&&syncSoloBombArena\(\)/);
 assert.match(js,/soloGame\?\.game\?\.mode==='BOMB'&&soloGame\.game\.status==='PLAYING'&&syncSoloBombArena\(\)/);
 assert.match(js,/out\.game\.mode==='BOMB'&&out\.game\.status==='PLAYING'&&syncSoloBombArena\(\)/);
 assert.match(js,/class="solo-bomb-feedback-text"/);
 assert.match(js,/label\.textContent=soloFeedback/);
});
