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
  {key:'solo-bomb',label:'BOMB Solo',url:'/#solo-bomb',arena:'solo-bomb'},
  {key:'solo-car',label:'CAR Solo',url:'/#solo-car',arena:'solo-car'},
  {key:'rooms',label:'Phòng thi',url:'/#rooms',arena:'rooms'},
  {key:'attendance',label:'Chuyên cần',url:'/#attendance',arena:'attendance'},
  {key:'rank',label:'Xếp hạng',url:'/#rank',arena:'rank'},
  {key:'admin',label:'Admin',url:'/#admin',arena:'admin',adminOnly:true}
 ];
 const gameKeys=new Set(['game','solo','solo-bomb','solo-car','rooms']);
 const navLink=item=>`<a class="ws-nav-link${gameKeys.has(item.key)?' ws-nav-game-link':''}" href="${item.url}" data-ws-route="${item.key}"${!isLearn&&item.arena?` data-screen="${item.arena}"`:''}${item.adminOnly?' hidden':''}>${item.key==='solo'?'MATCH Solo':item.label}</a>`;
 // One disclosure for every game, shared across Arena and Learn. Keep original links.
 const gamesMarkup=`<div class="ws-nav-games" data-ws-games-group>
   <button class="ws-nav-link ws-nav-games-toggle" type="button" data-ws-games-toggle aria-expanded="false" aria-controls="wsNavGamesList">🎮 Trò chơi <span class="ws-nav-chevron" aria-hidden="true">⌄</span></button>
   <div class="ws-nav-games-list" id="wsNavGamesList" hidden>
     <span class="ws-nav-games-caption">LUYỆN TẬP</span>
     ${menuItems.filter(item=>gameKeys.has(item.key)&&item.key!=='rooms').map(navLink).join('')}
     <span class="ws-nav-games-caption ws-nav-games-divider">CHƠI CHUNG</span>
     ${navLink(menuItems.find(item=>item.key==='rooms'))}
   </div>
 </div>`;
 const navMarkup=menuItems.map(item=>item.key==='game'?gamesMarkup:gameKeys.has(item.key)?'':navLink(item)).join('');
 mount.innerHTML=`<header class="ws-site-header"><div class="ws-site-bar">
  <a class="ws-site-logo" href="/" aria-label="WordSky - Về trang chủ"><span class="ws-logo-mark" aria-hidden="true">✦</span><span>Word<span class="ws-logo-sky">Sky</span><small>ENGLISH</small></span></a>
  <button class="ws-nav-toggle" type="button" aria-expanded="false" aria-label="Mở menu" aria-controls="wsNavLinks">☰</button>
  <nav class="ws-site-links" id="wsNavLinks" aria-label="Điều hướng WordSky">${navMarkup}</nav>
  ${isLearn?'<span class="ws-guest-note">Học miễn phí</span>':'<button class="accountbtn ws-site-account" id="accountButton" type="button">Đăng nhập <span>↗</span></button>'}
 </div></header>`;
 const menu=mount.querySelector('.ws-site-links');
 const toggle=mount.querySelector('.ws-nav-toggle');
 const adminLink=mount.querySelector('[data-ws-route="admin"]');
 const gamesGroup=mount.querySelector('[data-ws-games-group]');
 const gamesToggle=mount.querySelector('[data-ws-games-toggle]');
 const gamesList=mount.querySelector('#wsNavGamesList');
 function setGamesOpen(open){
  gamesList.hidden=!open;
  gamesGroup.classList.toggle('is-open',open);
  gamesToggle.setAttribute('aria-expanded',String(open));
 }
 function closeMenu(){
  setGamesOpen(false);
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-label','Mở menu');
 }
 function activeKey(){
  const hash=window.location.hash.replace(/^#/,'').toLowerCase();
  if(isLearn)return hash==='game'?'game':'flash';
  return ['home','solo','solo-bomb','solo-car','rooms','attendance','rank','admin'].includes(hash)?hash:'home';
 }
 function updateActive(){
  const active=activeKey();
  for(const a of mount.querySelectorAll('[data-ws-route]')){
   const current=a.dataset.wsRoute===active;
   a.classList.toggle('is-active',current);
   if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  gamesToggle.classList.toggle('is-active',gameKeys.has(active));
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
  if(!open)setGamesOpen(false);
 });
 gamesToggle.addEventListener('click',()=>setGamesOpen(gamesList.hidden));
 gamesToggle.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){
   event.preventDefault();setGamesOpen(true);
   gamesList.querySelector('a')?.focus();
  }
 });
 // Optional arrow-key navigation within the disclosure; normal Tab stays intact.
 gamesList.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const links=[...gamesList.querySelectorAll('a')];
  if(!links.length)return;
  event.preventDefault();
  const index=links.indexOf(document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?links.length-1:event.key==='ArrowUp'?(index<0?links.length-1:(index+links.length-1)%links.length):(index+1)%links.length;
  links[next].focus();
 });
 menu.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu()});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   const wasMobileOpen=menu.classList.contains('is-open');
   const wasInGames=!gamesList.hidden&&gamesGroup.contains(document.activeElement);
   closeMenu();
   if(wasMobileOpen)toggle.focus();
   else if(wasInGames)gamesToggle.focus();
  }
 });
 document.addEventListener('click',event=>{
  if(!mount.contains(event.target))closeMenu();
  else if(!gamesGroup.contains(event.target))setGamesOpen(false);
 });
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
