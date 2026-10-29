/* WordSky shared site navigation: no account or storage integration. */
(() => {
 'use strict';
 const mount=document.getElementById('wsSharedNav');
 if(!mount)return;
 const isLearn=mount.dataset.wsPage==='learn';
 const isProgress=mount.dataset.wsPage==='progress';
 const isLearningPage=isLearn||isProgress;
 const menuItems=[
  {key:'home',label:'Trang chủ',url:'/#home',arena:'home'},
  {key:'flash',label:'Học từ',url:'/learn.html#flash'},
  {key:'game',label:'Chữ rơi',url:'/learn.html#game'},
  {key:'learning-progress',label:'My Learning',url:'/progress.html'},
  {key:'game-mistakes',label:'Sổ từ cần ôn',url:'/mistakes.html'},
  {key:'solo',label:'Chơi Solo',url:'/#solo',arena:'solo'},
  {key:'solo-bomb',label:'BOMB Solo',url:'/#solo-bomb',arena:'solo-bomb'},
  {key:'solo-car',label:'CAR Solo',url:'/#solo-car',arena:'solo-car'},
  {key:'rooms',label:'Thi đấu',url:'/#rooms',arena:'rooms'},
  {key:'attendance',label:'Chuyên cần',url:'/#attendance',arena:'attendance'},
  {key:'rank',label:'Xếp hạng',url:'/#rank',arena:'rank'},
  {key:'admin',label:'Admin',url:'/#admin',arena:'admin',adminOnly:true}
 ];
 const gameKeys=new Set(['game','solo','solo-bomb','solo-car','rooms']);
 const navLink=item=>`<a class="ws-nav-link${gameKeys.has(item.key)?' ws-nav-game-link':''}" href="${item.url}" data-ws-route="${item.key}"${!isLearn&&item.arena?` data-screen="${item.arena}"`:''}${item.adminOnly?' hidden':''}>${item.key==='solo'?'MATCH Solo':item.label}</a>`;
 // One disclosure for every game, shared across Arena and Learn. Keep original links.
 // UX-02: five clear destinations, with old deep links preserved below.
 const gamesMarkup=`<div class="ws-nav-games" data-ws-games-group>
   <button class="ws-nav-link ws-nav-games-toggle" type="button" data-ws-games-toggle aria-expanded="false" aria-controls="wsNavGamesList">🎮 Chơi <span class="ws-nav-chevron" aria-hidden="true">⌄</span></button>
   <div class="ws-nav-games-list" id="wsNavGamesList" hidden>
     <span class="ws-nav-games-caption">CHỌN TRÒ CHƠI</span>
     ${menuItems.filter(item=>gameKeys.has(item.key)&&item.key!=='rooms').map(navLink).join('')}
   </div>
 </div>`;
 const progressMarkup=`<div class="ws-nav-games ws-nav-progress" data-ws-progress-group>
   <button class="ws-nav-link ws-nav-games-toggle ws-nav-progress-toggle" type="button" data-ws-progress-toggle aria-expanded="false" aria-controls="wsNavProgressList">📈 Tiến độ <span class="ws-nav-chevron" aria-hidden="true">⌄</span></button>
   <div class="ws-nav-games-list ws-nav-progress-list" id="wsNavProgressList" hidden>
    <span class="ws-nav-games-caption">THÀNH TÍCH</span>
    ${navLink(menuItems.find(item=>item.key==='learning-progress'))}
    ${navLink(menuItems.find(item=>item.key==='game-mistakes'))}
    ${navLink(menuItems.find(item=>item.key==='attendance'))}
    ${navLink(menuItems.find(item=>item.key==='rank'))}
   </div>
 </div>`;
 const navMarkup=[
  navLink(menuItems.find(item=>item.key==='home')),
  navLink(menuItems.find(item=>item.key==='flash')),
  gamesMarkup,
  navLink(menuItems.find(item=>item.key==='rooms')),
  progressMarkup,
  navLink(menuItems.find(item=>item.key==='admin'))
 ].join('');
 mount.innerHTML=`<header class="ws-site-header"><div class="ws-site-bar">
  <a class="ws-site-logo" href="/" aria-label="WordSky - Về trang chủ"><span class="ws-logo-mark" aria-hidden="true">✦</span><span>Word<span class="ws-logo-sky">Sky</span><small>ENGLISH</small></span></a>
  <button class="ws-nav-toggle" type="button" aria-expanded="false" aria-label="Mở menu" aria-controls="wsNavLinks">☰</button>
  <nav class="ws-site-links" id="wsNavLinks" aria-label="Điều hướng WordSky">${navMarkup}</nav>
  ${isLearningPage?'<span class="ws-guest-note">Học miễn phí</span>':'<button class="accountbtn ws-site-account" id="accountButton" type="button">Đăng nhập <span>↗</span></button>'}
 </div></header>
 <nav class="ws-mobile-dock" aria-label="Điều hướng nhanh">
  <a href="/#home" data-ws-dock="home"><span aria-hidden="true">⌂</span><small>Trang chủ</small></a>
  <a href="/learn.html#flash" data-ws-dock="flash"><span aria-hidden="true">📚</span><small>Học</small></a>
  <a href="/#solo" data-ws-dock="solo"><span aria-hidden="true">🎮</span><small>Chơi</small></a>
  <a href="/#rooms" data-ws-dock="rooms"><span aria-hidden="true">🏆</span><small>Thi đấu</small></a>
  <a href="/#attendance" data-ws-dock="attendance"><span aria-hidden="true">▥</span><small>Tiến độ</small></a>
 </nav>`
 const menu=mount.querySelector('.ws-site-links');
 const toggle=mount.querySelector('.ws-nav-toggle');
 const adminLink=mount.querySelector('[data-ws-route="admin"]');
 const gamesGroup=mount.querySelector('[data-ws-games-group]');
 const gamesToggle=mount.querySelector('[data-ws-games-toggle]');
 const gamesList=mount.querySelector('#wsNavGamesList');
 const progressGroup=mount.querySelector('[data-ws-progress-group]');
 const progressToggle=mount.querySelector('[data-ws-progress-toggle]');
 const progressList=mount.querySelector('#wsNavProgressList');
 function setGamesOpen(open){
  gamesList.hidden=!open;
  gamesGroup.classList.toggle('is-open',open);
  gamesToggle.setAttribute('aria-expanded',String(open));
 }
 function setProgressOpen(open){
  progressList.hidden=!open;
  progressGroup.classList.toggle('is-open',open);
  progressToggle.setAttribute('aria-expanded',String(open));
 }
 function closeMenu(){
  setGamesOpen(false);
  setProgressOpen(false);
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-label','Mở menu');
 }
 function activeKey(){
  const hash=window.location.hash.replace(/^#/,'').toLowerCase();
  if(isProgress)return window.location.pathname==='/mistakes.html'?'game-mistakes':'learning-progress';
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
  gamesToggle.classList.toggle('is-active',gameKeys.has(active)&&active!=='rooms');
  progressToggle.classList.toggle('is-active',active==='attendance'||active==='rank'||active==='learning-progress'||active==='game-mistakes');
  // Hide the bottom dock in games/room to keep typing and Ready controls uncovered.
  const dockHidden=isLearn?active==='game':!isProgress&&['solo','solo-bomb','solo-car','rooms'].includes(active);
  mount.classList.toggle('ws-dock-hidden',dockHidden);
  document.body.classList.toggle('ws-mobile-dock-visible',!dockHidden);
  for(const a of mount.querySelectorAll('[data-ws-dock]')){
   const key=a.dataset.wsDock;
   const current=key==='solo'?gameKeys.has(active)&&active!=='rooms':key==='attendance'?['attendance','rank','learning-progress','game-mistakes'].includes(active):key===active;
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
  if(!open){setGamesOpen(false);setProgressOpen(false)}
 });
 gamesToggle.addEventListener('click',()=>{setProgressOpen(false);setGamesOpen(gamesList.hidden)});
 progressToggle.addEventListener('click',()=>{setGamesOpen(false);setProgressOpen(progressList.hidden)});
 progressToggle.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();setGamesOpen(false);setProgressOpen(true);progressList.querySelector('a')?.focus()}
 });
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
 progressList.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const links=[...progressList.querySelectorAll('a')];if(!links.length)return;
  event.preventDefault();const i=links.indexOf(document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?links.length-1:event.key==='ArrowUp'?(i<0?links.length-1:(i+links.length-1)%links.length):(i+1)%links.length;
  links[next].focus();
 });
 menu.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu()});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   const wasMobileOpen=menu.classList.contains('is-open');
   const wasInGames=!gamesList.hidden&&gamesGroup.contains(document.activeElement);
   const wasInProgress=!progressList.hidden&&progressGroup.contains(document.activeElement);
   closeMenu();
   if(wasMobileOpen)toggle.focus();
   else if(wasInGames)gamesToggle.focus();
   else if(wasInProgress)progressToggle.focus();
  }
 });
 document.addEventListener('click',event=>{
  if(!mount.contains(event.target))closeMenu();
  else{
   if(!gamesGroup.contains(event.target))setGamesOpen(false);
   if(!progressGroup.contains(event.target))setProgressOpen(false);
  }
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
