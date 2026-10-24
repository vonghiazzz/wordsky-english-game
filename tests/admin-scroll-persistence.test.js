import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const fragment=(start,end)=>{
 const i=code.indexOf(start),j=code.indexOf(end,i+start.length);
 assert.ok(i>=0 && j>i,`Must find ${start} and ${end}`);
 return code.slice(i,j);
};
const helperSource=fragment('function captureAdminView(){','\nasync function loadAdmin(');

function mockAdmin(){
 const elements={
  cefrLevelFilter:{id:'cefrLevelFilter',value:'B1'},
  cefrStatusFilter:{id:'cefrStatusFilter',value:'PROVISIONAL'},
  cefrSearchFilter:{id:'cefrSearchFilter',value:'hello',selectionStart:3,focus(opts){this.wasFocused=opts},setSelectionRange(a,b){this.selection=[a,b]}},
  cefrEditor:{classList:{contains:()=>false}},
  cefrWordId:{value:'word-123'},
  adminContent:{querySelector:s=>s==='.panel-tabs'?{}:null,querySelectorAll:()=>[
   {open:true,dataset:{adminTopicId:'topic-a'}},{open:false,dataset:{adminTopicId:'topic-b'}},{open:true,dataset:{adminTopicId:'topic-c'}}
  ]},
  adminTopicList:{querySelectorAll:()=>[]}
 };
 const calls=[];
 const win={scrollY:930,requestAnimationFrame:callback=>callback(),scrollTo:(...args)=>calls.push(['scrollTo',...args])};
 const doc={activeElement:elements.cefrSearchFilter};
 const context={window:win,document:doc,screen:'admin', $:id=>elements[id]??null,
   filterAdminCefr:keep=>calls.push(['filterAdminCefr',keep]),
   openCefrEditor:(id,scroll)=>calls.push(['openCefrEditor',id,scroll])};
 vm.runInNewContext("let cefrResultPage=2,adminTopicPage=3,adminEventPage=2,adminTopicQuery='school'; const adminOpenTopicIds=new Set();\n"+helperSource+'\n'+
   'globalThis.capture = captureAdminView; globalThis.restore = restoreAdminView;',context);
 return {context,calls,elements};
}

test('captures admin scroll position, CEFR filters, editor, and expanded topics',()=>{
 const {context}=mockAdmin();const snap=context.capture();
 assert.equal(snap.scrollY,930);
 assert.equal(snap.search,'hello');assert.equal(snap.level,'B1');
 assert.equal(snap.status,'PROVISIONAL');assert.equal(snap.page,2);
 assert.equal(snap.editorWord,'word-123');
 assert.deepEqual(Array.from(snap.topicsOpen),['topic-a','topic-c']);
 assert.equal(snap.topicPage,3);assert.equal(snap.eventPage,2);assert.equal(snap.topicQuery,'school');
});

test('restores CEFR state and scroll after Admin rendering without editor auto scroll',()=>{
 const {context,calls,elements}=mockAdmin();const snap=context.capture();
 elements.cefrLevelFilter.value='ALL'; elements.cefrStatusFilter.value='ALL';elements.cefrSearchFilter.value='';
 const topics=[{open:false,dataset:{adminTopicId:'topic-a'}},{open:false,dataset:{adminTopicId:'topic-b'}},{open:false,dataset:{adminTopicId:'topic-c'}}];
 elements.adminTopicList.querySelectorAll=()=>topics;
 context.restore(snap);
 assert.equal(elements.cefrSearchFilter.value,'hello');
 assert.equal(elements.cefrLevelFilter.value,'B1');
 assert.equal(elements.cefrStatusFilter.value,'PROVISIONAL');
 assert.deepEqual(calls.filter(x=>x[0]==='filterAdminCefr'),[['filterAdminCefr',false]]);
 assert.deepEqual(calls.filter(x=>x[0]==='openCefrEditor'),[['openCefrEditor','word-123',false]]);
 assert.deepEqual(calls.filter(x=>x[0]==='scrollTo'),[['scrollTo',0,930]]);
 assert.deepEqual(topics.map(x=>x.open),[true,false,true]);
});

test('initial Admin navigation keeps intentional scroll reset; in-place refresh does not',()=>{
 const nav=fragment('function navigate(name,{fromHistory=false}={}){','\nfunction setupPasswordToggles(');
 const loader=fragment('async function loadAdmin({preserveView=true}={}){','\nfunction optionsTopics(');
 assert.match(nav,/if\(name===screen\)\{[^\n]*return\}/);
 assert.match(nav,/history\.pushState/);
 assert.match(nav,/window\.scrollTo\(\{top:0,behavior:'auto'\}\)/);
 assert.match(nav,/loadAdmin\(\{preserveView:false\}\)/);
 assert.match(loader,/const view=preserveView\?captureAdminView\(\):null/);
 assert.match(loader,/if\(!view\)pane\.innerHTML='<div class="loading">/);
 assert.match(loader,/restoreAdminView\(view\)/);
});

test('CEFR saving uses unified view persistence, no duplicate navigation event handler',()=>{
 const save=fragment('async function saveCefrReview(e){','\n// wordsky-cefr-quick-results-v1');
 assert.match(save,/await loadAdmin\(\)/);
 assert.doesNotMatch(save,/keepCefrFilters/);
 assert.match(code,/function openCefrEditor\(id,scroll=true\)/);
 assert.match(code,/if\(scroll\)\$\('cefrEditor'\)\.scrollIntoView/);
 assert.doesNotMatch(code,/btn\.addEventListener\('click',e=>\{e\.preventDefault\(\);navigate\(btn\.dataset\.screen\)/);
});
