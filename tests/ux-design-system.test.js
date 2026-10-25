import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=file('public/index.html');
const learn=file('public/learn.html');
const css=file('public/ux-design-system.css');
const base=file('public/style.css');
const nav=file('public/shared-nav.js');
const game=file('public/app.js');

// These checks protect the boundary between visual design and server-owned gameplay.
test('Arena and Learn load one shared UX stylesheet AFTER their existing CSS',()=>{
 for(const html of [home,learn]){
  const link='<link rel="stylesheet" href="/ux-design-system.css" />';
  assert.equal(html.split(link).length-1,1,'exactly one UX stylesheet link');
  assert.ok(html.indexOf(link)>html.indexOf('href="/shared-nav.css"'),'UX stylesheet must be last');
 }
});

test('shared colors and reusable components have stable names',()=>{
 for(const token of ['bg','surface','surface-raised','border','text','muted','accent','mint','gold','danger','focus'])
  assert.match(css,new RegExp('--ws-color-'+token+':'));
 for(const cls of ['ws-ui-card','ws-ui-button','ws-ui-button--primary','ws-ui-button--danger','ws-ui-field','ws-ui-badge'])
  assert.ok(css.includes('.'+cls),cls);
});

test('UX layer never styles the falling BOMB/CAR/Chữ rơi motion DOM',()=>{
 for(const selector of ['.bomb-falling','.bomb-fixed-lane','.bomb-arena','.car-stage','.car-vehicle','.car-lanes','.falling-word','.game-area','.typing-dock'])
  assert.ok(!css.includes(selector+'{')&&!css.includes(selector+' {'),selector);
 assert.match(base,/\.bomb-fixed-columns/);
 assert.match(game,/function reconcileBombCards\(/);
 assert.match(learn,/function spawnFallingWord\(/);
});

test('source routes and keyboard semantics remain implemented in their original files',()=>{
 for(const route of ["'home'","'solo'","'solo-bomb'","'solo-car'","'rooms'"]) assert.ok(nav.includes(route),route);
 assert.match(game,/input\.readOnly=false/);
 assert.match(game,/function animateBombs\(/);
 assert.match(learn,/function setTypingEnabled\(enabled\)/);
});

test('accessible focus, mobile widths and reduced motion are specified',()=>{
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media \(max-width: 390px\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
 assert.match(css,/min-height: 44px/);
});

// Ensure foreground/background of primary calls to action passes AA for small text.
function rgb(hex){return hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255)}
function luminance(hex){const a=rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722}
function ratio(a,b){const [light,dark]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (light+.05)/(dark+.05)}
test('primary button color contrast is at least 4.5:1',()=>{
 assert.ok(ratio('#aaa8ff','#11172c')>=4.5);
});
