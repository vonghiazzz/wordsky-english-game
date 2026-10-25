/* WordSky UX-05 — read-only Learn UI helpers. Existing inline game script remains SoT. */
(() => {
 'use strict';
 const byId=id=>document.getElementById(id);
 const tabs={flash:'flashTab',game:'gameTab'};
 const modes={letters:'Bắt chữ cái',typing:'Gõ cả từ'};
 const levels={easy:'Dễ',normal:'Vừa',hard:'Khó'};
 const integer=value=>/^\d{1,2}$/.test(value)&&Number(value)>=1&&Number(value)<=50?String(Number(value)):'Chưa hợp lệ';
 function updateSelected(){
  const flash=byId('flashTab')?.getAttribute('aria-selected')==='true';
  const game=byId('gameTab')?.getAttribute('aria-selected')==='true';
  for(const btn of document.querySelectorAll('[data-ws05-tab]')){
   const selected=btn.dataset.ws05Tab==='flash'?flash:btn.dataset.ws05Tab==='game'?game:false;
   btn.classList.toggle('is-selected',selected);
   if(btn.classList.contains('ws05-path')){
    if(selected)btn.setAttribute('aria-current','true');else btn.removeAttribute('aria-current');
   }
  }
 }
 function syncFlash(){
  const count=byId('flashCount')?.textContent?.trim()||'—';
  const known=byId('remembered')?.textContent?.trim()||'0';
  const topic=byId('topic')?.selectedOptions?.[0]?.textContent?.trim()||'Chủ đề đang chọn';
  const output=byId('ws05FlashReadout');
  if(!output)return;
  const message=`${topic} · Thẻ ${count} · Đã nhớ ${known}`;
  if(output.textContent!==message)output.textContent=message;
 }
 function syncGame(){
  const topic=byId('gameTopic')?.selectedOptions?.[0]?.textContent?.trim()||'Tất cả chủ đề';
  const mode=modes[byId('gameMode')?.value]||'—';
  const level=levels[byId('difficulty')?.value]||'—';
  const count=integer(byId('wordLimit')?.value||'');
  const output=byId('ws05GameConfig');
  if(!output)return;
  const message=`${topic} · ${mode} · ${level} · ${count} từ`;
  if(output.textContent!==message)output.textContent=message;
 }
 function boot(){
  document.addEventListener('click',event=>{
   const btn=event.target.closest?.('[data-ws05-tab]');
   const id=btn&&tabs[btn.dataset.ws05Tab];
   if(!id)return;
   const tab=byId(id);
   if(tab){tab.click();updateSelected();tab.scrollIntoView({behavior:'auto',block:'start'});}
  });
  const flashCard=byId('flashCard');
  flashCard?.addEventListener('keydown',event=>{
   if(byId('flashPanel')?.classList.contains('hidden'))return;
   const button=event.key==='ArrowLeft'?byId('prev'):event.key==='ArrowRight'?byId('next'):null;
   if(!button||button.disabled)return;
   event.preventDefault();button.click();
  });
  for(const id of ['topic','gameTopic','gameMode','difficulty','wordLimit']){
   const node=byId(id);if(!node)continue;
   node.addEventListener('input',id==='topic'?syncFlash:syncGame);
   node.addEventListener('change',id==='topic'?syncFlash:syncGame);
  }
  for(const id of ['flashTab','gameTab','manageTab'])byId(id)?.addEventListener('click',updateSelected);
  const flashCount=byId('flashCount'),remembered=byId('remembered');
  const observer=new MutationObserver(syncFlash);
  if(flashCount)observer.observe(flashCount,{childList:true,characterData:true,subtree:true});
  if(remembered)observer.observe(remembered,{childList:true,characterData:true,subtree:true});
  window.addEventListener('wordsky:route',updateSelected);
  syncFlash();syncGame();updateSelected();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
