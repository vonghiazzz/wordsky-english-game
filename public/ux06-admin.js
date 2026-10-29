/* UX-06 | Read-only authenticated Admin workspace. No API requests or mutations. */
(() => {
 'use strict';
 const host=document.getElementById('adminContent');
 if(!host)return;
 const choices=[
  {key:'events',icon:'🏆',title:'Cuộc thi & phòng',desc:'Tạo giải, cấu hình vòng thi và quản lý các phòng hiện có.'},
  {key:'vocab',icon:'📚',title:'Chủ đề & từ vựng',desc:'Quản lý từ vựng, tra cứu và kiểm duyệt mức CEFR.'},
  {key:'features',icon:'⚙️',title:'Tính năng hệ thống',desc:'Kiểm tra và điều chỉnh các tính năng được phép sử dụng.'}
 ];
 function sync(){
  const tabs=host.querySelector(':scope > .panel-tabs');
  const overview=host.querySelector(':scope > .ws06-overview');
  if(!tabs||!overview)return;
  const active=host.querySelector('.panel-tabs [data-admin-tab].on')?.dataset.adminTab;
  for(const button of overview.querySelectorAll('[data-ws06-open]')){
   const isCurrent=button.dataset.ws06Open===active;
   button.classList.toggle('is-current',isCurrent);
   button.setAttribute('aria-pressed',String(isCurrent));
  }
 }
 function mount(){
  // The server-gated Admin renderer creates .panel-tabs only after successful admin requests.
  const tabs=host.querySelector(':scope > .panel-tabs');
  if(!tabs)return;
  if(!host.querySelector(':scope > .ws06-overview')){
   const section=document.createElement('section');
   section.className='ws06-overview';
   section.setAttribute('aria-label','Lối tắt quản trị WordSky');
   section.innerHTML=`<div class="ws06-overview-heading"><div><h2>Trung tâm điều hành</h2><p>Chọn khu vực cần làm việc. Các thao tác quan trọng vẫn được xử lý và kiểm tra quyền bởi máy chủ.</p></div><span class="ws06-private-label">● Khu vực quản trị</span></div>
   <div class="ws06-quick-grid">${choices.map(item=>`<button type="button" class="ws06-quick" data-ws06-open="${item.key}" aria-pressed="false"><span class="ws06-quick-icon" aria-hidden="true">${item.icon}</span><strong>${item.title}</strong><span class="ws06-quick-desc">${item.desc}</span><span class="ws06-quick-link">Mở khu vực →</span></button>`).join('')}</div>
   <div class="ws06-workflow"><div><strong>Kiểm duyệt từ vựng trước khi mở thi đấu</strong><p>Ưu tiên từ CEFR APPROVED để đáp ứng yêu cầu cấp độ, nhất là các vòng CAR.</p></div><div class="ws06-workflow-actions"><button type="button" class="ws06-review" data-ws06-review>Đến kiểm duyệt CEFR →</button><a class="ws06-review" href="/admin-users.html">👥 Quản lý người dùng →</a></div></div>`;
   host.insertBefore(section,tabs);
  }
  sync();
 }
 function selectTab(key,selector){
  const target=host.querySelector(`:scope > .panel-tabs [data-admin-tab="${key}"]`);
  if(!target)return;
  // Reuse the existing app.js delegated event, which handles actual panel visibility.
  target.click();
  requestAnimationFrame(()=>{
   sync();
   const destination=selector?host.querySelector(selector):host.querySelector(':scope > .panel-tabs');
   destination?.scrollIntoView({behavior:'auto',block:'start'});
   if(selector&&destination?.focus){
    destination.focus({preventScroll:true});
   }
  });
 }
 const observer=new MutationObserver(records=>{
  if(records.some(record=>record.target===host&&record.type==='childList'))mount();
 });
 observer.observe(host,{childList:true});
 document.addEventListener('click',event=>{
  const shortcut=event.target.closest?.('#adminContent [data-ws06-open]');
  if(shortcut){selectTab(shortcut.dataset.ws06Open);return}
  if(event.target.closest?.('#adminContent [data-ws06-review]')){
   selectTab('vocab','#cefrSearchFilter');return;
  }
  if(event.target.closest?.('#adminContent .panel-tabs [data-admin-tab]')){
   requestAnimationFrame(sync);
  }
 });
 window.addEventListener('wordsky:route',sync);
 mount();
})();
