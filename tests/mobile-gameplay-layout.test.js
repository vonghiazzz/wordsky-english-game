import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const learn=fs.readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');

test('mobile gameplay layout scopes MATCH, BOMB and CAR to Solo and Multiplayer',()=>{
 for(const pane of ['liveGame','soloGamePane','soloBombGamePane','soloCarGamePane'])
  assert.ok(css.includes('#'+pane+' .game-shell'),pane+' compact shell');
 assert.match(css,/#liveGame \.pair-grid,#soloGamePane \.pair-grid/);
 assert.match(css,/#liveGame \.bomb-arena,#soloBombGamePane \.solo-bomb-arena/);
 assert.match(css,/#liveGame \.car-stage,#soloCarGamePane \.solo-car-stage/);
});
test('room cards stay visible except when an active round is playing',()=>{
 assert.match(css,/#roomPane\.mobile-round-playing > \.room-card\{display:none\}/);
 assert.match(app,/classList\.toggle\('mobile-round-playing',g\.status==='PLAYING'\)/);
 assert.match(app,/classList\.remove\('mobile-round-playing'\)/);
});
test('native text focus is requested on entry without changing server game rules',()=>{
 assert.match(app,/function focusGameplayInput\(input\)/);
 assert.match(app,/focusGameplayInput\(\$\('bombAnswer'\)\|\|\$\('carAnswer'\)\)/);
 assert.match(app,/focusGameplayInput\(\$\('soloBombAnswer'\)\|\|\$\('soloCarAnswer'\)\)/);
 assert.match(css,/\.game-keyboard\{display:none!important\}/);
 assert.match(app,/input\.focus\(\{preventScroll:true\}\)/);
});
test('Learn falling letters and typing have consistent compact HUD',()=>{
 assert.match(learn,/#gamePanel \.game-header\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(learn,/#gamePanel \.game-area:not\(\.typing-active\)/);
 assert.match(learn,/#gamePanel \.game-area\.typing-active/);
 assert.match(learn,/classList\.toggle\('mobile-game-running',state\.running&&!state\.paused\)/);
 assert.match(learn,/function focusTypingInput\(\)/);
 assert.match(learn,/\.game-area\.typing-active:not\(\.typing-running\) \.typing-dock\{display:none\}/);
 assert.doesNotMatch(learn,/id="virtualKeyboard"/);
});
