import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const page=read('public/matrix.html');
const client=read('public/matrix.js');
const css=read('public/matrix.css');
const home=read('public/index.html');
const audio=read('public/game-audio.js');
const nav=read('public/shared-nav.js');
test('UX33 pages and JS parse and appear in existing game library',()=>{
 assert.doesNotThrow(()=>new vm.Script(client));
 assert.match(home,/href="\/matrix\.html"/);
 assert.match(home,/05 · MATRIX SOLO/);
 assert.match(page,/data-ws-page="matrix"/);
 assert.match(page,/src="\/matrix\.js" defer/);
 assert.match(page,/src="\/game-audio\.js" defer/);
 assert.match(nav,/key:'matrix',label:'Ma trận thẻ',url:'\/matrix\.html'/);
});
test('UX33 UI exposes three real matrix dimensions, clear heart scoring and server state',()=>{
 for(const size of [6,10,12])assert.match(page,new RegExp('<option value="'+size+'">'));
 assert.match(page,/Hết 3 tim là thua/);
 assert.match(page,/\+100 điểm/);
 assert.match(page,/−25 điểm/);
 assert.match(client,/MODE\.toLowerCase\(\)\+'\/start'/);
 assert.match(client,/solo\/runs\//);
 assert.match(client,/attemptId/);
 assert.match(client,/firstId/);
 assert.match(client,/secondId/);
 assert.match(client,/credentials:'same-origin'/);
 assert.doesNotMatch(client,/localStorage|sessionStorage\.setItem\([^\n]*(score|english|meaning)/);
});
test('UX34 12x12 cards remain readable on mobile and are keyboard accessible',()=>{
 assert.match(css,/overflow:auto/);
 assert.match(css,/--matrix-cell:98px/);
 assert.match(css,/touch-action:pan-x pan-y/);
 assert.match(css,/:focus-visible/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(page,/id="matrixScroll" tabindex="0"/);
 assert.match(client,/aria-pressed/);
 assert.match(client,/role=|matrixGrid/);
});
test('UX33 audio reuses original procedural music with user gesture unlocking',()=>{
 assert.match(audio,/MATRIX: \{ms:/);
 assert.match(audio,/document\.getElementById\('matrixAudio'\)/);
 assert.match(client,/audio\(\)\?\.unlock\(\)/);
 assert.match(client,/setScene\(MODE,/);
 assert.match(client,/\.cue\(/);
 assert.doesNotMatch(client,/new Audio\(|\.mp3|\.ogg/);
});
test('UX33 prevents silent client-authoritative scoring and double sends',()=>{
 assert.doesNotMatch(client,/game\.score\s*[+\-]=|game\.health\s*--/);
 assert.match(client,/save\(PENDING_KEY,pending\)/);
 assert.match(client,/attempts\/\x27\+pending\.attemptId/);
 assert.match(client,/if\(readAttempt\.attempt\?\.applied\)/);
 assert.match(client,/syncFinished|reviewSync/);
});
