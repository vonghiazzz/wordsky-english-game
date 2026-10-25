import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=read('public/index.html');
const js=read('public/ux06-admin.js');
const css=read('public/ux06-admin.css');
const app=read('public/app.js');

// UX-06 is a progressive enhancement of the existing server-guarded Admin view.
test('UX-06 assets are included once and CSS follows UX-04',()=>{
 assert.equal(home.split('href="/ux06-admin.css"').length-1,1);
 assert.equal(home.split('src="/ux06-admin.js"').length-1,1);
 assert.ok(home.indexOf('ux06-admin.css')>home.indexOf('ux04-results.css'));
 assert.ok(home.indexOf('ux06-admin.js')>home.indexOf('src="/app.js"'));
 assert.match(home,/class="page-title ws06-page-title"/);
});
test('the real Admin screen and login are retained unchanged',()=>{
 for(const id of ['screen-admin','adminContent','authModal','authForm','joinForm'])
  assert.match(home,new RegExp('id="'+id+'"'));
 assert.match(home,/Quản trị WordSky/);
 assert.match(app,/session\?\.role!=='admin'/);
});
test('workspace only mounts after successful Admin rendering',()=>{
 assert.match(js,/querySelector\(':scope > \.panel-tabs'\)/);
 assert.match(js,/if\(!tabs\)return/);
 assert.match(js,/insertBefore\(section,tabs\)/);
 assert.doesNotMatch(js,/querySelector\('#adminLoginBtn'\)/);
});
test('three quick actions use original delegated Admin tab controls',()=>{
 for(const key of ['events','vocab','features']){
  assert.match(js,new RegExp("key:'"+key+"'"));
  assert.match(app,new RegExp('data-admin-tab="'+key+'"'));
 }
 assert.match(js,/target\.click\(\)/);
 assert.match(app,/if\(button\.dataset\.adminTab\)/);
});
test('CEFR review shortcut opens existing vocabulary panel and filter',()=>{
 assert.match(js,/selectTab\('vocab','#cefrSearchFilter'\)/);
 assert.match(app,/cefrSearchFilter/);
 assert.match(js,/requestAnimationFrame/);
});
test('new script performs no fetch, storage mutation or security checks of its own',()=>{
 assert.doesNotMatch(js,/\bfetch\(|\bXMLHttpRequest\b|localStorage|sessionStorage|document\.cookie|\/api\/|innerText\s*=/);
 assert.match(js,/const observer=new MutationObserver/);
 assert.match(js,/observer\.observe\(host,\{childList:true\}\)/);
});
test('scoped responsive styles do not affect gameplay or global controls',()=>{
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 for(const line of css.split('\n')){
  if(!line.includes('{')||line.trim().startsWith('@')||line.trim().startsWith('/*')||line.trim().startsWith('*'))continue;
  assert.ok(line.trim().startsWith('#screen-admin'),line.slice(0,120));
 }
 assert.doesNotMatch(css,/\.bomb-falling\s*\{|\.car-stage\s*\{|\.typing-dock\s*\{/);
});
test('accessible buttons, current state and mobile native input are preserved',()=>{
 assert.match(js,/type="button" class="ws06-quick"/);
 assert.match(js,/aria-pressed="false"/);
 assert.match(js,/setAttribute\('aria-pressed',String\(isCurrent\)\)/);
 assert.match(css,/:focus-visible/);
 assert.match(app,/function reconcileBombCards\(/);
 assert.match(app,/function renderSoloCarGame\(/);
 assert.match(app,/function navigate\(name,\{fromHistory=false\}=\{\}\)/);
});
