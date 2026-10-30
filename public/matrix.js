/* UX33 MATRIX Solo: server-authoritative scoring, idempotent attempts.
 * Never save score, answers, or bilingual mappings to local storage.
 * Only run IDs and in-flight attempt IDs are kept in sessionStorage.
 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const RUN_KEY='wordsky_ux33_matrix_run';
 const PENDING_KEY='wordsky_ux33_matrix_pending';
 let current=null,chosen=null,pending=null,busy=false,offset=0;
 let flash=[],flashCorrect=false,flashUntil=0;
 const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 }[char]));
 const audio=()=>window.WordSkyAudio;
 const store=(key,value)=>{
  try{if(value===null)sessionStorage.removeItem(key);
   else sessionStorage.setItem(key,JSON.stringify(value));}catch{}
 };
 const read=key=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}};
 async function request(path,options={}){
  const response=await fetch('/api/'+path,{
   credentials:'same-origin',cache:'no-store',
   headers:{'Content-Type':'application/json'},...options
  });
  let value=null;
  try{value=await response.json()}catch{}
  if(!response.ok)throw new Error(value?.error||'Không thể kết nối máy chủ WordSky');
  return value;
 }
 function message(value,isError=false){
  const out=$('matrixStatus');
  if(out){out.textContent=value;out.classList.toggle('is-error',!!isError)}
 }
 function renderStats(){
  const game=current?.game;
  if(!game)return;
  $('matrixScore').textContent=Number(game.score||0).toLocaleString('vi-VN');
  $('matrixCorrect').textContent=game.correct+'/'+current.round.question_count;
  $('matrixHearts').textContent='❤️'.repeat(Math.max(0,Number(game.health)||0))+
   '🖤'.repeat(3-Math.max(0,Number(game.health)||0));
  $('matrixHearts').setAttribute('aria-label',game.health+' tim còn lại');
  tick();
 }
 function tick(){
  const game=current?.game;
  if(!game)return;
  const ms=Math.max(0,Number(game.endsAt)-(Date.now()+offset));
  const sec=Math.ceil(ms/1000);
  $('matrixTimer').textContent=String(Math.floor(sec/60)).padStart(2,'0')+
   ':'+String(sec%60).padStart(2,'0');
  if(sec===0&&game.status==='PLAYING'&&!busy){
   busy=true;
   request('solo/runs/'+current.runId).then(value=>{
    current=value;chosen=null;sync(value);
   }).catch(error=>message(error.message,true)).finally(()=>{busy=false});
  }
 }
 function renderBoard(){
  const game=current?.game;
  if(!game)return;
  const scroll=$('matrixScroll'),left=scroll.scrollLeft,top=scroll.scrollTop;
  const grid=$('matrixGrid');
  grid.style.setProperty('--matrix-size',String(game.gridSize));
  const activeFlash=Date.now()<flashUntil?flash:[];
  grid.innerHTML=game.cards.map(card=>{
   const selected=chosen===card.id;
   const classes='matrix-card matrix-card--'+card.lang+
    (card.matched?' is-matched':'')+(selected?' is-selected':'')+
    (activeFlash.includes(card.id)?(flashCorrect?' is-right':' is-wrong'):'');
   return '<button type="button" class="'+classes+'" data-matrix-id="'+safe(card.id)+'"'+
    ' aria-pressed="'+selected+'" aria-label="'+safe((card.lang==='en'?'Tiếng Anh: ':'Tiếng Việt: ')+card.label)+'"'+
    ' title="'+safe(card.label)+'"'+
    (card.matched||busy||pending||game.status!=='PLAYING'?' disabled':'')+'>'+
    '<span class="matrix-card-language">'+(card.lang==='en'?'EN':'VI')+'</span>'+
    '<span class="matrix-card-text">'+safe(card.label)+'</span>'+
    '</button>';
  }).join('');
  scroll.scrollLeft=left;scroll.scrollTop=top;
 }
 function terminal(value){
  const result=$('matrixResult');
  result.hidden=false;
  const game=value.game;
  const won=game.status==='COMPLETED';
  $('matrixResultTitle').textContent=won?'🎉 Hoàn thành ma trận':
   game.status==='FAILED'?'💔 Hết 3 tim — thua cuộc':'⌛ Hết giờ';
  $('matrixResultSummary').textContent='Bạn ghép đúng '+game.correct+' / '+
   value.round.question_count+' cặp, đạt '+game.score+' điểm và chọn sai '+game.mistakes+' lần.';
  const sync=value.reviewSync?.status;
  $('matrixReviewStatus').textContent=sync==='guest'
   ?'Bạn đang chơi với tư cách khách. Đăng nhập để từ sai tự đồng bộ với My Learning.'
   :sync==='pending'
    ?'Máy chủ đã lưu trận; đồng bộ từ sai đang chờ thử lại.'
    :'Nếu bạn đã đăng nhập, từ sai được tự động đưa vào lịch luyện của tài khoản.';
  const wrong=Array.isArray(value.reviewWords)?value.reviewWords:[];
  $('matrixWrongWords').innerHTML=wrong.length?
   '<h3>Từ cần ôn sau lượt này</h3><div class="matrix-review-list">'+wrong.map(w=>
    '<div><strong>'+safe(w.english)+'</strong><span>'+safe(w.meaning)+'</span></div>'
   ).join('')+'</div>':
   '<p>Chưa có từ ghép sai được ghi nhận trong lượt này.</p>';
  store(RUN_KEY,null);store(PENDING_KEY,null);
  audio()?.setScene('MATRIX',false);
 }
 function sync(value){
  if(!value||value.game?.mode!=='MATRIX')throw new Error('Dữ liệu ma trận không hợp lệ');
  current=value;
  offset=Number(value.game.now)-Date.now();
  $('matrixSetup').hidden=true;
  $('matrixPlay').hidden=false;
  renderStats();
  renderBoard();
  audio()?.setScene('MATRIX',value.game.status==='PLAYING');
  if(value.game.status!=='PLAYING'){
   terminal(value);
  }else{
   $('matrixResult').hidden=true;
   message('Chọn một thẻ tiếng Anh và một thẻ tiếng Việt để ghép.');
  }
 }
 function feedback(previous,updated){
  if(updated.result?.correct===true){
   message('Ghép chính xác! +100 điểm');
   audio()?.cue(updated.game.status==='COMPLETED'?'win':'correct');
  }else if(updated.result?.correct===false){
   message('Chưa đúng: −25 điểm và mất 1 tim.',true);
   audio()?.cue(updated.game.status==='FAILED'?'lose':'damage');
  }
  if(previous?.status==='PLAYING'&&updated.game.status==='TIMEOUT')audio()?.cue('lose');
 }
 async function submitPending(checkFirst=false){
  if(!current||!pending||busy)return;
  busy=true;
  $('matrixRetry').hidden=true;
  renderBoard();
  const previous=current.game;
  try{
   let answer=null;
   if(checkFirst){
    const existing=await request('solo/runs/'+current.runId+'/attempts/'+pending.attemptId);
    if(existing.attempt?.applied)answer=existing;
   }
   if(!answer)answer=await request('solo/runs/'+current.runId+'/answer',{
    method:'POST',body:JSON.stringify(pending)
   });
   pending=null;store(PENDING_KEY,null);chosen=null;
   current=answer;feedback(previous,answer);
   flashUntil=Date.now()+420;
   renderStats();
   busy=false;
   syncPreservingStatus(answer);
   setTimeout(()=>{flash=[];flashUntil=0;if(current?.game.status==='PLAYING')renderBoard()},460);
  }catch(error){
   message('Chưa xác nhận được thao tác. Bấm “Thử gửi lại thao tác” để kiểm tra và gửi cùng mã lần chọn.',true);
   $('matrixRetry').hidden=false;
   busy=false;
   renderBoard();
  }
 }
 function syncPreservingStatus(value){
  const status=$('matrixStatus').textContent;
  const isError=$('matrixStatus').classList.contains('is-error');
  sync(value);
  if(value.game.status==='PLAYING')message(status,isError);
 }
 function choose(id){
  const game=current?.game;
  if(!game||game.status!=='PLAYING'||busy||pending)return;
  const card=game.cards.find(c=>c.id===id);
  if(!card||card.matched)return;
  audio()?.unlock();
  if(!chosen){chosen=id;message('Đã chọn '+(card.lang==='en'?'tiếng Anh':'tiếng Việt')+'. Chọn thẻ ngôn ngữ còn lại.');renderBoard();return;}
  if(chosen===id){chosen=null;message('Đã bỏ chọn thẻ.');renderBoard();return;}
  const first=game.cards.find(c=>c.id===chosen);
  if(first?.lang===card.lang){
   chosen=id;message('Chọn một thẻ tiếng Anh và một thẻ tiếng Việt.');renderBoard();return;
  }
  const attemptId=crypto.randomUUID();
  flash=[chosen,id];flashCorrect=false;flashUntil=0;
  pending={attemptId,firstId:chosen,secondId:id};
  store(PENDING_KEY,pending);
  submitPending();
 }
 async function begin(size){
  if(busy)return;
  busy=true;
  $('matrixStart').disabled=true;
  audio()?.unlock();
  message('Đang tạo ma trận trên máy chủ...');
  try{
   const response=await request('solo/matrix/start',{
    method:'POST',body:JSON.stringify({grid_size:Number(size)})
   });
   chosen=null;pending=null;
   store(RUN_KEY,response.runId);store(PENDING_KEY,null);
   flash=[];
   sync(response);
  }catch(error){
   const hint=$('matrixSetup').querySelector('.matrix-hint');
   hint.textContent=error.message;
   hint.classList.add('is-error');
  }finally{
   busy=false;$('matrixStart').disabled=false;
  }
 }
 async function restore(){
  const runId=read(RUN_KEY);
  if(typeof runId!=='string'||!/^[a-f0-9-]{36}$/i.test(runId))return;
  try{
   const value=await request('solo/runs/'+runId);
   if(value.game?.mode!=='MATRIX')throw new Error('Đây không phải lượt MATRIX');
   chosen=null;pending=read(PENDING_KEY);
   sync(value);
   if(pending&&value.game.status==='PLAYING'){
    $('matrixRetry').hidden=false;
    message('Có thao tác đang chờ xác nhận từ máy chủ. Chọn “Thử gửi lại thao tác”.');
   }
  }catch{
   store(RUN_KEY,null);store(PENDING_KEY,null);
   pending=null;
  }
 }
 $('matrixForm').addEventListener('submit',event=>{
  event.preventDefault();begin($('matrixSize').value);
 });
 $('matrixGrid').addEventListener('click',event=>{
  const target=event.target.closest('[data-matrix-id]');
  if(target)choose(target.dataset.matrixId);
 });
 $('matrixRetry').addEventListener('click',()=>submitPending(true));
 $('matrixAgain').addEventListener('click',()=>{
  current=null;chosen=null;pending=null;flash=[];
  store(RUN_KEY,null);store(PENDING_KEY,null);
  $('matrixPlay').hidden=true;$('matrixResult').hidden=true;
  $('matrixSetup').hidden=false;
  audio()?.setScene('MATRIX',false);
  $('matrixSetup').scrollIntoView({behavior:'smooth',block:'start'});
 });
 window.addEventListener('pagehide',()=>audio()?.setScene('MATRIX',false));
 setInterval(tick,800);
 restore();
})();
