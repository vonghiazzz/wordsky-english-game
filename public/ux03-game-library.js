/* WordSky UX-03: read-only Solo configuration summary. Never submits or alters game state. */
(() => {
 'use strict';
 const setups=[
  {pane:'soloSetupPane',form:'soloSetupForm',mode:'MATCH',unit:'cặp'},
  {pane:'soloBombSetupPane',form:'soloBombSetupForm',mode:'BOMB',unit:'bom'},
  {pane:'soloCarSetupPane',form:'soloCarSetupForm',mode:'CAR',unit:'chặng'}
 ];
 const difficultyName={EASY:'Dễ',NORMAL:'Thường',HARD:'Khó'};
 const safeCount=v=> /^\d{1,3}$/.test(v)?v:'—';
 function sync(item){
  const pane=document.getElementById(item.pane);
  const form=pane?.querySelector('#'+item.form);
  if(!form)return;
  let preview=pane.querySelector('.ws03-setup-preview');
  if(!preview){
   preview=document.createElement('aside');
   preview.className='ws03-setup-preview';
   preview.setAttribute('role','note');
   preview.setAttribute('aria-label','Tóm tắt cấu hình đã chọn');
   preview.innerHTML='<strong>Cấu hình đang chọn</strong><span></span><small>Đây là tóm tắt lựa chọn; điều kiện thực tế được máy chủ xác minh khi bắt đầu.</small>';
   form.insertAdjacentElement('afterend',preview);
  }
  const topic=form.elements.namedItem('topic_id');
  const level=form.elements.namedItem('difficulty');
  const count=form.elements.namedItem('question_count');
  const duration=form.elements.namedItem('duration_seconds');
  const topicLabel=topic?.selectedOptions?.[0]?.textContent?.trim()||'Tất cả chủ đề';
  const value=[item.mode,difficultyName[level?.value]||'—',safeCount(count?.value||'')+' '+item.unit,safeCount(duration?.value||'')+' giây',topicLabel].join(' · ');
  const output=preview.querySelector('span');
  if(output&&output.textContent!==value)output.textContent=value;
 }
 function syncAll(){for(const item of setups)sync(item)}
 function boot(){
  syncAll();
  // Rendered setup forms are replaced by existing app.js; observe only their containers.
  for(const item of setups){
   const pane=document.getElementById(item.pane);
   if(!pane)continue;
   const observer=new MutationObserver(()=>sync(item));
   observer.observe(pane,{childList:true,subtree:true});
  }
  const onFormEdit=event=>{
   const id=event.target?.closest?.('form')?.id;
   const item=setups.find(x=>x.form===id);
   if(item)sync(item);
  };
  document.addEventListener('input',onFormEdit);
  document.addEventListener('change',onFormEdit);
  document.addEventListener('click',event=>{
   if(!event.target.closest('[data-ws03-jump]'))return;
   document.getElementById('ws03GameLibrary')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
