/* WordSky shared site navigation: no account or storage integration. */
(() => {
 'use strict';
 const mount=document.getElementById('wsSharedNav');
 if(!mount)return;
 const isLearn=mount.dataset.wsPage==='learn';
 const menuItems=[
  {key:'home',label:'Trang chủ',url:'/#home',arena:'home'},
  {key:'flash',label:'Flashcard',url:'/learn.html#flash'},
  {key:'game',label:'Chữ rơi',url:'/learn.html#game'},
  {key:'solo',label:'Chơi Solo',url:'/#solo',arena:'solo'},
  {key:'rooms',label:'Phòng thi',url:'/#rooms',arena:'rooms'},
  {key:'attendance',label:'Chuyên cần',url:'/#attendance',arena:'attendance'},
  {key:'rank',label:'Xếp hạng',url:'/#rank',arena:'rank'},
  {key:'admin',label:'Admin',url:'/#admin',arena:'admin',adminOnly:true}
 ];
 const navMarkup=menuItems.map(item=>`<a class="ws-nav-link" href="${item.url}" data-ws-route="${item.key}"${!isLearn&&item.arena?` data-screen="${item.arena}"`:''}${item.adminOnly?' hidden':''}>${item.label}</a>`).join('');
 mount.innerHTML=`<header class="ws-site-header"><div class="ws-site-bar">
  <a class="ws-site-logo" href="/" aria-label="WordSky - Về trang chủ"><span class="ws-logo-mark" aria-hidden="true">✦</span><span>Word<span class="ws-logo-sky">Sky</span><small>ENGLISH</small></span></a>
  <button class="ws-nav-toggle" type="button" aria-expanded="false" aria-label="Mở menu" aria-controls="wsNavLinks">☰</button>
  <nav class="ws-site-links" id="wsNavLinks" aria-label="Điều hướng WordSky">${navMarkup}</nav>
  ${isLearn?'<span class="ws-guest-note">Học miễn phí</span>':'<button class="accountbtn ws-site-account" id="accountButton" type="button">Đăng nhập <span>↗</span></button>'}
 </div></header>`;
 const menu=mount.querySelector('.ws-site-links');
 const toggle=mount.querySelector('.ws-nav-toggle');
 const adminLink=mount.querySelector('[data-ws-route="admin"]');
 function closeMenu(){menu.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Mở menu')}
 function activeKey(){
  const hash=window.location.hash.replace(/^#/,'').toLowerCase();
  if(isLearn)return hash==='game'?'game':'flash';
  return ['home','solo','rooms','attendance','rank','admin'].includes(hash)?hash:'home';
 }
 function updateActive(){
  const active=activeKey();
  for(const a of mount.querySelectorAll('[data-ws-route]')){
   const current=a.dataset.wsRoute===active;
   a.classList.toggle('is-active',current);
   if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
 }
 function applyLearnRoute(){
  if(!isLearn)return;
  const raw=window.location.hash.replace(/^#/,'').toLowerCase();
  const tab=raw==='game'?'gameTab':raw==='manage'?'manageTab':'flashTab';
  const button=document.getElementById(tab);
  if(button&&button.getAttribute('aria-selected')!=='true')button.click();
  updateActive();
 }
 toggle.addEventListener('click',()=>{
  const open=!menu.classList.contains('is-open');
  menu.classList.toggle('is-open',open);
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Đóng menu':'Mở menu');
 });
 menu.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()});
 document.addEventListener('click',event=>{if(!mount.contains(event.target))closeMenu()});
 window.addEventListener('hashchange',()=>{applyLearnRoute();updateActive()});
 window.addEventListener('popstate',()=>{applyLearnRoute();updateActive()});
 window.addEventListener('wordsky:route',updateActive);
 window.WordSkyNav={
  updateActive,
  setAdmin(value){
   if(adminLink)adminLink.hidden=!Boolean(value);
   updateActive();
  }
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applyLearnRoute();updateActive()},{once:true});
 else{applyLearnRoute();updateActive()}
})();
