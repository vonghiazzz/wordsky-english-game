/* UX34 MATRIX + MEMORY Solo. Server-authoritative scoring, reveals and receipts. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const MODE=document.body.dataset.matrixMode==='MEMORY'?'MEMORY':'MATRIX';
 const MEMORY=MODE==='MEMORY';
 const RUN_KEY=MEMORY?'wordsky_ux34_memory_run':'wordsky_ux33_matrix_run';
 const PENDING_KEY=MEMORY?'wordsky_ux34_memory_pending':'wordsky_ux33_matrix_pending';
 const DEFAULT_TIME={MATRIX:{4:180,5:240,6:360},MEMORY:{4:90,5:120,6:180}};
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const audio=()=>window.WordSkyAudio;
 const save=(key,value)=>{try{if(value==null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify(value))}catch{}};
 const read=key=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}};
 let current=null,selected=null,pending=null,busy=false,offset=0,wrongTimer=null,clockBusy=false,restoreStarted=false;
 let statusText='',statusError=false;
 async function api(path,options={}){
  const res=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json'},...options});
  let payload;try{payload=await res.json()}catch{payload=null}
  if(!res.ok)throw new Error(payload?.error||'Không thể kết nối máy chủ WordSky');
  return payload;
 }
 function message(txt,error=false){
  statusText=String(txt);statusError=!!error;
  const el=$('matrixStatus');if(!el)return;
  el.textContent=statusText;el.classList.toggle('is-error',statusError);
 }
 function tick(){
  const g=current?.game;if(!g)return;
  const sec=Math.ceil(Math.max(0,Number(g.endsAt)-(Date.now()+offset))/1000);
  $('matrixTimer').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
  if(sec===0&&g.status==='PLAYING'&&!clockBusy&&!busy&&!pending){
   clockBusy=true;refresh().finally(()=>{clockBusy=false});
  }
 }
 function stats(){
  const g=current?.game;if(!g)return;
  $('matrixScore').textContent=Number(g.score||0).toLocaleString('vi-VN');
  $('matrixCorrect').textContent=g.correct+'/'+current.round.question_count;
  const hearts=$('matrixHearts');
  if(MEMORY){hearts.textContent=g.mistakes+' lần sai · ∞ tim';hearts.setAttribute('aria-label','Không giới hạn tim')}
  else{hearts.textContent='❤️'.repeat(Math.max(0,g.health))+'🖤'.repeat(Math.max(0,3-g.health));
   hearts.setAttribute('aria-label',g.health+' tim còn lại')}
  tick();
 }
 function renderBoard(){
  const g=current?.game;if(!g)return;
  const area=$('matrixScroll'),x=area.scrollLeft,y=area.scrollTop,grid=$('matrixGrid');
  const locked=MEMORY&&Number(g.flipUntil||0)>Date.now()+offset;
  grid.style.setProperty('--matrix-size',String(g.gridSize));
  grid.dataset.gridSize=String(g.gridSize);
  grid.innerHTML=g.cards.map(c=>{
   if(c.empty)return '<div class="matrix-card-space" aria-hidden="true"></div>';
   const revealed=!MEMORY||c.revealed===true;
   const label=MEMORY&&c.matched?'✓':revealed?String(c.label||''):'✦';
   const lang=revealed?c.lang:null;
   const classes='matrix-card'+(lang?' matrix-card--'+lang:'')+
    (MEMORY&&!revealed&&!c.matched?' matrix-card--hidden':'')+
    (c.matched?' is-matched':'')+(selected===c.id?' is-selected':'')+
    (c.revealed?' is-flipped':'');
   const aria=c.matched?'Đã ghép':revealed?(lang==='en'?'Tiếng Anh: ':'Tiếng Việt: ')+label:'Thẻ úp, chọn để lật';
   return '<button type="button" class="'+classes+'" data-matrix-id="'+safe(c.id)+'" '+
    'aria-pressed="'+(selected===c.id||!!c.revealed)+'" aria-label="'+safe(aria)+'"'+
    (revealed?' title="'+safe(label)+'"':'')+
    (c.matched||busy||pending||locked||g.status!=='PLAYING'?' disabled':'')+'>'+
    (lang?'<span class="matrix-card-language">'+(lang==='en'?'EN':'VI')+'</span>':'')+
    '<span class="matrix-card-text">'+safe(label)+'</span></button>';
  }).join('');
  area.scrollLeft=x;area.scrollTop=y;
 }
 function terminal(v){
  const g=v.game,win=g.status==='COMPLETED';
  $('matrixResult').hidden=false;
  $('matrixResultTitle').textContent=win?'🎉 Hoàn thành ma trận':g.status==='FAILED'?'💔 Hết 3 tim — thua cuộc':'⌛ Hết giờ';
  $('matrixResultSummary').textContent='Ghép đúng '+g.correct+'/'+v.round.question_count+
   ' cặp · '+g.score+' điểm · '+g.mistakes+' lần sai.';
  const sync=v.reviewSync?.status;
  $('matrixReviewStatus').textContent=sync==='guest'
   ?'Bạn đang chơi khách. Đăng nhập để từ sai được đồng bộ vào My Learning.'
   :sync==='pending'?'Từ sai đang chờ đồng bộ; hãy mở lại lượt chơi.':
   'Từ sai của tài khoản đã được gửi đến My Learning nếu có.';
  const wrong=Array.isArray(v.reviewWords)?v.reviewWords:[];
  $('matrixWrongWords').innerHTML=wrong.length?'<h3>Từ sai cần ôn</h3><div class="matrix-review-list">'+
   wrong.map(w=>'<div><strong>'+safe(w.english)+'</strong><span>'+safe(w.meaning)+'</span></div>').join('')+'</div>':
   '<p>Không có từ sai được ghi nhận.</p>';
  save(RUN_KEY,null);save(PENDING_KEY,null);
  audio()?.setScene(MODE,false);
 }
 function scheduleFlip(){
  if(wrongTimer!==null)clearTimeout(wrongTimer);
  wrongTimer=null;
  const g=current?.game;
  if(!MEMORY||!g||g.status!=='PLAYING'||!g.flipUntil)return;
  const id=current.runId;
  wrongTimer=setTimeout(()=>{wrongTimer=null;if(current?.runId===id&&!pending&&!busy)refresh().catch(()=>{})},
   Math.max(0,Number(g.flipUntil)-(Date.now()+offset))+65);
 }
 function sync(value){
  if(!value||value.game?.mode!==MODE)throw new Error('Dữ liệu game không hợp lệ');
  current=value;offset=Number(value.game.now)-Date.now();
  $('matrixSetup').hidden=true;$('matrixPlay').hidden=false;
  $('matrixResult').hidden=value.game.status==='PLAYING';
  stats();renderBoard();
  audio()?.setScene(MODE,value.game.status==='PLAYING');
  scheduleFlip();
  if(value.game.status!=='PLAYING')terminal(value);
 }
 async function refresh(){
  if(!current||pending||busy)return;
  try{const id=current.runId;const res=await api('solo/runs/'+id);
   if(current?.runId===id){selected=null;sync(res)}}
  catch(err){message(err.message,true)}
 }
 function feedback(before,after){
  const r=after.result;
  if(MEMORY&&r?.complete===false){
   message('Đã lật thẻ. Hãy ghi nhớ và chọn một thẻ khác.');return;
  }
  if(r?.correct===true){message('Ghép đúng! +'+r.awarded+' điểm');audio()?.cue(after.game.status==='COMPLETED'?'win':'correct')}
  else if(r?.correct===false){message(MEMORY?'Chưa đúng, hai thẻ tự úp lại. Không mất tim.':'Sai cặp: trừ điểm và mất 1 tim.',true);
   audio()?.cue(MEMORY?'wrong':after.game.status==='FAILED'?'lose':'damage')}
  else if(before?.status==='PLAYING'&&after.game.status==='TIMEOUT'){audio()?.cue('lose')}
 }
 async function submitPending(checkFirst=false){
  if(!current||!pending||busy)return;
  busy=true;$('matrixRetry').hidden=true;renderBoard();
  const before=current.game,runId=current.runId;
  try{
   let response=null;
   if(checkFirst){
    const readAttempt=await api('solo/runs/'+runId+'/attempts/'+pending.attemptId);
    if(readAttempt.attempt?.applied)response=readAttempt;
   }
   if(!response)response=await api('solo/runs/'+runId+'/answer',{method:'POST',body:JSON.stringify(pending)});
   pending=null;save(PENDING_KEY,null);selected=null;busy=false;
   sync(response);feedback(before,response);renderBoard();
  }catch{
   busy=false;
   message('Kết quả chưa được xác nhận. Dùng nút Thử lại để kiểm tra cùng mã thao tác.',true);
   $('matrixRetry').hidden=false;renderBoard();
  }
 }
 function choose(id){
  const g=current?.game;
  if(!g||g.status!=='PLAYING'||pending||busy)return;
  if(MEMORY&&Number(g.flipUntil||0)>Date.now()+offset)return;
  const c=g.cards.find(x=>x.id===id);
  if(!c||c.empty||c.matched||c.revealed)return;
  audio()?.unlock();
  if(MEMORY){
   pending={attemptId:crypto.randomUUID(),cardId:id};
  }else{
   if(!selected){selected=id;message('Đã chọn '+(c.lang==='en'?'tiếng Anh':'tiếng Việt')+'. Chọn nghĩa tương ứng.');renderBoard();return}
   if(selected===id){selected=null;renderBoard();return}
   const other=g.cards.find(x=>x.id===selected);
   if(other?.lang===c.lang){selected=id;message('Hãy chọn một thẻ tiếng Anh và một thẻ tiếng Việt.');renderBoard();return}
   pending={attemptId:crypto.randomUUID(),firstId:selected,secondId:id};
  }
  save(PENDING_KEY,pending);submitPending();
 }
 async function begin(){
  if(busy)return;
  busy=true;$('matrixStart').disabled=true;audio()?.unlock();
  const h=$('matrixSetup').querySelector('.matrix-hint');
  h.classList.remove('is-error');message('Đang tạo ma trận...');
  try{
   const form=new FormData($('matrixForm'));
   const payload={
    grid_size:Number(form.get('grid_size')),difficulty:form.get('difficulty'),
    topic_id:form.get('topic_id')||null,duration_seconds:Number(form.get('duration_seconds')),
    points_per_correct:Number(form.get('points_per_correct')),penalty:Number(form.get('penalty'))
   };
   const res=await api('solo/'+MODE.toLowerCase()+'/start',{method:'POST',body:JSON.stringify(payload)});
   pending=null;selected=null;save(RUN_KEY,res.runId);save(PENDING_KEY,null);
   busy=false;sync(res);
  }catch(err){h.textContent=err.message;h.classList.add('is-error')}
  finally{busy=false;$('matrixStart').disabled=false}
 }
 async function restore(){
  if(restoreStarted)return;restoreStarted=true;
  const runId=read(RUN_KEY);
  if(typeof runId!=='string'||!/^[a-f0-9-]{36}$/i.test(runId))return;
  try{
   const res=await api('solo/runs/'+runId);
   if(res.game?.mode!==MODE)throw new Error('Không đúng chế độ');
   pending=read(PENDING_KEY);selected=null;sync(res);
   if(pending&&res.game.status==='PLAYING'){
    $('matrixRetry').hidden=false;
    message('Có thao tác chưa xác nhận. Thử lại bằng cùng mã lần chọn.');
   }
  }catch{save(RUN_KEY,null);save(PENDING_KEY,null);pending=null}
 }
 async function populateTopics(){
  try{
   const response=await api('topics');
   const select=$('matrixTopic');
   for(const t of response.topics||[]){
    const opt=document.createElement('option');opt.value=t.id;
    opt.textContent=t.title+' ('+t.word_count+' từ)';
    select.append(opt);
   }
  }catch{ /* All topics remains a valid option. */ }
 }
 function again(){
  current=null;selected=null;pending=null;
  if(wrongTimer!==null)clearTimeout(wrongTimer);wrongTimer=null;
  save(RUN_KEY,null);save(PENDING_KEY,null);
  $('matrixPlay').hidden=true;$('matrixResult').hidden=true;
  $('matrixSetup').hidden=false;$('matrixRetry').hidden=true;
  audio()?.setScene(MODE,false);
  $('matrixSetup').scrollIntoView({behavior:'smooth',block:'start'});
 }
 $('matrixForm').addEventListener('submit',e=>{e.preventDefault();begin()});
 $('matrixSize').addEventListener('change',()=>{
  const time=DEFAULT_TIME[MODE][Number($('matrixSize').value)];
  if(time)$('matrixDuration').value=String(time);
 });
 $('matrixGrid').addEventListener('click',e=>{
  const el=e.target.closest('[data-matrix-id]');
  if(el)choose(el.dataset.matrixId);
 });
 $('matrixRetry').addEventListener('click',()=>submitPending(true));
 $('matrixAgain').addEventListener('click',again);
 window.addEventListener('pagehide',()=>audio()?.setScene(MODE,false));
 setInterval(tick,800);
 populateTopics();restore();
})();