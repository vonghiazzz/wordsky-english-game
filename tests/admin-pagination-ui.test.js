import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const between=(start,end)=>{
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,`Missing segment ${start} -> ${end}`);
 return app.slice(a,b);
};
function scenario({topicCount=18,eventCount=17}={}){
 const els={adminTopicList:{innerHTML:'',querySelectorAll:()=>[]},adminTopicPager:{innerHTML:''},eventsList:{innerHTML:''}};
 const topics=Array.from({length:topicCount},(_,i)=>({id:`topic-${i}`,title:`School ${i}`,words:[{id:`word-${i}`,english:`apple${i}`,meaning:'Quả táo',cefr_level:'A2',cefr_review_status:'APPROVED'}]}));
 if(topics[5])topics[5].title='Trường học';
 const events=Array.from({length:eventCount},(_,i)=>({id:`event-${i}`,title:`Competition ${i}`,status:'DRAFT',join_code:`ROOM${i}`,participants:0,max_players:30,rounds:[{}]}));
 const context={topics,adminEvents:events,$:id=>els[id],escapeHtml:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')};
 const src=`let adminTopicPage=1,adminEventPage=1,adminTopicQuery='';
  const ADMIN_TOPICS_PAGE_SIZE=6,ADMIN_EVENTS_PAGE_SIZE=8;
  const adminOpenTopicIds=new Set();
  ${between('function clampAdminPage(', '\nfunction captureAdminView(')}
  ${between('function renderAdminEventList()', '\nasync function submitEventForm(')}
  ${between('function filterAdminTopics(', '\nfunction openCefrEditor(')}
  globalThis.pagination={
   topics:()=>renderAdminTopicList(),events:()=>renderAdminEventList(),
   setTopicPage:n=>adminTopicPage=n,setEventPage:n=>adminEventPage=n,
   setQuery:q=>adminTopicQuery=q,markOpen:id=>adminOpenTopicIds.add(id),
   state:()=>({topicPage:adminTopicPage,eventPage:adminEventPage})
  };`;
 vm.runInNewContext(src,context);
 return {els,topics,events,logic:context.pagination};
}
test('each vocabulary topic page renders only 6 topics and their words',()=>{
 const {els,logic}=scenario();
 logic.topics();
 assert.equal((els.adminTopicList.innerHTML.match(/data-admin-topic-id=/g)||[]).length,6);
 assert.match(els.adminTopicList.innerHTML,/School 0/);
 assert.doesNotMatch(els.adminTopicList.innerHTML,/School 12/);
 assert.match(els.adminTopicPager.innerHTML,/Trang 1\/3/);
 logic.setTopicPage(3);logic.topics();
 assert.match(els.adminTopicList.innerHTML,/School 12/);
 assert.doesNotMatch(els.adminTopicList.innerHTML,/School 0/);
 assert.match(els.adminTopicPager.innerHTML,/Trang 3\/3/);
 assert.match(els.adminTopicPager.innerHTML,/disabled/);
});
test('topic filtering is case/accent insensitive and resets pagination externally',()=>{
 const {els,logic}=scenario();
 logic.setQuery('truong hoc');logic.setTopicPage(1);logic.topics();
 assert.match(els.adminTopicList.innerHTML,/Trường học/);
 assert.doesNotMatch(els.adminTopicList.innerHTML,/School 0/);
 assert.match(els.adminTopicPager.innerHTML,/Chủ đề 1–1\/1/);
 logic.setQuery('absent');logic.topics();
 assert.match(els.adminTopicList.innerHTML,/Không tìm thấy/);
 assert.match(els.adminTopicPager.innerHTML,/Trang 1\/1/);
});
test('expanded topic is restored by stable ID after page navigation',()=>{
 const {els,logic}=scenario();
 logic.markOpen('topic-11');logic.setTopicPage(2);logic.topics();
 assert.match(els.adminTopicList.innerHTML,/data-admin-topic-id="topic-11" open/);
 logic.setTopicPage(1);logic.topics();logic.setTopicPage(2);logic.topics();
 assert.match(els.adminTopicList.innerHTML,/data-admin-topic-id="topic-11" open/);
});
test('event list uses 8 entries per page, retains action buttons, and clamps after deletion',()=>{
 const {els,events,logic}=scenario();
 logic.events();
 assert.equal((els.eventsList.innerHTML.match(/class="editor-item"/g)||[]).length,8);
 assert.match(els.eventsList.innerHTML,/Competition 0/);
 assert.doesNotMatch(els.eventsList.innerHTML,/Competition 9/);
 assert.match(els.eventsList.innerHTML,/data-event-action="open"/);
 assert.match(els.eventsList.innerHTML,/Trang 1\/3/);
 logic.setEventPage(3);logic.events();
 assert.match(els.eventsList.innerHTML,/Competition 16/);
 events.splice(8);logic.events();
 assert.equal(logic.state().eventPage,1);
 assert.match(els.eventsList.innerHTML,/Trang 1\/1/);
});
test('round X delete button gets its own dedicated grid row while controls remain intact',()=>{
 const rounds=between('function renderRounds()', '\nfunction collectRounds()');
 assert.match(rounds,/class="round-remove-row"/);
 assert.match(rounds,/data-remove-round=\'"\+i\+"\'/);
 assert.match(rounds,/✕ Xóa vòng/);
 assert.match(rounds,/class="round-note"/);
 assert.match(css,/\.round-line > \.round-remove-row\{grid-column:1\/-1/);
});
test('admin page controls are delegated and do not affect CEFR pagination or form submission',()=>{
 assert.match(app,/data-admin-topic-page="prev"/);
 assert.match(app,/data-admin-event-page="next"/);
 assert.match(app,/if\(button\.dataset\.adminTopicPage\)/);
 assert.match(app,/if\(button\.dataset\.adminEventPage\)/);
 assert.match(app,/if\(e\.target\.id==='adminTopicSearch'\)/);
 assert.match(app,/id="cefrResultPager"/);
 assert.match(app,/if\(button\.dataset\.cefrPage\)/);
 assert.match(app,/function submitEventForm\(event\)/);
 assert.match(app,/function manageVocabulary\(type,id\)/);
});
