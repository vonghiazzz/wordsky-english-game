'use strict';
const $=id=>document.getElementById(id);
const sessionStore={getItem(k){try{return sessionStorage.getItem(k)}catch{return null}},setItem(k,v){try{sessionStorage.setItem(k,v)}catch{}},removeItem(k){try{sessionStorage.removeItem(k)}catch{}}};
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n??0).toLocaleString('vi-VN');
const MODE_LABEL={MATCH:'🔗 Nối từ',BOMB:'💣 Giải bom',CAR:'🏎️ Đua xe 5 làn',MATRIX:'🃏 Ma trận mở',MEMORY:'🧠 Ma trận úp'};
const MODE_SHORT={MATCH:'Matching',BOMB:'Bomb Defuser',CAR:'Lane Escape',MATRIX:'Card Matrix',MEMORY:'Memory Flip'};
const rankThresholds=[{xp:0,label:'🥉 Đồng'},{xp:200,label:'🥈 Bạc'},{xp:600,label:'🥇 Vàng'},{xp:1400,label:'💎 Bạch kim'},{xp:3000,label:'👑 Kim cương'}];
let session=null,topics=[],adminEvents=[],editingEvent=null,roomCode='',room=null,game=null,localTimeOffset=0,selectedEnglish=null,selectedLane=2,selectedBombId=null,feedback='',adminTab='events',loginMode='login',timer=null,screen='home';
let carAutoTimer=null,soloCarAutoTimer=null,carLastAuto='',soloCarLastAuto='';
let roomFirstCard=null,roomCardPending=null,roomCardPendingRun=null;
const ROOM_CARD_PENDING_KEY='wordsky_ux34_room_card_pending';
function clearRoomCardPending(){
 roomCardPending=null;roomCardPendingRun=null;sessionStore.removeItem(ROOM_CARD_PENDING_KEY);
}
function restoreRoomCardPending(runId){
 if(roomCardPendingRun===runId)return;
 roomCardPending=null;roomCardPendingRun=runId;
 try{
  const value=JSON.parse(sessionStore.getItem(ROOM_CARD_PENDING_KEY)||'null');
  if(value?.runId===runId&&value?.payload?.attemptId)roomCardPending=value.payload;
  else sessionStore.removeItem(ROOM_CARD_PENDING_KEY);
 }catch{sessionStore.removeItem(ROOM_CARD_PENDING_KEY)}
}
let gameBusy=false,joinBusy=false,gameRevision=0,soloGame=null,soloBusy=false,soloPending=null,selectedSoloEnglish=null,soloFeedback='',soloPairFeedback=null,soloSetupError='',lastSoloConfig=null,soloBombCheckTimer=null,soloBombLastAttempt='',topicsLoading=true,topicsError='';
function toast(message,error=false){const el=$('toast');el.textContent=message;el.className='toast'+(error?' error':'');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),3800)}
const apiError=(message,uncertain=false)=>Object.assign(new Error(message),{uncertain});
async function api(path,{method='GET',body}={}){
 let resp;
 try{resp=await fetch('/api/'+path,{method,credentials:'same-origin',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});}catch{throw apiError('Không kết nối được máy chủ WordSky.',method!=='GET')}let json;
 try{json=await resp.json()}catch{throw apiError('Máy chủ chưa cấu hình API hoặc kết nối bị lỗi.',method!=='GET')}
 if(!resp.ok)throw apiError(json.error||'Có lỗi máy chủ',method!=='GET'&&resp.status>=500);return json;
}
const $screen=n=>$('screen-'+n);
function navigate(name,{fromHistory=false}={}){
 if(!['home','solo','solo-bomb','solo-car','rooms','attendance','rank','admin'].includes(name))return;
 if(!fromHistory&&location.hash!=='#'+name)history.pushState(null,'','#'+name);
 if(name===screen){syncWordSkyArenaAudio();window.dispatchEvent(new Event('wordsky:route'));return}
 screen=name;
  window.WordSkyAudio?.setScene(null,false);
 document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('active',e.id==='screen-'+name));
 document.querySelectorAll('[data-screen]').forEach(e=>e.classList.toggle('active',e.dataset.screen===name));
 window.dispatchEvent(new Event('wordsky:route'));
 // Only intentional screen navigation scrolls to the top, never a same-screen click.
 window.scrollTo({top:0,behavior:'auto'});
 if(name==='attendance')loadAttendance();if(name==='rank')loadRank();if(name==='admin')loadAdmin({preserveView:false});if(name==='rooms'&&roomCode)loadRoom();
 if(['solo','solo-bomb','solo-car'].includes(name))activateSoloScreen(name==='solo-car'?'CAR':name==='solo-bomb'?'BOMB':'MATCH');
}
function setupPasswordToggles(root=document){
 for(const input of root.querySelectorAll('input[type="password"]')){
  if(input.parentElement?.classList.contains('password-field'))continue;
  const box=document.createElement('span');box.className='password-field';
  input.parentNode.insertBefore(box,input);box.append(input);
  const button=document.createElement('button');button.type='button';button.className='password-toggle';
  button.setAttribute('aria-label','Hiện mật khẩu');button.setAttribute('aria-pressed','false');button.textContent='👁';
  button.addEventListener('click',()=>{
   const visible=input.type==='password';input.type=visible?'text':'password';
   button.textContent=visible?'🙈':'👁';button.setAttribute('aria-label',visible?'Ẩn mật khẩu':'Hiện mật khẩu');
   button.setAttribute('aria-pressed',String(visible));input.focus({preventScroll:true});
  });box.append(button);
 }
}
function openAuth(){ $('authModal').classList.remove('hidden');$('authMessage').textContent='';$('authForm').reset();setLoginMode(loginMode)}
function closeAuth(){$('authModal').classList.add('hidden')}
function setLoginMode(m){loginMode=m;$('loginTab').classList.toggle('on',m==='login');$('signupTab').classList.toggle('on',m==='signup');$('authTitle').textContent=m==='login'?'Đăng nhập':'Tạo tài khoản';$('displayNameLabel').classList.toggle('hidden',m!=='signup');$('authForm').elements.password.autocomplete=m==='login'?'current-password':'new-password';}
async function refreshSession(){try{const x=await api('auth/me');session=x.actor}catch{session=null}
 $('accountButton').innerHTML=session?`${escapeHtml(session.role==='admin'?'⚙ Quản trị viên':session.profile?.display_name||session.id)} <span>↗</span>`:'Đăng nhập <span>↗</span>';
 $('accountButton').setAttribute('aria-label',session?.role==='player'?'Mở tài khoản và đổi mật khẩu':session?.role==='admin'?'Quản trị viên - đăng xuất':'Đăng nhập');
 window.WordSkyNav?.setAdmin(session?.role==='admin');
 if(session?.role==='player'&&$('joinForm'))$('joinForm').elements.name.value=session.profile?.display_name||'';
}
async function handleAuth(evt){evt.preventDefault();let f=new FormData(evt.target);const payload=Object.fromEntries(f.entries());
 try{await api('auth/'+(loginMode==='login'?'login':'signup'),{method:'POST',body:payload});await refreshSession();closeAuth();toast(loginMode==='login'?'Đăng nhập thành công!':'Tạo tài khoản thành công!');if(screen==='admin')loadAdmin();if(screen==='attendance')loadAttendance()}catch(e){$('authMessage').textContent=e.message}}
async function logout(){try{await api('auth/logout',{method:'POST',body:{}})}catch{}session=null;await refreshSession();navigate('home');toast('Đã đăng xuất')}
function rankForXp(xp){let r=rankThresholds[0];for(const t of rankThresholds)if(xp>=t.xp)r=t;return r.label}
function boardHtml(people,kind='rank'){
 if(!people?.length)return '<div class="empty">Chưa có thành tích. Hãy tham gia để có tên trên bảng xếp hạng!</div>';
 return `<div class="board-row hdr"><span>#</span><span>Người chơi</span><span class="rank">${kind==='event'?'Đúng':'Chuỗi ngày'}</span><span class="score">${kind==='event'?'Tổng điểm':'XP'}</span></div>`+people.map((p,i)=>`<div class="board-row"><span class="pos">${i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</span><span><strong>${escapeHtml(p.display_name)}</strong>${kind==='rank'?`<small class="muted" style="display:block;margin-top:5px">${rankForXp(p.xp)}</small>`:''}</span><span class="rank">${kind==='event'?fmt(p.correct)+' từ': '🔥 '+fmt(p.streak)+' ngày'}</span><span class="score">${fmt(kind==='event'?p.total_score:p.xp)}</span></div>`).join('');
}
async function loadAttendance(){
 let target=$('attendanceContent');if(!session?.role||session.role!=='player')target.innerHTML='<div class="auth-panel"><h2>Điểm danh để tăng rank</h2><p class="muted">Đăng nhập học viên để nhận XP mỗi ngày. Điểm chuyên cần lưu trên máy chủ, không tính trùng.</p><button id="attendanceLogin" class="btn primary">Đăng nhập / Đăng ký</button></div>';
 else try{const p=await api('attendance/me');const next=rankThresholds.find(x=>x.xp>p.xp);const prev=rankThresholds.filter(x=>x.xp<=p.xp).at(-1)||rankThresholds[0];const pct=next?Math.max(0,(p.xp-prev.xp)/(next.xp-prev.xp)*100):100;
 target.innerHTML=`<div class="dashboard-grid"><div class="achievement"><span>RANK HIỆN TẠI</span><strong>${rankForXp(p.xp)}</strong></div><div class="achievement"><span>TỔNG XP</span><strong>${fmt(p.xp)}</strong></div><div class="achievement"><span>CHUỖI CHUYÊN CẦN</span><strong>🔥 ${fmt(p.streak)} ngày</strong></div></div><div class="room-card"><div class="dashboard-row"><h2>📅 Điểm danh hôm nay</h2><button class="btn primary" id="checkinBtn">Nhận XP hôm nay →</button></div><p class="muted" style="margin:10px 0">+20 XP cơ bản, thưởng +5 XP mỗi ngày duy trì chuỗi (tối đa +35 XP thưởng). Giờ chuẩn Asia/Ho_Chi_Minh.</p><div class="progress"><div style="width:${pct}%"></div></div><p class="small-note">${next?`${fmt(next.xp-p.xp)} XP đến ${next.label}`:'Bạn đã đạt mốc cấp cao nhất!'}</p></div>`;
 }catch(e){target.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
 const rankEl=$('dailyLeaderboard');try{const x=await api('rankings');rankEl.innerHTML=boardHtml(x.players)}catch(e){rankEl.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
async function loadRank(){try{let d=await api('rankings');$('rankLeaderboard').innerHTML=boardHtml(d.players)}catch(e){$('rankLeaderboard').innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}}
async function loadTopics(silent=false,includeWords=false){
 topicsLoading=true;topicsError='';if(['solo','solo-bomb','solo-car'].includes(screen))renderSoloSetup();
 try{const data=await api(includeWords?'admin/topics':'topics');topics=data.topics||[];topicsLoading=false;renderSoloSetup();return topics}
 catch(e){topicsLoading=false;topicsError=e.message;renderSoloSetup();if(!silent)toast(e.message,true);return[]}
}
function fmtDate(s){return s?new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}):'—'}
function secLeft(t){return Math.max(0,Math.ceil((new Date(t).getTime()-(Date.now()+localTimeOffset))/1000))}
function formatCountdown(sec){return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function soloTopicOptions(value=''){
 return `<option value="" ${!value?'selected':''}>Tất cả chủ đề</option>`+topics.map(t=>`<option value="${t.id}" ${t.id===value?'selected':''}>${escapeHtml(t.title)} (${t.word_count??t.words?.length??0} từ)</option>`).join('');
}
const soloModeForScreen=()=>screen==='solo-car'?'CAR':screen==='solo-bomb'?'BOMB':'MATCH';
const soloRunKey=mode=>mode==='CAR'?'wordsky_solo_car_run':mode==='BOMB'?'wordsky_solo_bomb_run':'wordsky_solo_run';
const soloPendingKey=mode=>mode==='CAR'?'wordsky_solo_car_pending':mode==='BOMB'?'wordsky_solo_bomb_pending':'wordsky_solo_pending';
const soloHost=(mode,kind)=>$(mode==='CAR'?'soloCar'+kind:mode==='BOMB'?'soloBomb'+kind:'solo'+kind);
// UX26: sound effects follow authoritative server transitions.
let wsAudioStatusKey='';
function syncWordSkyArenaAudio(){
 const g=screen==='rooms'?game?.game:soloGame?.game;
 const allowed=screen==='rooms'||['solo','solo-bomb','solo-car'].includes(screen);
 window.WordSkyAudio?.setScene(allowed&&g?.status==='PLAYING'?g.mode:null,allowed&&g?.status==='PLAYING');
}
function wsAudioStateCue(before,after){
 if(!before||!after)return;
 const key=[screen,after.status,after.index,after.score,after.health].join(':');
 if(key===wsAudioStatusKey)return;
 wsAudioStatusKey=key;
 if(after.status!=='PLAYING'&&before.status==='PLAYING')window.WordSkyAudio?.cue(after.status==='COMPLETED'?'win':'lose');
 else if(after.health<before.health)window.WordSkyAudio?.cue('damage');
 else if(after.score>before.score)window.WordSkyAudio?.cue('correct');
}
function activateSoloScreen(mode){
 if(soloGame?.game?.mode&&soloGame.game.mode!==mode){soloGame=null;soloPending=null;selectedSoloEnglish=null;soloCarLastAuto='';soloFeedback='';soloPairFeedback=null;soloSetupError=''}
 renderSolo();if(!soloGame)restoreSoloRun(mode);
}
function renderSoloSetup(){
 const mode=soloGame?.game?.mode||soloModeForScreen(),bomb=mode==='BOMB';if(mode==='CAR')return renderSoloCarSetup();const host=soloHost(mode,'SetupPane');if(!host||soloGame)return;
 soloHost(mode,'GamePane')?.classList.add('hidden');
 host.classList.remove('hidden');
 if(topicsLoading&&!topics.length){host.innerHTML='<div class="loading solo-setup" role="status" aria-live="polite" aria-busy="true">⏳ Đang tải kho từ vựng…</div>';return}
 if(!topics.length){host.innerHTML=`<div class="empty solo-setup" role="alert"><strong>${topicsError?'Không tải được kho từ vựng':'Kho từ vựng đang trống'}</strong><p>${escapeHtml(topicsError||`Chưa có chủ đề khả dụng để bắt đầu ${mode} Solo.`)}</p><button type="button" class="btn primary" id="${bomb?'soloBombTopicsRetry':'soloTopicsRetry'}">Thử tải lại</button></div>`;return}
 host.innerHTML=`<div class="auth-panel solo-setup"><div class="panel-header"><span class="panelicon">${bomb?'💣':'🔗'}</span><div><h2>Tạo lượt ${mode}</h2><p>Máy chủ chọn và chấm từ; đáp án không nằm trong trạng thái game gửi về trình duyệt.</p></div></div>
 <form id="${bomb?'soloBombSetupForm':'soloSetupForm'}" class="form-grid"><label class="span2">Chủ đề<select name="topic_id">${soloTopicOptions()}</select></label>
 <label>Độ khó<select name="difficulty"><option value="EASY" selected>${bomb?'Easy · rơi 20s, 2 bom/đợt':'Easy · không có nghĩa nhiễu'}</option><option value="NORMAL">${bomb?'Normal · rơi 16s, 2 bom/đợt':'Normal · thêm 2 nghĩa nhiễu'}</option><option value="HARD">${bomb?'Hard · rơi 10s, 3 bom/đợt':'Hard · thêm 4 nghĩa nhiễu'}</option></select></label>
 <label>${bomb?'Số bom':'Số cặp'}<input name="question_count" type="number" min="3" max="${bomb?30:20}" value="${bomb?8:6}" required></label>
 <label>Thời gian<input name="duration_seconds" type="number" min="20" max="600" value="90" required><small>20–600 giây</small></label>
 <div class="solo-rule-card"><strong>Luật chơi</strong>${bomb?'<span>+100 điểm khi gỡ đúng</span><span>Bom quá hạn mất 1 tim</span><span>Từ chưa hoàn chỉnh không bị phạt</span>':'<span>+100 điểm/cặp đúng</span><span>−25 điểm và −1 tim khi ghép sai</span>'}<span>Hết 3 tim hoặc hết giờ: kết thúc</span></div>
 <button type="submit" class="btn primary span2">Bắt đầu chơi →</button></form>
 ${soloSetupError?`<div class="game-status bad" role="alert">${escapeHtml(soloSetupError)} <button type="button" class="btn small ghost" id="${bomb?'soloBombStartRetry':'soloStartRetry'}">Thử lại</button></div>`:''}
 <p class="small-note solo-disclaimer">Lượt Solo không cộng XP hoặc điểm giải đấu. Đăng nhập trước khi chơi để tự lưu từ sai vào My Learning.</p></div>`;
}
function renderSoloCarSetup(){
 const host=soloHost('CAR','SetupPane');if(!host||soloGame)return;
 soloHost('CAR','GamePane')?.classList.add('hidden');host.classList.remove('hidden');
 if(topicsLoading&&!topics.length){host.innerHTML='<div class="loading solo-setup">Đang tải kho từ vựng…</div>';return}
 if(!topics.length){host.innerHTML=`<div class="empty">${escapeHtml(topicsError||'Không có chủ đề để chơi.')} <button type="button" id="soloCarTopicsRetry" class="btn">Thử tải lại</button></div>`;return}
 host.innerHTML=`<div class="auth-panel solo-setup solo-car-setup"><div class="panel-header"><span class="panelicon">🏎️</span><div><h2>Lane Escape · CAR Solo</h2><p>Chỉ cần gõ đúng từ của bất kỳ làn an toàn nào, xe tự chuyển qua làn đó.</p></div></div>
 <form id="soloCarSetupForm" class="form-grid"><label class="span2">Chủ đề<select name="topic_id">${soloTopicOptions()}</select><small>Mặc định tất cả chủ đề để đảm bảo đủ từ CEFR.</small></label>
 <label>Độ khó<select name="difficulty"><option value="EASY">EASY · 1 cản, chủ yếu A1–A2</option><option value="NORMAL">NORMAL · 2 cản, có làn x2</option><option value="HARD">HARD · 2 cản, nhiều C1–C2</option></select></label>
 <label>Số chặng<input type="number" name="question_count" min="3" max="30" value="3" required></label>
 <label>Tổng thời gian (giây)<input type="number" name="duration_seconds" min="24" max="600" value="90" required></label>
 <div class="solo-rule-card"><strong>Luật chơi</strong><span>5 làn · mỗi chặng có 8 giây</span><span>Gõ từ của làn nào, xe tự sang làn đó</span><span>Làn thường +100 · ⭐ +150 · ×2 +200</span><span>Đang gõ hoặc gõ sai không bị trừ điểm</span><span>Hết giờ mỗi chặng mất 1 tim</span><span>3 tim hết hoặc hết giờ sẽ kết thúc</span></div>
 <button class="btn primary span2" type="submit">🏁 Bắt đầu lái →</button></form>
 ${soloSetupError?`<div role="alert" class="game-status bad">${escapeHtml(soloSetupError)} <button type="button" id="soloCarStartRetry" class="btn small ghost">Thử lại</button></div>`:''}
 <p class="small-note">Máy chủ kiểm tra CEFR APPROVED trước khi tạo lượt. Solo không cộng XP. Đăng nhập trước khi chơi để tự lưu từ cần ôn.</p></div>`;
}
function soloResultMarkup(g,rd,mode){
 // Display only server-returned public state; do not infer answered word identities.
 const safeInteger=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0};
 const target=Math.max(1,safeInteger(rd.question_count));
 const correct=Math.min(target,safeInteger(g.correct));
 const mistakes=safeInteger(g.mistakes);
 const score=safeInteger(g.score);
 const percent=Math.round(100*correct/target);
 const state={COMPLETED:['Hoàn thành','Bạn đã vượt qua thử thách!'],FAILED:['Hết tim','Bạn có thể thử lại với mức độ phù hợp hơn.'],TIMEOUT:['Hết giờ','Hãy thử lại hoặc điều chỉnh thời gian.']}[g.status]||['Đã kết thúc','Bạn có thể bắt đầu lượt luyện tập khác.'];
 const unit=mode==='CAR'?'chặng':mode==='BOMB'?'bom':'cặp';
 const mistakeLabel=mode==='CAR'?'Lượt bị phạt':mode==='BOMB'?'Bom quá hạn':'Lần ghép sai';
 const knownWords=Array.isArray(g.reviewWords)?g.reviewWords:null;
 const wrongList=knownWords?.length?
   '<div class="ws27-run-words"><h4>📖 Từ cần ôn sau lượt này ('+knownWords.length+')</h4><ul>'+
   knownWords.map(w=>'<li><strong>'+escapeHtml(w.english)+'</strong><span>'+escapeHtml(w.meaning)+
    '</span><small>'+escapeHtml(w.topic||'')+'</small>'+
    (w.reason==='unanswered'?'<em>Chặng CAR chưa trả lời</em>':'')+'</li>').join('')+
   '</ul></div>':'';
 const nextText=knownWords===null
  ?'Ôn Flashcard theo chủ đề. Danh sách từ trả lời sai trong lượt chưa được hệ thống cung cấp.'
  :knownWords.length
  ?'Xem lại các từ trên. Khi đăng nhập, WordSky tự đưa chúng vào Cần ôn, không cần bấm từng thẻ.'
  :mistakes>0
  ?'Có lượt bị phạt không gắn được với một từ cụ thể; hệ thống không tạo từ sai giả.'
  :'Không phát hiện từ nào cần ôn thêm trong lượt này.';
 const syncStatus=g.reviewSync?.status;
 const autoNotice=knownWords?.length?
   syncStatus==='synced'?
    '<p class="ws27-run-status">✓ Tự động đồng bộ với My Learning. Xem Nhóm ôn trên mọi thiết bị.</p>':
   syncStatus==='pending'?
    '<p class="ws27-run-status pending">⚠ Chưa hoàn tất đồng bộ. Tải lại kết quả trận hoặc mở My Learning để thử lại.</p>':
   syncStatus==='guest'?
    '<p class="ws27-run-status pending">Đây là lượt khách. Đăng nhập trước khi chơi để tự lưu từ vào tài khoản.</p>':'':'';

 return `<section class="ws04-result" aria-label="Kết quả ${mode} Solo">
 <div class="ws04-heading"><span class="ws04-kicker">KẾT QUẢ · ${mode} SOLO</span><h3>${state[0]}</h3><p>${state[1]}</p></div>
 <dl class="ws04-metrics"><div><dt>Điểm</dt><dd>${fmt(score)}</dd></div><div><dt>Đã hoàn thành</dt><dd>${correct}<small> / ${target} ${unit}</small></dd></div><div><dt>${mistakeLabel}</dt><dd>${mistakes}</dd></div></dl>
 <div class="ws04-progress-title"><span>Tiến độ hoàn thành</span><strong>${percent}%</strong></div>
 <div class="ws04-progress" role="progressbar" aria-label="Mục hoàn thành" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${correct}"><span style="width:${percent}%"></span></div>
 ${wrongList}${autoNotice}<div class="ws04-next"><p><strong>Tiếp tục ghi nhớ từ vựng</strong><span>${nextText} Mở Tiến độ trong thanh điều hướng để tiếp tục ôn.</span></p></div>
 </section>`;
}
function renderSoloCarGame(){
  syncWordSkyArenaAudio();
 const host=soloHost('CAR','GamePane'),setup=soloHost('CAR','SetupPane');if(!host||!setup||!soloGame)return;
 const g={...soloGame.game,reviewWords:soloGame.reviewWords,reviewSync:soloGame.reviewSync},rd=soloGame.round,ended=g.status!=='PLAYING',answer=host.querySelector('#soloCarAnswer')?.value||'';
 setup.classList.add('hidden');host.classList.remove('hidden');
 const lanes=g.level?.lanes||[];
 const symbol=kind=>kind==='BLOCKED'?'🧱':kind==='BONUS'?'⭐':kind==='DOUBLE'?'×2':'·';
 const message=g.status==='COMPLETED'?'🏁 Hoàn thành đường đua!':g.status==='FAILED'?'💔 Bạn đã hết tim.':'⌛ Đã hết thời gian.';
 host.innerHTML=`<div class="game-shell solo-game-shell solo-car-shell"><div class="game-bar"><strong>🏎️ CAR Solo</strong><span class="counter" id="soloCarScore">${fmt(g.score)} ĐIỂM</span><span id="soloCarHealth">❤️ ${g.health}/3</span><span>⏱ <span id="soloCarCountdown">${formatCountdown(secLeft(g.endsAt))}</span></span></div>
 <div class="solo-progress" role="progressbar" aria-label="Tiến độ CAR Solo" aria-valuemin="0" aria-valuemax="${rd.question_count}" aria-valuenow="${g.index||0}"><span style="width:${Math.round(100*(g.index||0)/Math.max(1,rd.question_count))}%"></span></div>
 ${ended?`<div id="soloCarResultTitle" tabindex="-1" class="game-status good"><strong>${message}</strong> · ${g.correct}/${rd.question_count} chặng đúng · ${fmt(g.score)} điểm</div>`:
 `<p class="small-note game-rules">Gõ từ tiếng Anh của bất kỳ làn an toàn nào. Xe tự chuyển và vượt chặng khi đúng — không cần chọn làn hay Enter.</p>
 <div class="car-stage solo-car-stage"><div class="game-bar"><span>CHẶNG ${g.index+1}/${g.total}</span><span>🏎️ LÀN ${(g.carLane??2)+1} · GÕ ĐỂ VƯỢT</span></div>
 <div class="car-lanes" role="list">${lanes.map((lane,i)=>`<div role="listitem" class="lane car-v6-lane car-auto-lane ${Number(g.carLane??2)===i?'current':''} ${lane.kind==='BLOCKED'?'blocked':''}" aria-label="Làn ${i+1}: ${lane.kind==='BLOCKED'?'vật cản':escapeHtml(lane.meaning)}"><span class="item">${symbol(lane.kind)}</span><span class="car-cefr">${lane.kind==='NORMAL'?(lane.cefr||'A1–A2'):lane.kind==='BONUS'?'B1–B2':lane.kind==='DOUBLE'?'C1–C2':'CẢN'}</span><span class="car-lane-word">${lane.kind==='BLOCKED'?'Tránh':escapeHtml(lane.meaning)}</span><span class="you">${Number(g.carLane??2)===i?'🏎':'·'}</span><span class="car-lane-number">${i+1}</span></div>`).join('')}</div>
 <div class="car-vehicle" id="soloCarVehicle" role="img" aria-label="Xe đang ở làn ${(g.carLane??2)+1}" style="left:${10+20*(g.carLane??2)}%">🏎️</div><div class="car-track-caption">🏁 Nhập đúng từ — xe tự vượt chặng</div></div>
 <form id="soloCarAnswerForm" class="car-answer-form" autocomplete="off"><label for="soloCarAnswer">Nhập từ của một làn an toàn</label>
 <div class="car-answer-row"><input id="soloCarAnswer" name="answer" type="text" autocomplete="off" spellcheck="false" autocapitalize="none" autocorrect="off" maxlength="100" enterkeyhint="done" placeholder="Gõ từ tiếng Anh — tự chuyển làn" aria-label="Từ tiếng Anh để vượt chặng"></div>
 <span id="soloCarReadyHint" class="small-note"></span><span id="soloCarStepTimer" class="small-note"></span></form>`}
 ${!ended&&(soloFeedback||soloPending)?`<div class="game-status ${soloFeedback.startsWith('✅')?'good':'bad'}" role="status" aria-live="polite">${escapeHtml(soloFeedback||'Đang xác nhận kết quả…')} ${soloPending?`<button id="soloCarPendingRetry" type="button" class="btn small ghost" ${soloBusy?'disabled':''}>Đồng bộ / thử lại</button>`:''}</div>`:''}
 ${ended?soloResultMarkup(g,rd,'CAR'):''}
 <div class="form-actions solo-actions">${ended?'<button id="soloCarReplay" type="button" class="btn primary">Chơi lại</button><button id="soloCarHome" type="button" class="btn ghost">Về trang chủ</button>':''}<button type="button" id="soloCarNewConfig" class="btn ghost" ${soloPending?'disabled':''}>${ended?'Đổi cấu hình':'Kết thúc giao diện lượt này'}</button></div></div>`;
 if(!ended){const input=$('soloCarAnswer');if(input){input.value=answer;prepareGameInput(input);if(screen==='solo-car'&&!document.getElementById('authModal')?.classList.contains('active'))input.focus({preventScroll:true})}updateSoloCarTimers()}
 else setTimeout(()=>host.querySelector('#soloCarResultTitle')?.focus({preventScroll:true}),0);
}
function updateSoloCarTimers(){
 if(soloGame?.game?.mode!=='CAR'||soloGame.game.status!=='PLAYING')return;
 const g=soloGame.game,now=Date.now()+localTimeOffset;
 const step=$('soloCarStepTimer'),ready=$('soloCarReadyHint');
 if(step)step.textContent='⏱ Chặng còn '+Math.max(0,Math.ceil((g.stepDeadlineAt-now)/1000))+'s';
 if(ready)ready.textContent=now<g.nextAllowedAt?'Chờ '+Math.ceil((g.nextAllowedAt-now)/1000)+'s':'Sẵn sàng vượt chặng';
}
// Keep this helper independent from the selected-lane UI: one answer fits any safe lane.
function queueCarAutoCheck(mode,delay=185){
 const solo=mode==='solo';
 if(solo)clearTimeout(soloCarAutoTimer);else clearTimeout(carAutoTimer);
 const g=solo?soloGame?.game:game?.game;
 if(!g||g.mode!=='CAR'||g.status!=='PLAYING')return;
 const wait=Math.max(delay,Number(g.nextAllowedAt||0)-(Date.now()+localTimeOffset)+25);
 const callback=()=>void checkCarAutoAnswer(mode);
 if(solo)soloCarAutoTimer=setTimeout(callback,wait);else carAutoTimer=setTimeout(callback,wait);
}
async function checkCarAutoAnswer(mode){
 const solo=mode==='solo',current=solo?soloGame:game,g=current?.game;
 if(!current||g?.mode!=='CAR'||g.status!=='PLAYING')return;
 if(solo?(soloBusy||soloPending):gameBusy){queueCarAutoCheck(mode,220);return}
 const typed=$(solo?'soloCarAnswer':'carAnswer')?.value.trim()||'';
 if(!typed)return;
 const stamp=`${current.runId}:${g.index}:${typed.normalize('NFKC').toLocaleLowerCase('en-US')}`;
 if(stamp===(solo?soloCarLastAuto:carLastAuto))return;
 if(Date.now()+localTimeOffset<g.nextAllowedAt){queueCarAutoCheck(mode,220);return}
 if(solo){soloCarLastAuto=stamp;await submitSoloAnswer({auto:true,answer:typed})}
 else{carLastAuto=stamp;await submitGameAnswer({auto:true,answer:typed})}
}
async function submitSoloCarAnswer(){queueCarAutoCheck('solo',0)}
function soloPairsMarkup(g){
 const right=g.rightOptions||[];
 const stateClass=(side,id)=>soloPairFeedback?.[side]===id?(soloPairFeedback.correct?'correct':'wrong'):'';
 return `<div class="pair-grid"><div class="pair-col" role="group" aria-labelledby="soloEnglishHeading"><h3 id="soloEnglishHeading">English</h3>${g.pairs.map(p=>`<button type="button" data-solo-pair-left="${p.id}" aria-pressed="${selectedSoloEnglish===p.id}" class="pairbtn ${p.matched?'matched':''} ${selectedSoloEnglish===p.id?'selected':''} ${stateClass('leftId',p.id)}" ${(p.matched||soloPending)?'disabled aria-disabled="true"':''}>${escapeHtml(p.english)}</button>`).join('')}</div><div class="pair-col" role="group" aria-labelledby="soloMeaningHeading"><h3 id="soloMeaningHeading">Nghĩa tiếng Việt</h3>${right.map(p=>`<button type="button" data-solo-pair-right="${p.id}" class="pairbtn ${p.matched?'matched':''} ${stateClass('rightId',p.id)}" ${(p.matched||soloPending)?'disabled aria-disabled="true"':''}>${escapeHtml(p.meaning)}</button>`).join('')}</div></div>`;
}
function renderSoloGame(){
  syncWordSkyArenaAudio();
 const mode=soloGame?.game?.mode;if(!mode)return;if(mode==='CAR')return renderSoloCarGame();const setup=soloHost(mode,'SetupPane'),host=soloHost(mode,'GamePane');if(!setup||!host)return;
 const existingBombAnswer=host.querySelector('#soloBombAnswer')?.value||'',oldFocus=document.activeElement?.id;
 setup.classList.add('hidden');host.classList.remove('hidden');
 const g={...soloGame.game,reviewWords:soloGame.reviewWords,reviewSync:soloGame.reviewSync},rd=soloGame.round,ended=g.status!=='PLAYING',bomb=mode==='BOMB';
 const resultLabel=g.status==='COMPLETED'?(bomb?'🎉 Đã gỡ toàn bộ bom!':'🎉 Hoàn thành tất cả cặp!'):g.status==='FAILED'?'💔 Bạn đã hết tim.':g.status==='TIMEOUT'?'⌛ Đã hết thời gian.':'';
 host.innerHTML=`<div class="game-shell solo-game-shell ${bomb?'solo-bomb-shell':''}"><div class="game-bar"><strong>${bomb?'💣 BOMB':'🔗 MATCH'} Solo</strong><span class="counter" id="${bomb?'soloBombScore':'soloScore'}">${fmt(g.score)} ĐIỂM</span><span id="${bomb?'soloBombHealth':'soloHealth'}">❤️ ${g.health}/3</span><span>⏱ <span id="${bomb?'soloBombCountdown':'soloCountdown'}">${formatCountdown(secLeft(g.endsAt))}</span></span></div>
 <div class="solo-progress" role="progressbar" aria-label="${bomb?'Tiến độ gỡ bom':'Tiến độ ghép cặp'}" aria-valuemin="0" aria-valuemax="${rd.question_count}" aria-valuenow="${g.correct}"><span style="width:${Math.round(100*g.correct/Math.max(1,rd.question_count))}%"></span></div>
 ${ended?`<div class="game-status good" tabindex="-1" id="${bomb?'soloBombResultTitle':'soloResultTitle'}"><strong>${resultLabel}</strong><br>${g.correct}/${rd.question_count} ${bomb?'bom đã gỡ':'cặp đúng'} · ${fmt(g.score)} điểm · ${g.mistakes} ${bomb?'bom quá hạn':'lần sai'}</div>`:bomb?`<p class="small-note">Gõ nguyên từ tiếng Anh ứng với bất kỳ bom đang rơi. Chưa đủ từ không mất tim hoặc điểm.</p><div class="bomb-arena bomb-fixed-columns solo-bomb-arena" id="soloBombArena" style="--bomb-lanes:${bombLaneCount(rd)}" data-bomb-lanes="${bombLaneCount(rd)}" aria-label="Các quả bom Solo đang rơi">${bombCardsMarkup(g,rd)}</div><div class="bomb-answer-form"><label for="soloBombAnswer">Nhập đáp án tiếng Anh</label><div class="game-answer-row"><input id="soloBombAnswer" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="100" placeholder="Gõ từ tiếng Anh — bom tự được giải"></div><small class="small-note">Tự kiểm tra sau khi bạn ngừng gõ một chút.</small></div>`:`<p class="small-note">Chọn từ tiếng Anh, sau đó chọn nghĩa tiếng Việt. Sai mất 1 tim và trừ ${rd.penalty} điểm.</p>${soloPairsMarkup(g)}`}
 ${bomb&&!ended?`<div id="soloBombFeedback" class="game-status ${soloFeedback.startsWith('✅')?'good':'bad'}" role="status" aria-live="polite" ${soloPending||soloFeedback?'':'hidden'}><span class="solo-bomb-feedback-text">${escapeHtml(soloFeedback||'Đang xác nhận kết quả với máy chủ…')}</span> <button type="button" class="btn small ghost" id="soloBombPendingRetry" ${soloPending?'':'hidden'} ${soloBusy?'disabled':''}>Đồng bộ / thử lại</button></div>`:soloPending&&!ended?`<div id="soloFeedback" class="game-status bad" role="status" aria-live="polite">${escapeHtml(soloFeedback||'Đang xác nhận kết quả với máy chủ…')} <button type="button" class="btn small ghost" id="soloPendingRetry" ${soloBusy?'disabled':''}>Đồng bộ / thử lại</button></div>`:soloFeedback&&!ended?`<div id="soloFeedback" class="game-status ${soloFeedback.startsWith('Đúng')?'good':'bad'}" role="status" aria-live="polite">${escapeHtml(soloFeedback)}</div>`:''}
 ${ended?soloResultMarkup(g,rd,mode):''}
 <div class="form-actions solo-actions">${ended?`<button type="button" class="btn primary" id="${bomb?'soloBombReplay':'soloReplay'}">Chơi lại</button><button type="button" class="btn ghost" id="${bomb?'soloBombHome':'soloHome'}">Về trang chủ</button>`:''}<button type="button" class="btn ghost" id="${bomb?'soloBombNewConfig':'soloNewConfig'}" ${soloPending?'disabled':''}>${ended?'Đổi cấu hình':'Kết thúc giao diện lượt này'}</button></div></div>`;
 if(bomb&&!ended){const input=$('soloBombAnswer');if(input){input.value=existingBombAnswer;prepareGameInput(input)}animateBombs($('soloBombArena'));if(oldFocus==='soloBombAnswer'&&input)input.focus({preventScroll:true})}
 if(ended)setTimeout(()=>host.querySelector('#'+(bomb?'soloBombResultTitle':'soloResultTitle'))?.focus({preventScroll:true}),0);
}
function renderSolo(){if(soloGame)renderSoloGame();else renderSoloSetup()}
async function beginSolo(mode,config){
  window.WordSkyAudio?.unlock();
 if(soloBusy||soloPending)return;soloBusy=true;lastSoloConfig={mode,config};soloSetupError='';const button=soloHost(mode,'SetupPane')?.querySelector('form button[type="submit"]');if(button){button.disabled=true;button.textContent='⏳ Đang tạo lượt…'}
 try{soloGame=await api(`solo/${mode.toLowerCase()}/start`,{method:'POST',body:config});localTimeOffset=Number(soloGame.game?.now||Date.now())-Date.now();sessionStore.setItem(soloRunKey(mode),soloGame.runId);selectedSoloEnglish=null;soloCarLastAuto='';soloFeedback='';soloPairFeedback=null;soloBombLastAttempt='';renderSoloGame();soloHost(mode,'GamePane')?.scrollIntoView({behavior:'auto',block:'start'});focusGameplayInput($('soloBombAnswer')||$('soloCarAnswer'));}
 catch(e){soloSetupError=e.message;toast(e.message,true);renderSoloSetup()}finally{soloBusy=false}
}
async function beginSoloMatch(config){return beginSolo('MATCH',config)}
function rememberSoloPending(pending){soloPending=pending;sessionStore.setItem(soloPendingKey(pending.mode),JSON.stringify(pending))}
function clearSoloPending(mode=soloPending?.mode||soloGame?.game?.mode||soloModeForScreen()){soloPending=null;sessionStore.removeItem(soloPendingKey(mode))}
function restoreStoredSoloPending(runId,mode){
 try{const pending=JSON.parse(sessionStore.getItem(soloPendingKey(mode))||'null');const valid=mode==='CAR'?(pending?.auto===true?pending?.lane===undefined: Number.isInteger(pending?.lane)&&pending.lane>=0&&pending.lane<=4)&&typeof pending?.answer==='string'&&pending.answer.length<=100:mode==='BOMB'?typeof pending?.answer==='string'&&pending.answer.length<=100:pending?.leftId&&pending?.rightId;if(pending?.runId===runId&&pending.mode===mode&&/^[0-9a-f-]{36}$/i.test(pending.attemptId)&&valid){soloPending=pending;return}}catch{}
 clearSoloPending(mode);
}
async function acceptSoloAnswer(out,pending){
 if(out.game?.mode==='CAR'&&out.result?.laneSafe&&out.result?.wordCorrect&&soloGame?.runId===out.runId){
  await animateCarCrossing(out.result.laneFrom??soloGame.game.carLane??2,out.result.laneTo??pending.lane??2,{stageSelector:'.solo-car-stage',vehicleSelector:'#soloCarVehicle'});
 }
 wsAudioStateCue(soloGame?.game,out.game);clearSoloPending();soloGame=out;localTimeOffset=Number(out.game?.now||Date.now())-Date.now();selectedSoloEnglish=null;
 if(out.game.mode==='CAR'){
  const input=$('soloCarAnswer');if(out.result?.wordCorrect&&input?.value.trim()===pending.answer)input.value='';
  if(out.result?.laneSafe&&out.result?.wordCorrect)soloCarLastAuto='';
  soloFeedback=out.result?.auto&&!out.result?.wordCorrect?'':out.result?.wordCorrect===false?'❌ Sai từ, chưa vượt chặng.':out.result?.laneSafe===false?'💥 Va chạm! Mất 1 tim.':'✅ +'+fmt(out.result?.awarded||0)+' điểm';
 }else if(out.game.mode==='BOMB'){const input=$('soloBombAnswer');if(out.result?.correct&&input?.value.trim()===pending.answer)input.value='';if(out.result?.correct)soloBombLastAttempt='';soloFeedback=out.result?.correct?'✅ Gỡ bom! +'+fmt(out.result.awarded)+' điểm':'Chưa khớp bom đang rơi — tiếp tục gõ.'}
 else{soloPairFeedback={leftId:pending.leftId,rightId:pending.rightId,correct:!!out.result?.correct};soloFeedback=out.result?.correct?'Đúng rồi! +'+fmt(out.result.awarded)+' điểm.':'Sai cặp! Mất 1 tim, còn '+out.game.health+'/3 tim.'}
}
async function rejectSoloPending(error){
 clearSoloPending();
 try{const out=await api(`solo/runs/${soloGame.runId}`);soloGame=out;localTimeOffset=Number(out.game?.now||Date.now())-Date.now()}catch{}
 soloFeedback=error.message;if(soloGame?.game?.mode==='BOMB'&&error.message.includes('Nhập quá nhanh')){soloBombLastAttempt='';queueSoloBombCheck(320)}
}
async function resolveSoloPending({sendFirst=false}={}){
 if(!soloPending||soloBusy||!soloGame)return;
 const pending=soloPending;if(pending.runId!==soloGame.runId){clearSoloPending();return}
 const send=()=>api(`solo/runs/${pending.runId}/answer`,{method:'POST',body:pending.mode==='CAR'?(pending.auto?{attemptId:pending.attemptId,answer:pending.answer,auto:true}:{attemptId:pending.attemptId,lane:pending.lane,answer:pending.answer}):pending.mode==='BOMB'?{attemptId:pending.attemptId,answer:pending.answer,auto:true}:{attemptId:pending.attemptId,leftId:pending.leftId,rightId:pending.rightId}});
 const lookup=()=>api(`solo/runs/${pending.runId}/attempts/${pending.attemptId}`);
 const silentCarAuto=pending.mode==='CAR'&&pending.auto===true;
 soloBusy=true;if(!silentCarAuto)soloFeedback='Đang xác nhận kết quả với máy chủ…';if(!silentCarAuto&&!(pending.mode==='BOMB'&&syncSoloBombArena()))renderSoloGame();
 try{
  if(sendFirst){
   try{await acceptSoloAnswer(await send(),pending);return}catch(e){if(!e.uncertain){await rejectSoloPending(e);return}}
  }
  let state;
  try{state=await lookup()}catch{soloFeedback='Chưa thể xác nhận kết quả. Không chọn cặp mới; hãy thử đồng bộ lại.';return}
  if(state.attempt?.applied){await acceptSoloAnswer(state,pending);return}
  try{await acceptSoloAnswer(await send(),pending);return}catch(e){
   if(!e.uncertain){await rejectSoloPending(e);return}
   try{state=await lookup();if(state.attempt?.applied){await acceptSoloAnswer(state,pending);return}}catch{}
   soloFeedback='Kết quả vẫn chưa rõ. Lượt chọn đang được giữ nguyên và chưa thể thao tác tiếp.';
  }
 }finally{soloBusy=false;if(!silentCarAuto||soloFeedback||soloGame?.game?.status!=='PLAYING'||soloGame?.game?.index!==Number(pending.stageIndex??-1)){if(!(soloGame?.game?.mode==='BOMB'&&soloGame.game.status==='PLAYING'&&syncSoloBombArena()))renderSoloGame()}if(soloGame?.game?.mode==='CAR')queueCarAutoCheck('solo',180)}
}
async function submitSoloAnswer(payload){
 if(!soloGame||soloBusy||soloPending||soloGame.game.status!=='PLAYING')return;
 rememberSoloPending({runId:soloGame.runId,attemptId:crypto.randomUUID(),mode:soloGame.game.mode,...payload,stageIndex:soloGame.game.index});
 await resolveSoloPending({sendFirst:true});
}
async function refreshSoloGame(){
 if(!soloGame||soloBusy||soloPending||soloGame.game.status!=='PLAYING')return;
 try{const out=await api(`solo/runs/${soloGame.runId}`);const before=soloGame.game,lostHealth=out.game.health<before.health;wsAudioStateCue(before,out.game);soloGame=out;localTimeOffset=Number(out.game?.now||Date.now())-Date.now();if(lostHealth)soloFeedback=out.game.mode==='CAR'?'⌛ Trễ chặng! Mất 1 tim.':'💥 Bom quá hạn! Mất 1 tim.';if(out.game.mode==='BOMB'&&out.game.status==='PLAYING'&&syncSoloBombArena()){}else if(out.game.status!==before.status||out.game.score!==before.score||out.game.health!==before.health||out.game.index!==before.index)renderSoloGame();}
 catch(e){if(e.message.includes('Phiên chơi Solo')||e.message.includes('Không tìm thấy'))resetSolo(false);else if(['solo','solo-bomb','solo-car'].includes(screen))toast(e.message,true)}
}
function resetSolo(render=true){window.WordSkyAudio?.setScene(null,false);const mode=soloGame?.game?.mode||soloModeForScreen();soloGame=null;selectedSoloEnglish=null;soloCarLastAuto='';soloFeedback='';soloPairFeedback=null;soloBombLastAttempt='';clearSoloPending(mode);sessionStore.removeItem(soloRunKey(mode));soloHost(mode,'GamePane')?.classList.add('hidden');if(render)renderSoloSetup()}
async function restoreSoloRun(mode=soloModeForScreen()){
 const id=sessionStore.getItem(soloRunKey(mode));if(!/^[0-9a-f-]{36}$/i.test(id||''))return;
 restoreStoredSoloPending(id,mode);
 try{const restored=await api('solo/runs/'+id);if(restored.game?.mode!==mode)throw Error('Sai chế độ Solo');soloGame=restored;localTimeOffset=Number(soloGame.game?.now||Date.now())-Date.now();renderSolo();if(soloPending)await resolveSoloPending()}catch{if(soloModeForScreen()===mode)resetSolo(false)}
}
async function joinRoom(event){
 event.preventDefault();if(joinBusy)return;joinBusy=true;
 const form=event.target,button=form.querySelector('button[type="submit"]');
 const label=button?.textContent;if(button){button.disabled=true;button.textContent='⏳ Đang tham gia...'}
 const f=Object.fromEntries(new FormData(form));let code=String(f.code).toUpperCase().trim();
 try{await api(`events/${encodeURIComponent(code)}/join`,{method:'POST',body:{password:f.password,name:f.name}});roomCode=code;sessionStore.setItem('wordsky_room_code',code);game=null;selectedEnglish=null;toast('Đã tham gia phòng '+code);await loadRoom();}
 catch(e){toast(e.message,true)}
 finally{joinBusy=false;if(button){button.disabled=false;button.textContent=label}}
}
function currentRoundFromEvent(e){let now=Date.now()+localTimeOffset;return e.rounds.find(r=>r.starts_at&&now>=new Date(r.starts_at).getTime()&&now<new Date(r.ends_at).getTime())}
async function loadRoom(){if(!roomCode)return;try{const data=await api('rooms/'+encodeURIComponent(roomCode));const previous=room;room=data;localTimeOffset=data.serverNow-Date.now();$('joinRoomPane').classList.add('hidden');$('roomPane').classList.remove('hidden');if(previous&&previous.event.status===data.event.status&&previous.event.started_at===data.event.started_at&&!game&&$('eventBoard')){$('eventBoard').innerHTML=boardHtml(data.board,'event');}else renderRoom();
  // After the server-authoritative five-second transition, automatically enter
  // the next round. Never auto-start the first round for a new participant.
  const next=currentRoundFromEvent(data.event);
  if(next&&game&&game.game.status!=='PLAYING'&&game.round.id!==next.id&&!gameBusy)await startRound();
 }catch(e){if(e.message.includes('chưa tham gia')||e.message.includes('đăng nhập')){roomCode='';sessionStore.removeItem('wordsky_room_code');$('roomPane').classList.add('hidden');$('joinRoomPane').classList.remove('hidden')}else toast(e.message,true)}}
function renderRoom(){if(!room)return;
 const scroll=$('roomMatrixScroll');
 const scrollPosition=scroll?{x:scroll.scrollLeft,y:scroll.scrollTop}:null;
 $('roomPane').classList.remove('mobile-round-playing');const e=room.event,active=currentRoundFromEvent(e),live=e.status==='LIVE',ended=e.status==='FINISHED'||e.status==='CANCELLED'||(live&&!active&&Date.now()+localTimeOffset>=new Date(e.rounds.at(-1).ends_at).getTime());
 const statusLabel={DRAFT:'Đang chuẩn bị',OPEN:'Đang nhận người',LIVE:'Đang thi',FINISHED:'Đã kết thúc',CANCELLED:'Đã hủy'}[e.status];
 let head=`<div class="room-card"><div class="room-title"><div><span class="mini">PHÒNG #${escapeHtml(e.join_code)}</span><h2>${escapeHtml(e.title)}</h2></div><span class="pill ${live?'good':ended?'red':'yellow'}">${statusLabel}</span></div><p class="small-note">${fmt(e.participant_count)} / ${fmt(e.max_players)} người · ${e.rounds.length} vòng · ${room.me?`Bạn: ${escapeHtml(room.me.name)}`:'Admin'}</p><div class="round-list">${e.rounds.map(r=>`<div class="round-tile ${active?.id===r.id?'active':''}"><div class="number">ROUND ${r.position}</div><strong>${MODE_LABEL[r.mode]}</strong><small>${fmt(r.duration_seconds)} giây · ${escapeHtml(r.difficulty)} · x${r.weight} điểm</small>${r.starts_at?`<div class="small-note" style="margin-top:7px">${fmtDate(r.starts_at)}</div>`:''}</div>`).join('')}</div>`;
 if(e.status==='OPEN')head+=`<p class="game-status">⏳ Đang đợi quản trị viên bắt đầu. Có thể chia sẻ mã <strong>${escapeHtml(e.join_code)}</strong> và mật khẩu cho bạn bè.</p>`;
 else if(live&&active){
  const finishedHere=game?.round?.id===active.id&&game?.game.status!=='PLAYING';
  const upcoming=e.rounds.find(x=>x.position===active.position+1);
  head+=finishedHere&&upcoming
   ?`<p class="game-status">✅ Đã xong vòng ${active.position}. Chờ người chơi khác hoặc tự chuyển sang ${MODE_LABEL[upcoming.mode]} khi hết <b id="roundCountdown">${formatCountdown(secLeft(active.ends_at))}</b>.</p>`
   :`<p class="game-status">⚡ Đang mở ${MODE_LABEL[active.mode]}. Còn <b id="roundCountdown">${formatCountdown(secLeft(active.ends_at))}</b>.</p><button class="btn primary" id="startRoundButton" ${game?.runId&&game.round?.id===active.id?'disabled':''}>${game?.runId&&game.round?.id===active.id?'Vòng đang diễn ra bên dưới':'Bắt đầu / Tiếp tục vòng '+active.position} →</button>`;
 }
 else if(live&&!ended)head+=`<p class="game-status">Vòng tiếp theo chưa bắt đầu, bảng xếp hạng sẽ tự cập nhật.</p>`;
 else if(ended)head+=`<p class="game-status good">🏆 Cuộc thi đã đến thời điểm kết thúc. Xem bảng điểm tổng bên dưới.</p>`;
 head+='</div>';
 $('roomPane').innerHTML=head+'<div id="liveGame"></div><div class="dashboard-row room-leaderboard-heading"><h2>🏆 Bảng điểm toàn giải</h2><button class="btn" id="refreshRoom">Làm mới ↻</button></div><div class="board" id="eventBoard">'+boardHtml(room.board,'event')+'</div><button class="btn ghost" id="leaveRoom">Rời giao diện phòng</button>';
 if(game&&active?.id===game.round?.id){
  renderGame();
  const board=$('roomMatrixScroll');
  if(board&&scrollPosition){board.scrollLeft=scrollPosition.x;board.scrollTop=scrollPosition.y}
 }
}
async function startRound(){
  window.WordSkyAudio?.unlock();
 if(!room||!roomCode||gameBusy)return;
 const active=currentRoundFromEvent(room.event);if(!active){toast('Chưa đến giờ vòng thi',true);return}
 gameBusy=true;gameRevision++;const button=$('startRoundButton');if(button){button.disabled=true;button.textContent='⏳ Đang vào vòng thi...'}
 try{
  game=await api(`rooms/${roomCode}/rounds/${active.id}/start`,{method:'POST',body:{}});
  selectedEnglish=null;roomFirstCard=null;carLastAuto='';selectedBombId=null;feedback='';
  if(['MATRIX','MEMORY'].includes(game.game?.mode))restoreRoomCardPending(game.runId);
  else clearRoomCardPending();
  renderRoom();
  document.querySelector('#liveGame')?.scrollIntoView({behavior:'auto',block:'start'});
  focusGameplayInput($('bombAnswer')||$('carAnswer'));
 }catch(e){toast(e.message,true);if(button){button.disabled=false;button.textContent='Thử vào vòng thi →'}}
 finally{gameBusy=false;if(game?.game?.mode==='CAR')queueCarAutoCheck('room',180)}
}
async function refreshGame(){if(!game||!roomCode)return;
 const revision=gameRevision;try{const before=game.game;const answer=await api(`rooms/${roomCode}/runs/${game.runId}`);if(!game||gameBusy||revision!==gameRevision)return;if(before.mode==='BOMB'&&answer.game.health<before.health)feedback='💥 Bom nổ! -1 tim';if(before.mode==='CAR'&&answer.game.health<before.health)feedback='⌛ Trễ chặng! -1 tim';wsAudioStateCue(before,answer.game);game.game=answer.game;
  const fingerprint=g=>JSON.stringify([g.mode,g.status,g.score,g.health,g.correct,g.mistakes,g.index,g.bombs?.map(b=>b.id),g.cards?.map(c=>[c.id,c.matched,c.revealed]),g.flipUntil]);
  if(game.game.mode==='BOMB'&&before.mode==='BOMB'&&before.status==='PLAYING'&&game.game.status==='PLAYING'&&syncBombArena()){
   // A bomb spawn or timeout must not unmount the input or reset animations.
  }else if(fingerprint(before)!==fingerprint(game.game))renderGame();else if(game.game.mode==='BOMB')animateBombs();
  if(game.game.status!=='PLAYING'){setTimeout(()=>loadRoom(),1100)}}catch(e){if(screen==='rooms')toast(e.message,true)}
}
// Move the car only after server-authoritative acceptance, never while merely selecting a lane.
async function animateCarCrossing(fromLane,toLane,{stageSelector='.car-stage',vehicleSelector='#carVehicle'}={}){
 const stage=document.querySelector(stageSelector);
 const vehicle=document.querySelector(vehicleSelector);
 if(!stage||!vehicle)return;
 const clamp=n=>Math.max(0,Math.min(4,Number(n)||0));
 vehicle.style.left=(10+20*clamp(fromLane))+'%';
 stage.classList.add('car-is-crossing');
 vehicle.setAttribute('aria-label','Xe đang đổi từ làn '+(clamp(fromLane)+1)+' sang làn '+(clamp(toLane)+1));
 // A double animation frame ensures browsers animate even after a freshly rebuilt DOM.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 vehicle.style.left=(10+20*clamp(toLane))+'%';
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,480));
}
async function submitGameAnswer(payload){
 if(!game||gameBusy)return;gameBusy=true;gameRevision++;
 const runId=game.runId;
 const before=game.game;
 try{
  const answer=await api(`rooms/${roomCode}/runs/${runId}/answer`,{method:'POST',body:payload});
  if(game?.runId!==runId)return;
  if(before.mode==='CAR'&&answer.result?.wordCorrect===true&&answer.result?.laneSafe===true){
   await animateCarCrossing(answer.result.laneFrom??before.carLane??2,answer.result.laneTo??payload.lane??2);
   if(game?.runId!==runId)return;
   carLastAuto='';
  }
  wsAudioStateCue(before,answer.game);game.game=answer.game;
  if(game.game.mode==='CAR'){
   if(answer.result?.auto&&!answer.result?.wordCorrect){feedback='';return}
   if(answer.result?.wordCorrect===false){feedback='❌ Sai từ!'}
   else if(answer.result?.laneSafe===false){feedback='💔 Đâm vật cản! -1 tim'}
   else feedback='✅ +'+fmt(answer.result.awarded)+' điểm';
  }else{
   feedback=answer.result?.correct?'Đúng rồi! +'+fmt(answer.result.awarded)+' điểm.':game.game.mode==='MATCH'?'Sai cặp! Mất 1 tim, còn '+game.game.health+'/3 tim.':'Chưa chính xác — cố gắng nhé!';
  }
  if(game.game.mode==='BOMB'&&answer.result?.correct){const input=$('bombAnswer');if(input)input.value='';}
  if(game.game.mode==='CAR'&&answer.result?.wordCorrect){const input=$('carAnswer');if(input)input.value='';}
  renderGame();if(answer.game.status!=='PLAYING')setTimeout(()=>loadRoom(),700);
 }catch(e){feedback=before.mode==='CAR'?(e.status===429?'⏳ Chờ chút':'⚠️ '+String(e.message).slice(0,54)):e.message;renderGame()}
 finally{gameBusy=false}
}
async function submitRoomCard(){
 if(!game||!roomCardPending||gameBusy||!roomCode)return;
 const runId=game.runId,original=game.game;
 gameBusy=true;gameRevision++;
 const payload=roomCardPending;
 const area=$('roomMatrixScroll'),x=area?.scrollLeft,y=area?.scrollTop;
 try{
  // Check first for a prior receipt. A lost HTTP response must never count twice.
  const receipt=await api('rooms/'+roomCode+'/runs/'+runId);
  if(game?.runId!==runId)return;
  if(receipt.game?.status!=='PLAYING'){
   clearRoomCardPending();roomFirstCard=null;game.game=receipt.game;
   feedback='Vòng đã kết thúc; điểm và trạng thái vừa được đồng bộ.';
   gameBusy=false;renderGame();return;
  }
  const result=await api('rooms/'+roomCode+'/runs/'+runId+'/answer',{method:'POST',body:payload});
  if(game?.runId!==runId)return;
  clearRoomCardPending();
  game.game=result.game;
  const grade=result.result;
  if(grade?.correct===true){feedback='✅ +'+fmt(grade.awarded)+' điểm';wsAudioStateCue(original,result.game)}
  else if(grade?.correct===false){feedback=original.mode==='MEMORY'?'🧠 Chưa đúng! Hai thẻ tự úp lại.':'💔 Ghép sai, mất 1 tim.';
   if(original.mode==='MEMORY')window.WordSkyAudio?.cue('wrong');
   else wsAudioStateCue(original,result.game);
  }else{feedback='🧠 Đã lật thẻ. Ghi nhớ và tìm thẻ cùng nghĩa.';}
  roomFirstCard=null;
  gameBusy=false;renderGame();
  const board=$('roomMatrixScroll');
  if(board){board.scrollLeft=x;board.scrollTop=y}
  if(result.game.status!=='PLAYING')setTimeout(()=>loadRoom(),700);
 }catch(e){
  feedback='⚠️ '+e.message+' — có thể thử lại với cùng mã thao tác.';
  gameBusy=false;renderGame();
  // Keep payload for explicit retry. Server receipt prevents double grading.
 }finally{gameBusy=false}
}
function chooseRoomCard(cardId){
 const g=game?.game;
 if(!g||!['MATRIX','MEMORY'].includes(g.mode)||g.status!=='PLAYING'||gameBusy||roomCardPending)return;
 if(g.mode==='MEMORY'&&Number(g.flipUntil||0)>Date.now()+localTimeOffset)return;
 const c=g.cards?.find(v=>v.id===cardId);
 if(!c||c.empty||c.matched||c.revealed)return;
 window.WordSkyAudio?.unlock();
 if(g.mode==='MEMORY'){
  roomCardPending={attemptId:crypto.randomUUID(),cardId};
 }else{
  if(!roomFirstCard){roomFirstCard=cardId;feedback='Chọn thẻ còn lại bằng ngôn ngữ khác.';renderGame();return}
  if(roomFirstCard===cardId){roomFirstCard=null;renderGame();return}
  const first=g.cards.find(v=>v.id===roomFirstCard);
  if(first?.lang===c.lang){roomFirstCard=cardId;feedback='Hãy chọn một thẻ tiếng Anh và một thẻ tiếng Việt.';renderGame();return}
  roomCardPending={attemptId:crypto.randomUUID(),firstId:roomFirstCard,secondId:cardId};
 }
 roomCardPendingRun=game.runId;
 sessionStore.setItem(ROOM_CARD_PENDING_KEY,JSON.stringify({runId:game.runId,payload:roomCardPending}));
 submitRoomCard();
}
function prepareGameInput(input){
 if(!input)return;
 // Use the device keyboard on mobile and the hardware keyboard on desktop.
 // readonly/inputmode=none previously swallowed real taps on many touch devices.
 input.readOnly=false;
 input.inputMode='text';
 input.autocomplete='off';
 input.autocapitalize='none';
 input.spellcheck=false;
}
function focusGameplayInput(input){
 if(!input||input.disabled||input.readOnly||!input.isConnected)return;
 // Mobile browsers can require direct user activation to open the OS keyboard.
 input.focus({preventScroll:true});
 if(document.activeElement!==input)return;
 requestAnimationFrame(()=>{
  if(input.isConnected&&document.activeElement===input)input.scrollIntoView({behavior:'auto',block:'nearest'});
 });
}
// BOMB: automatically resolve a full English word against all active bombs.
// Keep the native mobile input mounted while the 1.2s server poll redraws bombs.
let bombCheckTimer=null, bombLastAttempt='',gameExpanded=false;
function arenaFeedbackMarkup(){
 return `<div id="gameFeedback" role="status" aria-live="polite" ${feedback?'':'hidden'} class="game-inline-feedback ${feedback.startsWith('✅')?'good':'bad'}">${escapeHtml(feedback)}</div>`;
}
function bombLaneCount(rd){
 const value=Number(rd?.bomb_batch_size||2);
 return Number.isInteger(value)?Math.max(1,Math.min(3,value)):2;
}
function bombLaneIndex(b,rd){
 const slot=Number(b?.slot);
 return Number.isInteger(slot)&&slot>=0&&slot<bombLaneCount(rd)?slot:0;
}
function bombCardMarkup(b,rd){
 return `<div class="bomb-falling" data-bomb-id="${escapeHtml(b.id)}" data-bomb-slot="${bombLaneIndex(b,rd)}" data-bomb-spawn="${Number(b.spawnAt)}" data-bomb-deadline="${Number(b.deadline)}"><span class="bomb-emoji">💣</span><strong>${escapeHtml(b.meaning)}</strong><small>${Math.max(0,Math.ceil((b.deadline-Date.now()-localTimeOffset)/1000))}s</small></div>`;
}
function bombCardsMarkup(g,rd){
 const bombs=g.bombs||[],count=bombLaneCount(rd);
 return `<div class="bomb-topline">💣 ${bombs.length} bom đang rơi · Còn ${g.left} bom chưa gỡ</div>`+
  Array.from({length:count},(_,lane)=>`<div class="bomb-fixed-lane" data-lane="${lane}" role="group" aria-label="Cột bom ${lane+1}">${bombs.filter(b=>bombLaneIndex(b,rd)===lane).map(b=>bombCardMarkup(b,rd)).join('')}</div>`).join('');
}
function bombArenaMarkup(g,rd){return bombCardsMarkup(g,rd)+arenaFeedbackMarkup()}
// Keep each live DOM node and its compositor animation across server polls.
function reconcileBombCards(arena,g,rd){
 const bombs=g.bombs||[],visible=new Set(bombs.map(b=>String(b.id)));
 const headline=arena.querySelector('.bomb-topline');
 if(headline)headline.textContent=`💣 ${bombs.length} bom đang rơi · Còn ${g.left} bom chưa gỡ`;
 for(const node of arena.querySelectorAll('.bomb-falling')){
  if(!visible.has(node.dataset.bombId)){node._fallMotion?.cancel();node.remove()}
 }
 const present=new Set([...arena.querySelectorAll('.bomb-falling')].map(node=>node.dataset.bombId));
 for(const bomb of bombs){
  if(!present.has(String(bomb.id))){
   const lane=arena.querySelector(`.bomb-fixed-lane[data-lane="${bombLaneIndex(bomb,rd)}"]`);
   if(lane)lane.insertAdjacentHTML('beforeend',bombCardMarkup(bomb,rd));
  }
 }
 animateBombs(arena);
}
function syncBombArena(){
 const g=game?.game,rd=game?.round,arena=$('bombArena');
 if(!g||g.mode!=='BOMB'||g.status!=='PLAYING'||!rd||!arena||!$('bombAnswer'))return false;
 reconcileBombCards(arena,g,rd);
 const score=$('gameScore'),health=$('gameHealth'),message=$('gameFeedback');
 if(score)score.textContent=fmt(g.score)+' ĐIỂM';
 if(health)health.textContent='❤️ '+g.health+'/3';
 if(message){message.textContent=feedback;message.hidden=!feedback;message.className='game-inline-feedback '+(feedback.startsWith('✅')?'good':'bad');}
 return true;
}
function syncSoloBombArena(){
 const g=soloGame?.game,rd=soloGame?.round,arena=$('soloBombArena');
 if(!g||g.mode!=='BOMB'||g.status!=='PLAYING'||!rd||!arena||!$('soloBombAnswer'))return false;
 reconcileBombCards(arena,g,rd);
 const score=$('soloBombScore'),health=$('soloBombHealth'),progress=document.querySelector('.solo-bomb-shell .solo-progress span'),message=$('soloBombFeedback');
 if(score)score.textContent=fmt(g.score)+' ĐIỂM';if(health)health.textContent='❤️ '+g.health+'/3';if(progress)progress.style.width=Math.round(100*g.correct/Math.max(1,rd.question_count))+'%';
 if(message){
  const label=message.querySelector('.solo-bomb-feedback-text');
  if(label)label.textContent=soloFeedback||'Đang xác nhận kết quả với máy chủ…';
  message.hidden=!(soloPending||soloFeedback);
  message.className='game-status '+(soloFeedback.startsWith('✅')?'good':'bad');
  const retry=message.querySelector('#soloBombPendingRetry');
  if(retry){retry.hidden=!soloPending;retry.disabled=soloBusy}
 }
 return true;
}
function queueSoloBombCheck(delay=185){clearTimeout(soloBombCheckTimer);soloBombCheckTimer=setTimeout(checkSoloBombAnswer,delay)}
async function checkSoloBombAnswer(){
 const field=$('soloBombAnswer'),typed=field?.value.trim(),current=soloGame;
 if(!typed||!current||current.game?.mode!=='BOMB'||current.game.status!=='PLAYING')return;
 if(soloBusy||soloPending){queueSoloBombCheck(280);return}
 const visible=(current.game.bombs||[]).map(b=>b.id).join(','),stamp=current.runId+':'+visible+':'+typed.toLocaleLowerCase('en-US');
 if(stamp===soloBombLastAttempt)return;soloBombLastAttempt=stamp;
 await submitSoloAnswer({answer:typed,auto:true});
 const next=$('soloBombAnswer')?.value.trim();if(soloGame?.runId===current.runId&&next&&next!==typed)queueSoloBombCheck();
}
function queueBombCheck(delay=185){clearTimeout(bombCheckTimer);bombCheckTimer=setTimeout(checkBombAnswer,delay)}
async function checkBombAnswer(){
 const field=$('bombAnswer');
 const typed=field?.value.trim(), currentGame=game;
 if(!typed||!currentGame||currentGame.game?.mode!=='BOMB'||currentGame.game.status!=='PLAYING')return;
 if(gameBusy){queueBombCheck(250);return;}
 const visible=(currentGame.game.bombs||[]).map(b=>b.id).join(',');
 const stamp=currentGame.runId+':'+visible+':'+typed.toLocaleLowerCase('en-US');
 if(stamp===bombLastAttempt)return;
 bombLastAttempt=stamp;
 gameBusy=true;gameRevision++;
 const runId=currentGame.runId;
 try{
  const answer=await api(`rooms/${roomCode}/runs/${runId}/answer`,{method:'POST',body:{answer:typed,auto:true}});
  if(game?.runId!==runId)return;
  game.game=answer.game;
  if(answer.result?.correct){
   feedback='✅ Gỡ bom! +'+fmt(answer.result.awarded)+' điểm';
   if(field?.value.trim()===typed)field.value='';
   bombLastAttempt='';
  }
  if(!syncBombArena())renderGame();
  if(game.game.status!=='PLAYING')setTimeout(()=>loadRoom(),700);
 }catch(e){
  if(game?.runId===runId){
   if(e.message.includes('Nhập quá nhanh')){bombLastAttempt='';queueBombCheck(300);}
   else {feedback=e.message;if(!syncBombArena())renderGame();}
  }
 }finally{
  gameBusy=false;
  const current=$('bombAnswer')?.value.trim();
  if(game?.runId===runId&&current&&current!==typed)queueBombCheck(260);
 }
}
function renderGame(){
  syncWordSkyArenaAudio();
 const host=$('liveGame');if(!host||!game)return;host.classList.toggle('game-expanded',gameExpanded&&['BOMB','CAR'].includes(game.game.mode));
 const existingBombAnswer=host.querySelector('#bombAnswer')?.value||'';
 const existingCarAnswer=host.querySelector('#carAnswer')?.value||'';
 const oldFocus=document.activeElement?.id;
 const g=game.game,rd=game.round;
 const priorScroll=$('roomMatrixScroll'),cardScroll=priorScroll?{x:priorScroll.scrollLeft,y:priorScroll.scrollTop}:null;
 host.closest('#roomPane')?.classList.toggle('mobile-round-playing',g.status==='PLAYING');
 const names={MATCH:'Nối từ cùng nghĩa',BOMB:'Gỡ bom từ vựng',CAR:'Dịch từ và lách xe 5 làn',MATRIX:'Ghép thẻ Anh–Việt',MEMORY:'Lật thẻ và ghi nhớ'};
 let h=`<div class="game-shell"><div class="game-bar"><strong>${MODE_LABEL[g.mode]} — ${names[g.mode]}</strong><span class="counter" id="gameScore">${fmt(g.score)} ĐIỂM</span><span id="gameHealth">${g.mode==='MEMORY'?'🧠 ∞ tim':'❤️ '+g.health+'/3'}</span><span>⏱ <span id="gameCountdown">${formatCountdown(secLeft(g.endsAt))}</span></span>${['BOMB','CAR'].includes(g.mode)?`<button type="button" id="gameSizeToggle" class="game-size-toggle" aria-label="${gameExpanded?'Thu nhỏ game':'Phóng to game'}">${gameExpanded?'⤢':'⛶'}</button>`:''}</div>`;
 if(g.status!=='PLAYING')h+=`<div class="game-status good">${g.status==='COMPLETED'?'🎉 Hoàn thành vòng thi!':g.status==='FAILED'?'💔 Đã mất 3 tim!':'⌛ Hết thời gian'} · ${fmt(g.score)} điểm · ${g.correct} lượt đúng</div>`;
 else if(g.mode==='MATCH'){
  const right=g.rightOptions||[];
  h+=`<p class="small-note">Chọn một từ tiếng Anh bên trái, sau đó chọn nghĩa tiếng Việt bên phải. Chọn sai mất 1 tim và trừ ${rd.penalty} điểm. Hết 3 tim sẽ kết thúc vòng.</p><div class="pair-grid"><div class="pair-col">${g.pairs.map(p=>`<button data-pair-left="${p.id}" class="pairbtn ${p.matched?'matched':''} ${selectedEnglish===p.id?'selected':''}" ${p.matched?'disabled':''}>${escapeHtml(p.english)}</button>`).join('')}</div><div class="pair-col">${right.map(p=>`<button data-pair-right="${p.id}" class="pairbtn ${p.matched?'matched':''}" ${p.matched?'disabled':''}>${escapeHtml(p.meaning)}</button>`).join('')}</div></div>`;
  }else if(['MATRIX','MEMORY'].includes(g.mode)){
   const memory=g.mode==='MEMORY';
   const locked=memory&&Number(g.flipUntil||0)>Date.now()+localTimeOffset;
   const cards=(g.cards||[]).map(c=>{
    if(c.empty)return '<div class="matrix-card-space" aria-hidden="true"></div>';
    const faceUp=!memory||c.revealed===true;
    const label=memory&&c.matched?'✓':faceUp?String(c.label||''):'✦';
    const lang=faceUp?c.lang:null;
    const cls='matrix-card'+(lang?' matrix-card--'+lang:'')+
     (memory&&!faceUp&&!c.matched?' matrix-card--hidden':'')+
     (c.matched?' is-matched':'')+(roomFirstCard===c.id?' is-selected':'');
    const aria=c.matched?'Cặp đã ghép':faceUp?(lang==='en'?'Tiếng Anh: ':'Tiếng Việt: ')+label:'Thẻ úp, nhấn để lật';
    return '<button type="button" class="'+cls+'" data-room-card="'+escapeHtml(c.id)+'" aria-label="'+escapeHtml(aria)+'"'+
     (c.matched||c.revealed||locked||roomCardPending||gameBusy?' disabled':'')+'>'+
      (lang?'<span class="matrix-card-language">'+(lang==='en'?'EN':'VI')+'</span>':'')+
      '<span class="matrix-card-text">'+escapeHtml(label)+'</span></button>';
   }).join('');
   h+=`<p class="small-note">${memory?'Lật từng thẻ để nhớ cặp Anh–Việt, sai tự úp lại. Không mất tim.':'Ghép một từ Anh với một nghĩa Việt, sai mất 1 tim.'} ${g.correct}/${rd.question_count} cặp · ${g.mistakes} lượt sai.</p>
    <div class="matrix-scroll room-matrix-scroll ${memory?'room-memory':''}" id="roomMatrixScroll" tabindex="0">
     <div class="matrix-grid room-card-grid" style="--matrix-size:${g.gridSize}">${cards}</div>
    </div>
    ${feedback?'<p class="game-status">'+escapeHtml(feedback)+'</p>':''}
    ${roomCardPending?'<button type="button" class="btn" id="roomCardRetry" '+(gameBusy?'disabled':'')+'>Thử lại thao tác chưa xác nhận</button>':''}`;
  }else if(g.mode==='BOMB'){
   h+=`<p class="small-note">Nhập nguyên từ tiếng Anh ứng với <b>bất kỳ quả bom đang rơi</b>. Gõ đúng thì bom tự biến mất, không cần chọn bom hay nhấn Enter. Bom chạm đáy sẽ mất 1 tim.</p>
    <div class="bomb-arena bomb-fixed-columns" id="bombArena" style="--bomb-lanes:${bombLaneCount(rd)}" data-bomb-lanes="${bombLaneCount(rd)}" aria-label="Các quả bom từ vựng đang rơi">${bombArenaMarkup(g,rd)}</div>
    <div class="bomb-answer-form" id="bombAnswerForm">
      <label for="bombAnswer">Nhập đáp án tiếng Anh</label>
      <div class="game-answer-row"><input id="bombAnswer" name="answer" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Gõ từ tiếng Anh — bom tự được giải" maxlength="100" aria-label="Từ tiếng Anh để giải bom"></div>
      <small class="small-note">Tự kiểm tra khi bạn ngừng gõ một chút. Chưa gõ đủ từ không bị trừ điểm.</small>
     </div>`;
 }else if(g.mode==='CAR'){
  const next=Math.max(0,Math.ceil((g.nextAllowedAt-Date.now()-localTimeOffset)/1000));
    const symbol=k=>k==='BLOCKED'?'🧱':k==='BONUS'?'⭐':k==='DOUBLE'?'×2':'·';
  h+=`<p class="small-note game-rules">EASY ưu tiên A1–A2 · NORMAL cân bằng các cấp · HARD ưu tiên C1–C2. ⭐ thưởng 1.5×; ×2 thưởng 2×. Tránh vật cản 🧱.</p>
   <div class="car-stage"><div class="game-bar"><span>CHẶNG ${g.index+1}/${g.total} · ĐÃ VƯỢT ${g.index}</span><span>🏎️ LÀN ${(g.carLane??2)+1} · GÕ ĐỂ VƯỢT</span></div>
   <div class="car-lanes" role="list">${(g.level?.lanes||[]).map((lane,i)=>`<div role="listitem" class="lane car-v6-lane car-auto-lane ${Number(g.carLane??2)===i?'current':''} ${lane.kind==='BLOCKED'?'blocked':''}" aria-label="Làn ${i+1}: ${lane.kind==='BLOCKED'?'vật cản':escapeHtml(lane.meaning)}"><span class="item">${symbol(lane.kind)}</span><span class="car-cefr">${lane.kind==='NORMAL'?(lane.cefr||'A1–A2'):lane.kind==='BONUS'?'B1–B2':lane.kind==='DOUBLE'?'C1–C2':'CẢN'}</span><span class="car-lane-word">${lane.kind==='BLOCKED'?'Tránh':escapeHtml(lane.meaning)}</span><span class="you">${Number(g.carLane??2)===i?'🏎':'·'}</span><span class="car-lane-number">${i+1}</span></div>`).join('')}</div><div class="car-vehicle" id="carVehicle" role="img" aria-label="Xe đang ở làn ${(g.carLane??2)+1}" style="left:${10+20*(g.carLane??2)}%">🏎️</div><div class="car-track-caption">🏁 Gõ đúng từ — xe tự vượt chặng</div>${arenaFeedbackMarkup()}</div>
   <form id="carAnswerForm" class="car-answer-form" autocomplete="off">
    <label for="carAnswer">Nhập từ của bất kỳ làn an toàn nào</label>
    <div class="car-answer-row"><input id="carAnswer" name="answer" type="text" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="100" placeholder="Gõ từ đúng — xe tự chuyển làn"></div>
    <span id="carReadyHint" class="small-note">${next?'Chờ '+next+' giây':'Sẵn sàng'}</span><span id="carStepTimer" class="small-note">⏱ Còn ${Math.max(0,Math.ceil(((g.stepDeadlineAt||g.endsAt)-Date.now()-localTimeOffset)/1000))}s để qua chặng</span>
   </form>
   <p class="small-note game-rules">Gõ đúng từ tiếng Anh ở bất kỳ làn an toàn nào. Xe tự chuyển làn, không cần nhấn Enter.</p>`;

 }
 if(g.mode==='MATCH'&&feedback)h+=`<div class="game-status ${feedback.startsWith('Đúng')?'good':'bad'}">${escapeHtml(feedback)}</div>`;
 h+='</div>';host.innerHTML=h;
 const newScroll=$('roomMatrixScroll');
 if(cardScroll&&newScroll){newScroll.scrollLeft=cardScroll.x;newScroll.scrollTop=cardScroll.y}
 if(g.mode==='BOMB'&&g.status==='PLAYING'){
  const el=$('bombAnswer');if(el){el.value=existingBombAnswer;prepareGameInput(el);}
  animateBombs();
  if(oldFocus==='bombAnswer'&&el)el.focus({preventScroll:true});
 }
 if(g.mode==='CAR'&&g.status==='PLAYING'){
  const el=$('carAnswer');if(el){el.value=existingCarAnswer;prepareGameInput(el);}
  if(screen==='rooms'&&g.status==='PLAYING'&&el)el.focus({preventScroll:true});
 }
}
function animateBombs(arena=$('bombArena')){
 if(!arena)return;
 const now=Date.now()+localTimeOffset;
 const reduced=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const bomb of arena.querySelectorAll('.bomb-falling')){
  const spawn=Number(bomb.dataset.bombSpawn),deadline=Number(bomb.dataset.bombDeadline);
  const duration=Math.max(1,deadline-spawn),elapsed=Math.max(0,Math.min(duration,now-spawn));
  const track=bomb.closest('.bomb-fixed-lane');
  const height=track?track.clientHeight:arena.clientHeight;
  const cardHeight=bomb.offsetHeight;
  const startY=track?5:42;
  const floor=Math.max(startY,height-cardHeight-(track?8:12));
  const key=`${spawn}:${deadline}:${startY}:${floor}`;
  const small=bomb.querySelector('small');if(small)small.textContent=Math.max(0,Math.ceil((deadline-now)/1000))+'s';
  // Fallback deliberately follows real time; no cumulative per-poll motion.
  if(reduced||typeof bomb.animate!=='function'){
   bomb._fallMotion?.cancel();bomb._fallMotion=null;bomb._fallKey=null;
   bomb.style.transition='none';
   bomb.style.transform=`translate(-50%,${Math.round(startY+(floor-startY)*elapsed/duration)}px)`;
   continue;
  }
  if(bomb._fallKey!==key||!bomb._fallMotion){
   bomb._fallMotion?.cancel();
   bomb.style.transition='none';
   const animation=bomb.animate([
    {transform:`translate(-50%,${startY}px)`},
    {transform:`translate(-50%,${floor}px)`}
   ],{duration,easing:'linear',fill:'both'});
   animation.currentTime=elapsed;
   bomb._fallMotion=animation;bomb._fallKey=key;
  }
 }
}
function updateCountdowns(){
 if(['solo','solo-bomb','solo-car'].includes(screen)){const clock=$(screen==='solo-car'?'soloCarCountdown':screen==='solo-bomb'?'soloBombCountdown':'soloCountdown');if(clock&&soloGame)clock.textContent=formatCountdown(secLeft(soloGame.game.endsAt));if(soloGame?.game.mode==='BOMB')animateBombs($('soloBombArena'));if(soloGame?.game.mode==='CAR')updateSoloCarTimers();return}
 if(screen!=='rooms')return;animateBombs();const c=$('roundCountdown');const gc=$('gameCountdown');if(c&&room){let rd=currentRoundFromEvent(room.event);if(rd)c.textContent=formatCountdown(secLeft(rd.ends_at))}if(gc&&game)gc.textContent=formatCountdown(secLeft(game.game.endsAt));
 if(game?.game.mode==='CAR'&&game.game.status==='PLAYING'){
  const remaining=Math.max(0,Math.ceil((game.game.nextAllowedAt-Date.now()-localTimeOffset)/1000));

  const hint=$('carReadyHint');if(hint)hint.textContent=remaining?'Chờ '+remaining+'s trước chặng tiếp theo':'Sẵn sàng';const clock=$('carStepTimer');if(clock)clock.textContent='⏱ Còn '+Math.max(0,Math.ceil(((game.game.stepDeadlineAt||game.game.endsAt)-Date.now()-localTimeOffset)/1000))+'s để qua chặng';
 }
}
function leaveRoom(){window.WordSkyAudio?.setScene(null,false);gameExpanded=false;roomCode='';sessionStore.removeItem('wordsky_room_code');clearRoomCardPending();roomFirstCard=null;room=null;game=null;$('roomPane').classList.add('hidden');$('joinRoomPane').classList.remove('hidden');}
// Admin
let carFeatureEnabled=false,matrixFeatureEnabled=false,memoryFeatureEnabled=false;
const initialRounds=()=>['MATCH','BOMB',...(carFeatureEnabled?['CAR']:[])].map((mode,i)=>({mode,difficulty:'NORMAL',duration_seconds:mode==='BOMB'?120:90,question_count:mode==='CAR'?12:8,points_per_correct:100,penalty:25,weight:1,topic_id:mode==='CAR'?null:topics[0]?.id||null,bomb_fall_seconds:16,bomb_batch_size:2,bomb_spawn_interval_seconds:9,car_step_seconds:8}));
let draftRounds=[];
let cefrReviewSources={};
// Admin pagination is presentation-only; keep all records for selectors and edits.
let adminTopicPage=1,adminEventPage=1,adminTopicQuery='';
const ADMIN_TOPICS_PAGE_SIZE=6,ADMIN_EVENTS_PAGE_SIZE=8;
const adminOpenTopicIds=new Set();
function clampAdminPage(page,total,size){return Math.max(1,Math.min(Math.ceil(total/size)||1,page))}
// wordsky-admin-scroll-preservation-v1: retain Admin location and in-progress CEFR work on refresh.
function captureAdminView(){
 const pane=$('adminContent');
 if(!pane?.querySelector('.panel-tabs'))return null;
 const editor=$('cefrEditor');
 const active=document.activeElement;
 const focusId=['cefrLevelFilter','cefrStatusFilter','cefrSearchFilter','cefrSourceInput'].includes(active?.id)?active.id:null;
 const topicsOpen=Array.from(pane.querySelectorAll('#adminTopicList details[data-admin-topic-id]'))
   .flatMap(el=>el.open?[el.dataset.adminTopicId]:[]);
 for(const id of topicsOpen)adminOpenTopicIds.add(id);
 return {
  scrollY:window.scrollY,
  level:$('cefrLevelFilter')?.value||'ALL',
  status:$('cefrStatusFilter')?.value||'ALL',
  search:$('cefrSearchFilter')?.value||'',
  page:cefrResultPage,
  topicPage:adminTopicPage,eventPage:adminEventPage,topicQuery:adminTopicQuery,
  topicsOpen:[...new Set([...adminOpenTopicIds,...topicsOpen])],
  editorWord:editor&&!editor.classList.contains('hidden')?$('cefrWordId')?.value:null,
  focusId,
  cursor:focusId==='cefrSearchFilter'?active.selectionStart:null
 };
}
function restoreAdminView(view){
 if(!view)return;
 if($('cefrLevelFilter'))$('cefrLevelFilter').value=view.level;
 if($('cefrStatusFilter'))$('cefrStatusFilter').value=view.status;
 if($('cefrSearchFilter'))$('cefrSearchFilter').value=view.search;
 cefrResultPage=view.page;
 filterAdminCefr(false);
 for(const id of view.topicsOpen){
  adminOpenTopicIds.add(id);
  const detail=Array.from($('adminTopicList')?.querySelectorAll('details[data-admin-topic-id]')||[]).find(el=>el.dataset.adminTopicId===id);
  if(detail)detail.open=true;
 }
 if(view.editorWord)openCefrEditor(view.editorWord,false);
 if(view.focusId){
  const input=$(view.focusId);
  if(input){input.focus({preventScroll:true});if(view.cursor!==null&&input.setSelectionRange)input.setSelectionRange(view.cursor,view.cursor)}
 }
 window.requestAnimationFrame(()=>{
  if(screen==='admin')window.scrollTo(0,view.scrollY);
 });
}
async function loadAdmin({preserveView=true}={}){const pane=$('adminContent');const view=preserveView?captureAdminView():null;if(session?.role!=='admin'){pane.innerHTML='<div class="empty"><h2>🔒 Khu vực quản trị</h2><p>Chỉ tài khoản quản trị được phép điều khiển các cuộc thi, chủ đề và tính năng.</p><button class="btn primary" id="adminLoginBtn">Đăng nhập quản trị →</button></div>';return}
 // Avoid collapsing the entire Admin page during an in-place update.
  if(!view)pane.innerHTML='<div class="loading">Đang tải quản trị…</div>';
 try{const [events,features,cefrAudit]=await Promise.all([api('admin/events'),api('admin/features'),api('admin/cefr/reviews')]);adminEvents=events.events||[];cefrReviewSources=Object.fromEntries((cefrAudit.reviews||[]).map(r=>[r.word_id,r.source_url||'']));
 carFeatureEnabled=(features.features||[]).some(f=>f.feature_key==='CAR'&&f.enabled===true);
  matrixFeatureEnabled=(features.features||[]).some(f=>f.feature_key==='MATRIX'&&f.enabled===true);
  memoryFeatureEnabled=(features.features||[]).some(f=>f.feature_key==='MEMORY'&&f.enabled===true);
  await loadTopics(false,true);if(view){adminTopicPage=view.topicPage;adminEventPage=view.eventPage;adminTopicQuery=view.topicQuery;}if(!editingEvent&&!carFeatureEnabled)draftRounds=draftRounds.filter(r=>r.mode!=='CAR');if(!draftRounds.length)draftRounds=initialRounds();
 pane.innerHTML=`<div class="panel-tabs"><button data-admin-tab="events" class="${adminTab==='events'?'on':''}">🏆 Cuộc thi</button><button data-admin-tab="vocab" class="${adminTab==='vocab'?'on':''}">📚 Từ vựng</button><button data-admin-tab="features" class="${adminTab==='features'?'on':''}">⚙️ Tính năng</button></div><div id="adminPanelEvents" class="admin-panel ${adminTab==='events'?'active':''}"></div><div id="adminPanelVocab" class="admin-panel ${adminTab==='vocab'?'active':''}"></div><div id="adminPanelFeatures" class="admin-panel ${adminTab==='features'?'active':''}"></div>`;
  renderAdminEvents();renderAdminVocab();filterAdminCefr();renderAdminFeatures(features.features||[]);setupPasswordToggles(pane);
   restoreAdminView(view);
 }catch(e){pane.innerHTML=`<div class="empty">${escapeHtml(e.message)}<p class="small-note">Cần cấu hình PostgreSQL và khóa admin để mở bảng quản trị.</p></div>`}}
function optionsTopics(value,allowAll=false){return `<option value="" ${allowAll?'':'disabled'} ${!value?'selected':''}>${allowAll?'Tất cả chủ đề':'-- Chọn chủ đề --'}</option>`+topics.map(t=>`<option value="${t.id}" ${t.id===value?'selected':''}>${escapeHtml(t.title)} (${t.words?.length||0} từ)</option>`).join('')}
function countUniqueCefr(words,levels){return new Set(words.filter(w=>levels.includes(w.cefr_level)).map(w=>String(w.english).trim().toLowerCase())).size}
function carVocabularyNeeds(difficulty,count){
 const plan={EASY:[3,1,0],NORMAL:[1,1,1],HARD:[0,1,2]}[difficulty]||[1,1,1];
 return {A2:plan[0]*count,BONUS:plan[1]*count,DOUBLE:plan[2]*count};
}
function cardRoundDefaultDuration(mode,pairs){
 const presets={MATRIX:{8:180,12:240,18:360,32:480,50:720,72:1200,128:1800},MEMORY:{8:90,12:120,18:180,32:240,50:360,72:600,128:900}};
 return presets[mode]?.[pairs]??null;
}
function cardRoundAdjustedDuration(mode,previousPairs,nextPairs,previousDuration){
 const oldDefault=cardRoundDefaultDuration(mode,previousPairs);
 const nextDefault=cardRoundDefaultDuration(mode,nextPairs);
 return oldDefault!==null&&nextDefault!==null&&Number(previousDuration)===oldDefault
  ?nextDefault:previousDuration;
}
function adminRoundPenalty(mode,roundPenalty,defaultPenalty){
 return ['MATRIX','MEMORY'].includes(mode)?Number(roundPenalty):Number(defaultPenalty);
}
function renderRounds(){
 const host=$('roundsEditor');if(!host)return;
 host.innerHTML=draftRounds.map((r,i)=>{
  const isCards=['MATRIX','MEMORY'].includes(r.mode);
  const words=r.topic_id?(topics.find(t=>t.id===r.topic_id)?.words||[]):topics.flatMap(t=>t.words||[]);
  const byEnglish=new Set(words.map(w=>String(w.english).trim().toLowerCase()));
  const byMeaning=new Set(words.map(w=>String(w.meaning).trim().toLowerCase()));
  const available=Math.min(byEnglish.size,byMeaning.size);
  const extra=r.mode==='MATCH'?({EASY:0,NORMAL:2,HARD:4}[r.difficulty]||0):0;
  const cap=Math.max(0,Math.min(30,available-extra));
  const approved=words.filter(w=>w.cefr_review_status==='APPROVED');
  const a2=countUniqueCefr(approved,['A1','A2']),bonus=countUniqueCefr(approved,['B1','B2']),high=countUniqueCefr(approved,['C1','C2']);
  const need=carVocabularyNeeds(r.difficulty,r.question_count);
  const cefrHint=r.mode==='CAR'?'<small class="car-stock-note">Đã duyệt: A1–A2 '+a2+'/'+need.A2+', B1–B2 '+bonus+'/'+need.BONUS+', C1–C2 '+high+'/'+need.DOUBLE+'</small>':'';
  const modes=['MATCH','BOMB',...(carFeatureEnabled||r.mode==='CAR'?['CAR']:[]),
   ...(matrixFeatureEnabled||r.mode==='MATRIX'?['MATRIX']:[]),
   ...(memoryFeatureEnabled||r.mode==='MEMORY'?['MEMORY']:[])];
  const modesHtml=modes.map(m=>'<option '+(m===r.mode?'selected':'')+' value="'+m+'">'+MODE_SHORT[m]+'</option>').join('');
  const sizes=[{n:8,label:'4 × 4 · 8 cặp'},{n:12,label:'5 × 5 · 12 cặp · 1 ô trống'},
   {n:18,label:'6 × 6 · 18 cặp'},{n:32,label:'8 × 8 · 32 cặp'},
   {n:50,label:'10 × 10 · 50 cặp'},{n:72,label:'12 × 12 · 72 cặp'},
   {n:128,label:'16 × 16 · 128 cặp'}];
  const countHtml=isCards?'<label>Số ô / kích thước<select data-k="question_count">'+
   sizes.map(t=>'<option value="'+t.n+'" '+(t.n===r.question_count?'selected':'')+'>'+t.label+'</option>').join('')+'</select></label>':
   '<label>Số lượt<input type="number" data-k="question_count" min="3" max="'+(r.mode==='MATCH'?Math.min(20,cap):cap)+'" value="'+r.question_count+'"></label>';
  const cardPenaltyHtml=isCards?'<label>Điểm trừ khi sai<input type="number" data-k="penalty" min="0" max="1000" value="'+Number(r.penalty??25)+'"></label>':'';
  const bombHtml=r.mode==='BOMB'?'<label>Bom rơi (s)<input type="number" data-k="bomb_fall_seconds" min="5" max="60" value="'+(r.bomb_fall_seconds??16)+'"></label>'+
   '<label>Số bom / đợt<input type="number" data-k="bomb_batch_size" min="1" max="3" value="'+(r.bomb_batch_size??2)+'"></label>'+
   '<label>Khoảng cách đợt (s)<input type="number" data-k="bomb_spawn_interval_seconds" min="3" max="45" value="'+(r.bomb_spawn_interval_seconds??9)+'"></label>':'';
  const carHtml=r.mode==='CAR'?'<label>Giây / chặng<input type="number" data-k="car_step_seconds" min="2" max="45" value="'+(r.car_step_seconds??8)+'"></label>':'';
  const stock=isCards?'<small>Cần '+r.question_count+' cặp Anh–Việt không trùng nghĩa. Số lượng sơ bộ: '+available+'. Máy chủ sẽ kiểm tra chính xác trước khi mở phòng.</small>':
   '<small>Tối đa '+(r.mode==='CAR'?30:cap)+' lượt'+(extra?' (thêm '+extra+' đáp án nhiễu)':'')+'</small>';
  return '<div class="round-line" data-round="'+i+'"><label>Kiểu chơi<select data-k="mode">'+modesHtml+'</select></label>'+
   '<label>Chủ đề<select data-k="topic_id">'+optionsTopics(r.topic_id,true)+'</select></label>'+
   '<label>Độ khó<select data-k="difficulty">'+['EASY','NORMAL','HARD'].map(d=>'<option value="'+d+'" '+(d===r.difficulty?'selected':'')+'>'+d+'</option>').join('')+'</select></label>'+
   '<label>Thời gian (giây)<input type="number" data-k="duration_seconds" min="20" max="'+(isCards?1800:600)+'" value="'+r.duration_seconds+'"></label>'+
   countHtml+cardPenaltyHtml+bombHtml+carHtml+
   '<label>Điểm đúng<input type="number" data-k="points_per_correct" min="10" max="1000" value="'+r.points_per_correct+'"></label>'+
   '<label>Hệ số<input type="number" data-k="weight" min="1" max="10" value="'+r.weight+'"></label>'+
   '<div class="round-note">'+stock+cefrHint+'</div>'+
   '<div class="round-remove-row"><button class="btn warn" type="button" data-remove-round="'+i+'" aria-label="Xóa vòng '+(i+1)+'">✕ Xóa vòng '+(i+1)+'</button></div></div>';
 }).join('')+'<p class="small-note">MATRIX/MEMORY trong phòng thi có kích thước từ 4×4 đến 16×16 (5×5 có 1 ô trống). MEMORY không trừ tim và có thời gian mặc định bằng nửa MATRIX; Admin được chỉnh thời gian, chủ đề, cấp độ và điểm.</p>';
}
function collectRounds(){document.querySelectorAll('[data-round]').forEach(e=>{const i=Number(e.dataset.round);const r=draftRounds[i];e.querySelectorAll('[data-k]').forEach(c=>{r[c.dataset.k]=['mode','topic_id','difficulty'].includes(c.dataset.k)?c.value:Number(c.value)});r.topic_id=r.topic_id||null;
 if(r.mode==='MATCH')r.question_count=Math.min(20,r.question_count);});return draftRounds}
function renderAdminEvents(){const host=$('adminPanelEvents');if(!host)return;
 host.innerHTML=`<div class="dashboard-card"><div class="dashboard-row"><h2>🛠️ ${editingEvent?'Sửa cuộc thi':'Tạo cuộc thi mới'}</h2>${editingEvent?'<button class="btn" id="cancelEditEvent">Hủy sửa</button>':''}</div><p class="small-note">Cấu hình mật khẩu phòng, số người tối đa, thời gian mỗi vòng và điểm số. Người tham gia nhìn thấy bảng điểm theo thời gian thực.</p><form id="createEventForm" class="form-grid"><label>Tên cuộc thi<input name="title" value="${escapeHtml(editingEvent?.title||'WordSky English Cup')}" required maxlength="120"></label><label>Mật khẩu tham gia<input name="password" type="password" minlength="8" placeholder="${editingEvent?'Bỏ trống để giữ mật khẩu':'Tối thiểu 8 ký tự'}" ${editingEvent?'':'required'} autocomplete="new-password"></label><label>Giới hạn số người<input name="max_players" type="number" min="2" max="500" value="${editingEvent?.max_players||30}" required></label><label>Điểm trừ mặc định (MATCH/BOMB/CAR)<input name="penalty" type="number" min="0" max="1000" value="${draftRounds[0]?.penalty??25}"></label><div class="span2"><div class="dashboard-row"><h3>Các vòng thi (${draftRounds.length})</h3><div class="form-actions"><button type="button" class="btn" data-add-round="MATCH">+ Nối từ</button><button type="button" class="btn" data-add-round="BOMB">+ Bom</button><button type="button" class="btn" data-add-round="CAR" ${carFeatureEnabled?'':'disabled title="CAR chưa bật hoặc chưa có dữ liệu CEFR đã duyệt"'}>+ Đua xe</button><button type="button" class="btn" data-add-round="MATRIX" ${matrixFeatureEnabled?'':'disabled title="MATRIX đang tắt"'}>+ Ma trận mở</button><button type="button" class="btn" data-add-round="MEMORY" ${memoryFeatureEnabled?'':'disabled title="MEMORY đang tắt"'}>+ Ma trận úp</button></div></div><div id="roundsEditor"></div></div><button type="submit" class="btn primary span2">${editingEvent?'Lưu chỉnh sửa':'Tạo phòng thi'} →</button></form></div><div class="dashboard-card"><div class="dashboard-row"><h2>📋 Danh sách giải đấu</h2><span class="pill">${adminEvents.length} giải</span></div><div id="eventsList"></div></div>`;
  renderRounds();setupPasswordToggles(host);renderAdminEventList();
}
function renderAdminEventList(){
 const list=$('eventsList');if(!list)return;
 adminEventPage=clampAdminPage(adminEventPage,adminEvents.length,ADMIN_EVENTS_PAGE_SIZE);
 const pages=Math.max(1,Math.ceil(adminEvents.length/ADMIN_EVENTS_PAGE_SIZE));
 const from=(adminEventPage-1)*ADMIN_EVENTS_PAGE_SIZE;
 const shown=adminEvents.slice(from,from+ADMIN_EVENTS_PAGE_SIZE);
 list.innerHTML=(shown.length?shown.map(e=>`<div class="editor-item"><div><strong>${escapeHtml(e.title)}</strong> <span class="pill ${e.status==='LIVE'?'good':e.status==='FINISHED'?'red':'yellow'}">${e.status}</span><p class="small-note" style="margin:7px 0">Mã: <b>${escapeHtml(e.join_code)}</b> · ${e.participants}/${e.max_players} người · ${e.rounds.length} vòng</p></div><div class="form-actions">${['DRAFT','OPEN'].includes(e.status)?`<button class="btn" data-edit-event="${e.id}">Sửa</button>`:''}${e.status==='DRAFT'?`<button class="btn" data-event-action="open" data-event-id="${e.id}">Mở phòng</button>`:''}${e.status==='OPEN'?`<button class="btn primary" data-event-action="start" data-event-id="${e.id}">Bắt đầu</button>`:''}${['OPEN','LIVE','DRAFT'].includes(e.status)?`<button class="btn warn" data-event-action="finish" data-event-id="${e.id}">Kết thúc</button>`:''}<button class="btn" data-copy-code="${escapeHtml(e.join_code)}">Copy mã</button></div></div>`).join(''):'<div class="empty">Chưa có cuộc thi nào. Hãy tạo một cuộc thi đầu tiên.</div>')+
 (adminEvents.length?`<div class="admin-page-bar" role="navigation" aria-label="Phân trang danh sách giải đấu"><span class="small-note">Giải ${from+1}–${from+shown.length}/${adminEvents.length} · Trang ${adminEventPage}/${pages}</span><div class="form-actions"><button type="button" class="btn" data-admin-event-page="prev" ${adminEventPage===1?'disabled':''}>← Trước</button><button type="button" class="btn" data-admin-event-page="next" ${adminEventPage===pages?'disabled':''}>Tiếp →</button></div></div>`:'');
}

async function submitEventForm(event){event.preventDefault();collectRounds();const f=new FormData(event.target);const p=Object.fromEntries(f);const penalty=Number(p.penalty);const rounds=draftRounds.map(r=>({...r,penalty:adminRoundPenalty(r.mode,r.penalty,penalty)}));const payload={title:p.title,max_players:Number(p.max_players),rounds};if(p.password)payload.password=p.password;
 for(const round of rounds){
  if(round.mode==='BOMB'&&round.duration_seconds<(Math.ceil(round.question_count/Number(round.bomb_batch_size??2))-1)*Number(round.bomb_spawn_interval_seconds??9)+Number(round.bomb_fall_seconds??16)){toast('Tăng thời gian vòng: bom cuối chưa đủ thời gian để rơi.',true);return;}
  if(round.mode==='CAR'&&round.duration_seconds<round.question_count*Number(round.car_step_seconds??8)){toast('Vòng CAR cần tổng thời gian ít nhất số chặng × giây mỗi chặng.',true);return;}
  const topic=topics.find(t=>t.id===round.topic_id);
   const vocab=round.topic_id?topic?.words||[]:topics.flatMap(t=>t.words||[]);
  if(round.mode==='CAR'){
    if(!carFeatureEnabled){toast('CAR đang tắt; hãy xóa vòng CAR hoặc bật tính năng khi dữ liệu CEFR đã sẵn sàng.',true);return;}
   const approved=vocab.filter(w=>w.cefr_review_status==='APPROVED');
   const counts={A2:countUniqueCefr(approved,['A1','A2']),BONUS:countUniqueCefr(approved,['B1','B2']),DOUBLE:countUniqueCefr(approved,['C1','C2'])};
   const need=carVocabularyNeeds(round.difficulty,round.question_count);
   const missing=Object.keys(need).filter(k=>counts[k]<need[k]);
   if(missing.length){toast('Lane Escape cần từ CEFR ĐÃ DUYỆT: '+missing.map(k=>`${k==='A2'?'A1–A2':k} ${counts[k]}/${need[k]}`).join(', '),true);return;}
   continue;
  }
   const available=new Set(vocab.map(w=>String(w.english).trim().toLowerCase())).size;
  const needed=round.question_count+(round.mode==='MATCH'?({EASY:0,NORMAL:2,HARD:4}[round.difficulty]||0):0);
   if(available<needed){toast(`${round.topic_id?`Chủ đề ${topic?.title||'không hợp lệ'}`:'Tất cả chủ đề'} cần ${needed} từ, hiện có ${available} từ (thiếu ${needed-available} từ).`,true);return;}
 }
 try{if(editingEvent){await api('admin/events/'+editingEvent.id,{method:'PATCH',body:payload});toast('Đã lưu cấu hình cuộc thi');editingEvent=null}else{const out=await api('admin/events',{method:'POST',body:payload});toast('Đã tạo phòng '+out.join_code+' — hãy Mở phòng để đón người chơi')}draftRounds=[];loadAdmin()}
 catch(e){toast(e.message,true)}
}
function renderAdminVocab(){const host=$('adminPanelVocab');if(!host)return;
 const allWords=topics.flatMap(t=>t.words||[]),approvedWords=allWords.filter(w=>w.cefr_review_status==='APPROVED');
 const a2Stock=countUniqueCefr(approvedWords,['A1','A2']);
 const bonusStock=countUniqueCefr(approvedWords,['B1','B2']);
 const doubleStock=countUniqueCefr(approvedWords,['C1','C2']);
 host.innerHTML=`<div class="twocol" style="margin:0 0 16px"><div class="dashboard-card"><h2>Thêm chủ đề</h2><form id="topicForm" class="form-stack"><label>Tên chủ đề<input name="title" placeholder="VD: Sports - Thể thao" maxlength="80" required></label><button type="submit" class="btn primary">+ Thêm chủ đề</button></form></div><div class="dashboard-card"><h2>Thêm thẻ từ</h2><form id="wordForm" class="form-stack"><label>Chủ đề<select name="topic_id" required>${optionsTopics(topics[0]?.id)}</select></label><label>English<input name="english" maxlength="80" required placeholder="apple"></label><label>Nghĩa tiếng Việt<input name="meaning" maxlength="180" required placeholder="Quả táo"></label><label>Phiên âm<input name="ipa" placeholder="/ˈæpəl/"></label><label>Ví dụ<input name="example" placeholder="I eat an apple."></label><label>Dịch ví dụ<input name="translation" placeholder="Tôi ăn một quả táo."></label><button type="submit" class="btn primary">+ Thêm thẻ từ</button></form></div></div><div class="dashboard-card"><h2>🎓 Quản lý cấp độ CEFR</h2>
<p class="small-note">A1/A2, B1/B2, C1/C2 là 6 cấp độ riêng. CAR sử dụng A1/A2, B1/B2 và C1/C2.</p>
<p class="small-note">Tổng: ${allWords.length} · APPROVED: ${approvedWords.length} · PROVISIONAL: ${allWords.filter(w=>w.cefr_review_status==='PROVISIONAL').length} · UNREVIEWED: ${allWords.filter(w=>!w.cefr_review_status||w.cefr_review_status==='UNREVIEWED').length}</p>
<p class="small-note">CAR Normal 3 chặng (toàn bộ chủ đề): A1/A2 ${a2Stock}/3 · B1/B2 ${bonusStock}/3 · C1/C2 ${doubleStock}/3 — ${a2Stock>=3&&bonusStock>=3&&doubleStock>=3?'Đủ tồn kho cơ bản':'Chưa đủ tồn kho'}. CAR vẫn phải được Admin bật riêng.</p>
<div class="form-actions" style="gap:10px;flex-wrap:wrap;align-items:end;margin:12px 0">
<label>CEFR<select id="cefrLevelFilter"><option value="ALL">Tất cả</option><option value="NONE">Chưa gắn</option><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option></select></label>
<label>Trạng thái<select id="cefrStatusFilter"><option value="ALL">Tất cả</option><option>UNREVIEWED</option><option>PROVISIONAL</option><option>APPROVED</option></select></label>
<label>Tìm kiếm<input id="cefrSearchFilter" placeholder="Từ, nghĩa hoặc chủ đề" autocomplete="off"></label>
<button type="button" class="btn" id="cefrClearFilters">Bỏ lọc CEFR/trạng thái</button>
</div>
<p class="small-note">Lọc theo cấp độ, trạng thái và từ khóa cùng lúc. Kết quả nằm ngay bên dưới; bấm <b>Sửa CEFR</b> để chỉnh từng từ. Nếu không thấy từ, chọn <b>Tất cả</b> ở hai bộ lọc.</p>
<div class="cefr-quick-result" data-cefr-results="wordsky-cefr-quick-results-v1" aria-live="polite">
 <p id="cefrResultSummary" class="small-note"></p>
 <div id="cefrResultList"></div>
 <div id="cefrResultPager" class="form-actions"></div>
</div>
<div id="cefrEditor" class="hidden" style="padding:15px;border:1px solid #496291;border-radius:12px;margin:12px 0">
<h3 id="cefrWordLabel">Đánh giá CEFR</h3>
<form id="cefrReviewForm" class="form-stack">
<input type="hidden" id="cefrWordId" name="word_id">
<label>Cấp độ<select name="cefr_level" id="cefrLevelInput"><option value="">Chưa xác định</option><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option></select></label>
<label>Trạng thái<select name="cefr_review_status" id="cefrStatusInput"><option>UNREVIEWED</option><option>PROVISIONAL</option><option>APPROVED</option></select></label>
<label>Link nguồn cho nghĩa đang xét (bắt buộc nếu APPROVED)<input type="url" id="cefrSourceInput" name="source_url" maxlength="500" placeholder="https://dictionary.cambridge.org/..."></label>
<p class="small-note">Chỉ đánh dấu APPROVED khi nguồn đúng nghĩa đang sử dụng. Thao tác được ghi trong ws_audit. Sửa từ/IPA/nghĩa/ví dụ sẽ tự đặt về UNREVIEWED khi có thay đổi.</p>
<div class="form-actions"><button class="btn primary" type="submit">Lưu CEFR</button><button type="button" class="btn" id="cefrCancel">Hủy</button></div>
</form>
</div></div>
<div class="dashboard-card"><h2>Quản lý chủ đề và nội dung từ</h2><p class="small-note">Mở chủ đề để sửa nghĩa, ví dụ hoặc ẩn từ. Để tìm và đổi CEFR nhanh, dùng bảng kết quả ngay phía trên.</p><div class="admin-topic-controls"><label for="adminTopicSearch">Tìm chủ đề<input id="adminTopicSearch" type="search" placeholder="Nhập tên chủ đề…" autocomplete="off" value="${escapeHtml(adminTopicQuery)}"></label></div><div id="adminTopicList"></div><div id="adminTopicPager"></div></div>`;
 renderAdminTopicList();
}
function filterAdminTopics(query){
 const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi').replace(/đ/g,'d');
 const needle=fold(query).trim();
 return needle?topics.filter(t=>fold(t.title).includes(needle)):topics;
}
function renderAdminTopicList(){
 const list=$('adminTopicList'),pager=$('adminTopicPager');if(!list||!pager)return;
 // Read the live disclosure state before replacing DOM: toggle events can be queued.
 for(const item of list.querySelectorAll('details[data-admin-topic-id]')){
  if(item.open)adminOpenTopicIds.add(item.dataset.adminTopicId);
  else adminOpenTopicIds.delete(item.dataset.adminTopicId);
 }
 const filtered=filterAdminTopics(adminTopicQuery);
 adminTopicPage=clampAdminPage(adminTopicPage,filtered.length,ADMIN_TOPICS_PAGE_SIZE);
 const pages=Math.max(1,Math.ceil(filtered.length/ADMIN_TOPICS_PAGE_SIZE));
 const from=(adminTopicPage-1)*ADMIN_TOPICS_PAGE_SIZE,shown=filtered.slice(from,from+ADMIN_TOPICS_PAGE_SIZE);
 list.innerHTML=shown.length?shown.map(t=>`<details class="room-card admin-topic-item" data-admin-topic-id="${t.id}" ${adminOpenTopicIds.has(t.id)?'open':''}><summary><strong>${escapeHtml(t.title)} (${(t.words||[]).length} từ)</strong></summary><div class="form-actions admin-topic-actions"><button type="button" class="btn" data-edit-topic="${t.id}">Sửa tên</button><button type="button" class="btn warn" data-del-topic="${t.id}">Ẩn chủ đề</button></div><div class="admin-topic-words">${(t.words||[]).map(w=>`<div class="editor-item"><div><strong>${escapeHtml(w.english)}</strong> <small>${escapeHtml(w.meaning)}</small><small>CEFR: ${escapeHtml(w.cefr_level||'—')} · ${escapeHtml(w.cefr_review_status||'UNREVIEWED')}</small></div><span class="form-actions"><button type="button" class="btn" data-edit-cefr="${w.id}">CEFR</button><button type="button" class="btn" data-edit-word="${w.id}">Sửa</button><button type="button" class="btn warn" data-del-word="${w.id}">Ẩn</button></span></div>`).join('')}</div></details>`).join(''):'<div class="empty">Không tìm thấy chủ đề phù hợp.</div>';
 pager.innerHTML=`<div class="admin-page-bar" role="navigation" aria-label="Phân trang chủ đề từ vựng"><span class="small-note">${filtered.length?`Chủ đề ${from+1}–${from+shown.length}/${filtered.length}`:'0 chủ đề'} · Trang ${adminTopicPage}/${pages}</span><div class="form-actions"><button type="button" class="btn" data-admin-topic-page="prev" ${adminTopicPage===1?'disabled':''}>← Trước</button><button type="button" class="btn" data-admin-topic-page="next" ${adminTopicPage===pages?'disabled':''}>Tiếp →</button></div></div>`;
}
function openCefrEditor(id,scroll=true){
 const w=topics.flatMap(t=>t.words||[]).find(x=>x.id===id);
 if(!w)return toast('Không tìm thấy từ vựng',true);
 $('cefrWordId').value=w.id;
 $('cefrWordLabel').textContent='Đánh giá CEFR: '+w.english+' — '+w.meaning;
 $('cefrLevelInput').value=w.cefr_level||'';
 $('cefrStatusInput').value=w.cefr_review_status||'UNREVIEWED';
 $('cefrSourceInput').value=cefrReviewSources[w.id]||'';
 $('cefrEditor').classList.remove('hidden');
 if(scroll)$('cefrEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function saveCefrReview(e){
 e.preventDefault();
 const d=Object.fromEntries(new FormData(e.target));
 const data={cefr_level:d.cefr_level||null,cefr_review_status:d.cefr_review_status,source_url:d.source_url.trim()};
 if(data.cefr_review_status==='APPROVED'&&!data.source_url)return toast('APPROVED cần link nguồn HTTPS',true);
 if(data.cefr_review_status==='APPROVED'&&!confirm('Xác nhận cấp độ CEFR phù hợp với nghĩa và nguồn đã kiểm tra?'))return;
 try{
  await api('admin/words/'+encodeURIComponent(d.word_id)+'/cefr',{method:'PATCH',body:data});
   toast('Đã cập nhật CEFR và ghi lịch sử');await loadAdmin();
 }catch(error){toast(error.message,true)}
}
// wordsky-cefr-quick-results-v1: matching also searches collapsed topic groups.
let cefrResultPage=1;
const CEFR_RESULT_PAGE_SIZE=30;
function cefrSearchMatches(rows,level,status,search){
 const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi').replace(/đ/g,'d');
 const needle=fold(search).trim();
 return rows.filter(({w,topic})=>{
  const okLevel=level==='ALL'||(level==='NONE'?!w.cefr_level:w.cefr_level===level);
  const okStatus=status==='ALL'||(w.cefr_review_status||'UNREVIEWED')===status;
  const okText=!needle||fold(w.english+' '+w.meaning+' '+topic).includes(needle);
  return okLevel&&okStatus&&okText;
 });
}
function filterAdminCefr(resetPage=true){
 const level=$('cefrLevelFilter')?.value||'ALL',status=$('cefrStatusFilter')?.value||'ALL';
 const search=$('cefrSearchFilter')?.value||'';
 const all=topics.flatMap(t=>(t.words||[]).map(w=>({w,topic:t.title})));
 const filtered=cefrSearchMatches(all,level,status,search);
 if(resetPage)cefrResultPage=1;
 const pages=Math.max(1,Math.ceil(filtered.length/CEFR_RESULT_PAGE_SIZE));
 cefrResultPage=Math.min(pages,Math.max(1,cefrResultPage));
 const from=(cefrResultPage-1)*CEFR_RESULT_PAGE_SIZE;
 const showing=filtered.slice(from,from+CEFR_RESULT_PAGE_SIZE);
 const summary=$('cefrResultSummary'),list=$('cefrResultList'),pager=$('cefrResultPager');
 if(!summary||!list||!pager)return;
 summary.textContent=filtered.length?
   'Tìm thấy '+filtered.length+' / '+all.length+' từ · Hiển thị '+(from+1)+'–'+(from+showing.length)+' · Trang '+cefrResultPage+'/'+pages:
   'Không có từ khớp bộ lọc ('+all.length+' từ trong kho).';
 if(!showing.length){
   const other=cefrSearchMatches(all,'ALL','ALL',search);
   list.innerHTML='<div class="empty">'+(search.trim()&&other.length?
     'Có '+other.length+' từ khớp tìm kiếm nhưng bị ẩn bởi bộ lọc CEFR hoặc trạng thái. Hãy bấm <b>Bỏ lọc CEFR/trạng thái</b>.':
     'Không tìm thấy từ phù hợp. Thử từ khóa khác hoặc bấm <b>Bỏ lọc CEFR/trạng thái</b>.')+'</div>';
 }else{
   list.innerHTML='<div class="cefr-result-scroll"><table class="cefr-result-table"><thead><tr><th>Từ tiếng Anh</th><th>Nghĩa</th><th>Chủ đề</th><th>CEFR</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>'+
     showing.map(({w,topic})=>'<tr><td><strong>'+escapeHtml(w.english)+'</strong></td><td>'+escapeHtml(w.meaning)+'</td><td>'+escapeHtml(topic)+'</td><td><strong>'+escapeHtml(w.cefr_level||'—')+'</strong></td><td>'+escapeHtml(w.cefr_review_status||'UNREVIEWED')+'</td><td><button class="btn" type="button" data-cefr-open="'+escapeHtml(w.id)+'">Sửa CEFR</button></td></tr>').join('')+
     '</tbody></table></div>';
 }
 pager.innerHTML=(cefrResultPage>1?'<button type="button" class="btn" data-cefr-page="prev">← Trước</button>':'')+
   (pages>1?'<span class="small-note" style="align-self:center">Trang '+cefrResultPage+'/'+pages+'</span>':'')+
   (cefrResultPage<pages?'<button type="button" class="btn" data-cefr-page="next">Tiếp →</button>':'');
}

function renderAdminFeatures(data){const labels={ATTENDANCE:'📅 Điểm chuyên cần',SIGNUP:'👥 Đăng ký học viên',MATCH:'🔗 Game nối từ',BOMB:'💣 Game giải bom',CAR:'🏎️ Game xe 5 làn',MATRIX:'🃏 Ma trận mở',MEMORY:'🧠 Ma trận úp'};$('adminPanelFeatures').innerHTML=`<div class="dashboard-card"><h2>Quản lý tính năng hệ thống</h2><p class="small-note">Bật / tắt chức năng ngay trên backend. Trận đang diễn ra có thể bị gián đoạn khi tắt chế độ thi đấu, hãy thay đổi ngoài giờ thi.</p>${data.map(x=>`<div class="editor-item"><strong>${labels[x.feature_key]||x.feature_key}</strong><label style="flex-direction:row;align-items:center"><input type="checkbox" data-feature="${x.feature_key}" ${x.enabled?'checked':''}> ${x.enabled?'Đang bật':'Đang tắt'}</label></div>`).join('')}</div>`}
async function manageAction(action,id){
 const existing=adminEvents.find(x=>x.id===id);
 if(action==='finish'&&!confirm(`Kết thúc giải "${existing?.title}"? Bảng điểm sẽ được giữ lại.`))return;
 try{const result=await api(`admin/events/${id}/${action}`,{method:'POST',body:{}});existing.status=result.status||({open:'OPEN',start:'LIVE',finish:'FINISHED'}[action]);toast('Đã cập nhật trạng thái phòng');renderAdminEventList()}catch(e){toast(e.message,true)}
}
function editEvent(id){editingEvent=adminEvents.find(e=>e.id===id);draftRounds=editingEvent.rounds.map(r=>({...r}));renderAdminEvents();document.querySelector('#createEventForm')?.scrollIntoView({behavior:'smooth'})}
async function manageVocabulary(type,id){
 if(type==='edit-topic'){
  const t=topics.find(x=>x.id===id),title=prompt('Tên chủ đề mới',t?.title||'');if(!title)return;
  try{await api(`admin/topics/${id}`,{method:'PATCH',body:{title}});toast('Đã đổi tên chủ đề');loadAdmin()}catch(e){toast(e.message,true)}
 }else if(type==='del-topic'){
  if(!confirm('Ẩn chủ đề này khỏi danh sách học và các vòng thi mới?'))return;
  try{await api(`admin/topics/${id}`,{method:'DELETE'});toast('Đã ẩn chủ đề');loadAdmin()}catch(e){toast(e.message,true)}
 }else{
  const w=topics.flatMap(t=>t.words).find(x=>x.id===id);
  if(type==='edit-word'){
   const en=prompt('Từ tiếng Anh',w?.english||'');if(!en)return;
   const vi=prompt('Nghĩa tiếng Việt',w?.meaning||'');if(!vi)return;
   try{await api('admin/words/'+id,{method:'PATCH',body:{english:en,meaning:vi,ipa:w.ipa||'',example:w.example||'',translation:w.translation||''}});toast('Đã sửa thẻ');loadAdmin()}catch(e){toast(e.message,true)}
  }else if(type==='del-word'){
   if(!confirm(`Ẩn từ "${w?.english}"?`))return;
   try{await api('admin/words/'+id,{method:'DELETE'});toast('Đã ẩn từ');loadAdmin()}catch(e){toast(e.message,true)}
  }
 }
}
 // Prevent tapping virtual keys from opening the mobile OS keyboard.
 window.addEventListener('resize',()=>{prepareGameInput($('bombAnswer'));prepareGameInput($('carAnswer'));prepareGameInput($('soloBombAnswer'));prepareGameInput($('soloCarAnswer'));});
 // Delegated user interactions
 window.addEventListener('click',async event=>{
 const button=event.target.closest('button,[data-screen],[data-close]');if(!button)return;
 if(button.dataset.screen){event.preventDefault();navigate(button.dataset.screen);return}
 if(button.dataset.close==='auth'){closeAuth();return}
 if(button.id==='accountButton'){
  if(session?.role==='player'){location.assign('/account.html');return}
  if(session){if(confirm('Bạn muốn đăng xuất?'))await logout()}
  else openAuth();
  return;
 }
 if(button.id==='loginTab'){setLoginMode('login');return}
 if(button.id==='signupTab'){setLoginMode('signup');return}
 if(button.id==='attendanceLogin'||button.id==='adminLoginBtn'){setLoginMode('login');openAuth();return}
 if(button.id==='checkinBtn'){try{const r=await api('attendance/checkin',{method:'POST',body:{}});toast(r.already?'Hôm nay bạn đã điểm danh rồi!':`Điểm danh thành công! +${r.earned} XP`);loadAttendance()}catch(e){toast(e.message,true)}return}
 if(['soloNewConfig','soloBombNewConfig','soloCarNewConfig'].includes(button.id)){resetSolo();return}
 if(['soloReplay','soloBombReplay','soloCarReplay'].includes(button.id)){const mode=soloGame?.game?.mode||soloModeForScreen(),config={topic_id:soloGame?.round?.topic_id||null,difficulty:soloGame?.round?.difficulty,question_count:soloGame?.round?.question_count,duration_seconds:soloGame?.round?.duration_seconds};await beginSolo(mode,config);return}
 if(['soloHome','soloBombHome','soloCarHome'].includes(button.id)){navigate('home');return}
 if(['soloTopicsRetry','soloBombTopicsRetry','soloCarTopicsRetry'].includes(button.id)){await loadTopics();return}
 if(['soloStartRetry','soloBombStartRetry','soloCarStartRetry'].includes(button.id)){if(lastSoloConfig)await beginSolo(lastSoloConfig.mode,lastSoloConfig.config);return}
 if(['soloPendingRetry','soloBombPendingRetry','soloCarPendingRetry'].includes(button.id)){await resolveSoloPending();return}
 if(button.dataset.soloPairLeft){if(soloGame?.game.status!=='PLAYING'||soloBusy||soloPending)return;selectedSoloEnglish=button.dataset.soloPairLeft;soloFeedback='';soloPairFeedback=null;renderSoloGame();return}
 if(button.dataset.soloPairRight){if(soloGame?.game.status!=='PLAYING'||soloBusy||soloPending)return;if(!selectedSoloEnglish){toast('Chọn từ tiếng Anh ở cột trái trước');return}const leftId=selectedSoloEnglish;selectedSoloEnglish=null;await submitSoloAnswer({leftId,rightId:button.dataset.soloPairRight});return}
 if(button.id==='gameSizeToggle'){gameExpanded=!gameExpanded;renderGame();return}
  if(button.id==='startRoundButton'){await startRound();return}
 if(button.id==='refreshRoom'){loadRoom();return}
 if(button.id==='leaveRoom'){leaveRoom();return}
  if(button.dataset.selectBomb){return}
  if(button.id==='roomCardRetry'){await submitRoomCard();return}
 if(button.dataset.roomCard){chooseRoomCard(button.dataset.roomCard);return}
 if(button.dataset.pairLeft){if(game?.game.status!=='PLAYING')return;selectedEnglish=button.dataset.pairLeft;renderGame();return}
 if(button.dataset.pairRight){if(game?.game.status!=='PLAYING')return;if(!selectedEnglish){toast('Chọn từ tiếng Anh ở cột trái trước');return}const leftId=selectedEnglish;selectedEnglish=null;await submitGameAnswer({leftId,rightId:button.dataset.pairRight});return}
 if(button.dataset.adminTab){adminTab=button.dataset.adminTab;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('on',b.dataset.adminTab===adminTab));document.querySelectorAll('.admin-panel').forEach(p=>p.classList.toggle('active',p.id==='adminPanel'+adminTab.charAt(0).toUpperCase()+adminTab.slice(1)));return}
 if(button.dataset.addRound){
  const mode=button.dataset.addRound;
  if(mode==='CAR'&&!carFeatureEnabled)return toast('CAR chưa được bật.',true);
  if(mode==='MATRIX'&&!matrixFeatureEnabled)return toast('MATRIX chưa được bật.',true);
  if(mode==='MEMORY'&&!memoryFeatureEnabled)return toast('MEMORY chưa được bật.',true);
  collectRounds();if(draftRounds.length>=12)return toast('Tối đa 12 vòng',true);
  const cards=['MATRIX','MEMORY'].includes(mode);
  draftRounds.push({mode,difficulty:'NORMAL',duration_seconds:cards?cardRoundDefaultDuration(mode,18):90,
   question_count:cards?18:8,points_per_correct:100,penalty:25,weight:1,
   topic_id:mode==='CAR'||cards?null:topics[0]?.id||null,
   bomb_fall_seconds:16,bomb_batch_size:2,bomb_spawn_interval_seconds:9,car_step_seconds:8});
  renderRounds();return
 }
 if(button.dataset.removeRound!==undefined){collectRounds();if(draftRounds.length===1)return toast('Phải còn ít nhất một vòng',true);draftRounds.splice(Number(button.dataset.removeRound),1);renderRounds();return}
 if(button.dataset.adminEventPage){adminEventPage+=button.dataset.adminEventPage==='next'?1:-1;renderAdminEventList();return}
 if(button.dataset.adminTopicPage){adminTopicPage+=button.dataset.adminTopicPage==='next'?1:-1;renderAdminTopicList();return}
 if(button.dataset.editEvent){editEvent(button.dataset.editEvent);return}
 if(button.id==='cancelEditEvent'){editingEvent=null;draftRounds=[];renderAdminEvents();return}
 if(button.dataset.eventAction){await manageAction(button.dataset.eventAction,button.dataset.eventId);return}
 if(button.id==='cefrClearFilters'){if($('cefrLevelFilter'))$('cefrLevelFilter').value='ALL';if($('cefrStatusFilter'))$('cefrStatusFilter').value='ALL';filterAdminCefr();return}
 if(button.dataset.cefrPage){cefrResultPage+=button.dataset.cefrPage==='next'?1:-1;filterAdminCefr(false);return}
 if(button.dataset.cefrOpen){openCefrEditor(button.dataset.cefrOpen);return}
 if(button.dataset.editCefr){openCefrEditor(button.dataset.editCefr);return}
 if(button.id==='cefrCancel'){const el=$('cefrEditor');if(el)el.classList.add('hidden');return}
 if(button.dataset.copyCode){await navigator.clipboard?.writeText(button.dataset.copyCode);toast('Đã sao chép mã phòng');return}
 for(const [attr,k] of [['editTopic','edit-topic'],['delTopic','del-topic'],['editWord','edit-word'],['delWord','del-word']])if(button.dataset[attr]){await manageVocabulary(k,button.dataset[attr]);return}
});
window.addEventListener('submit',async e=>{
 if(e.target.id==='authForm'){handleAuth(e);return}
 if(['soloSetupForm','soloBombSetupForm','soloCarSetupForm'].includes(e.target.id)){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));await beginSolo(soloModeForScreen(),{topic_id:f.topic_id||null,difficulty:f.difficulty,question_count:Number(f.question_count),duration_seconds:Number(f.duration_seconds)});return}
 if(e.target.id==='joinForm'){joinRoom(e);return}
 if(e.target.id==='createEventForm'){submitEventForm(e);return}
 if(e.target.id==='topicForm'){e.preventDefault();const f=new FormData(e.target);try{await api('admin/topics',{method:'POST',body:{title:f.get('title')}});toast('Đã thêm chủ đề');loadAdmin()}catch(x){toast(x.message,true)}return}
 if(e.target.id==='cefrReviewForm'){await saveCefrReview(e);return}
 if(e.target.id==='wordForm'){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api('admin/words',{method:'POST',body:f});toast('Đã thêm từ mới');loadAdmin()}catch(x){toast(x.message,true)}return}
  if(e.target.id==='soloCarAnswerForm'){e.preventDefault();await submitSoloCarAnswer();return}
  if(e.target.id==='bombAnswerForm'){e.preventDefault();queueBombCheck(0);return}
  if(e.target.id==='carAnswerForm'){e.preventDefault();queueCarAutoCheck('room',0);return}
});
window.addEventListener('input',e=>{if(e.target.id==='adminTopicSearch'){adminTopicQuery=e.target.value;adminTopicPage=1;renderAdminTopicList();return}if(e.target.id==='cefrSearchFilter')filterAdminCefr();if(e.target.id==='bombAnswer'){feedback='';const note=$('gameFeedback');if(note)note.hidden=true;queueBombCheck();}if(e.target.id==='soloBombAnswer'){soloFeedback='';const note=$('soloBombFeedback');if(note)note.hidden=true;queueSoloBombCheck();}if(e.target.id==='soloCarAnswer')queueCarAutoCheck('solo');if(e.target.id==='carAnswer')queueCarAutoCheck('room');});
// Persist expanded topic identity across pages and Admin refreshes.
window.addEventListener('toggle',e=>{
 const item=e.target?.closest?.('#adminTopicList details[data-admin-topic-id]');
 if(!item)return;
 if(item.open)adminOpenTopicIds.add(item.dataset.adminTopicId);
 else adminOpenTopicIds.delete(item.dataset.adminTopicId);
},true);
window.addEventListener('change',async e=>{
 if(['cefrLevelFilter','cefrStatusFilter'].includes(e.target.id)){filterAdminCefr();return}
 if(e.target.closest('#roundsEditor')&&e.target.dataset.k){
  const row=Number(e.target.closest('[data-round]')?.dataset.round);
  const previous=draftRounds[row]?.mode;
  const previousPairs=draftRounds[row]?.question_count;
  const previousDuration=draftRounds[row]?.duration_seconds;
  collectRounds();
  if(e.target.dataset.k==='mode'&&draftRounds[row]?.mode!==previous){
   const rd=draftRounds[row],cards=['MATRIX','MEMORY'].includes(rd.mode);
   rd.question_count=cards?18:8;
   rd.duration_seconds=cards?cardRoundDefaultDuration(rd.mode,18):90;
   if(cards)rd.topic_id=null;
  }
  if(e.target.dataset.k==='question_count'){
   const rd=draftRounds[row];
   if(['MATRIX','MEMORY'].includes(rd?.mode))
    rd.duration_seconds=cardRoundAdjustedDuration(rd.mode,previousPairs,rd.question_count,previousDuration);
  }
  if(e.target.dataset.k==='difficulty'){const r=draftRounds[Number(e.target.closest('[data-round]')?.dataset.round)];if(r?.mode==='BOMB'){const p={EASY:[20,2,10],NORMAL:[16,2,9],HARD:[10,3,6]}[r.difficulty];if(p)[r.bomb_fall_seconds,r.bomb_batch_size,r.bomb_spawn_interval_seconds]=p;}}renderRounds();return;}
 if(e.target.dataset.feature){try{const f=e.target.dataset.feature;await api('admin/features/'+f,{method:'PATCH',body:{enabled:e.target.checked}});toast('Đã cập nhật tính năng '+f);loadAdmin()}catch(x){toast(x.message,true);e.target.checked=!e.target.checked}}
});
window.addEventListener('keydown',e=>{
 const routeCard=e.target.closest?.('[data-screen][tabindex]');if(routeCard&&['Enter',' '].includes(e.key)){e.preventDefault();navigate(routeCard.dataset.screen);return}
 // CAR Solo and multiplayer always keep the typing field as the keyboard target.
 if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
 const soloTarget=screen==='solo-car'?'soloCarAnswer':screen==='solo-bomb'?'soloBombAnswer':null;
 const roomTarget=game?.game.mode==='CAR'?'carAnswer':game?.game.mode==='BOMB'?'bombAnswer':null;
 const target=soloTarget&&soloGame?.game.status==='PLAYING'?soloTarget:screen==='rooms'&&game?.game.status==='PLAYING'?roomTarget:null;
 const field=target?$(target):null;
 if(!field||field.disabled||e.isComposing||e.key==='Tab'||e.target.closest?.('button,a,[role="button"]'))return;
 if(e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
  e.preventDefault();field.focus({preventScroll:true});
  field.setRangeText(e.key,field.selectionStart,field.selectionEnd,'end');
  field.dispatchEvent(new Event('input',{bubbles:true}));
 }else if(e.key==='Backspace')field.focus({preventScroll:true});
});
// Keep same-page navigation in sync with browser Back / Forward.
function restoreArenaRoute(){
 const hash=location.hash.slice(1);
 navigate(['home','solo','solo-bomb','solo-car','rooms','attendance','rank','admin'].includes(hash)?hash:'home',{fromHistory:true});
}
window.addEventListener('popstate',restoreArenaRoute);
window.addEventListener('hashchange',restoreArenaRoute);
let polling=false;setInterval(async()=>{
 if(polling)return;polling=true;updateCountdowns();try{if(screen==='rooms'&&roomCode){
  if(game?.game.status==='PLAYING'){await refreshGame()}
  else{await loadRoom()}
 }else if(['solo','solo-bomb','solo-car'].includes(screen)&&soloGame?.game.status==='PLAYING'){await refreshSoloGame()}}finally{polling=false}
},1200);
setInterval(updateCountdowns,500);
(async function init(){
   // Delegated click handler above owns screen navigation; do not bind a duplicate handler.
  setupPasswordToggles(document);
  await refreshSession();
 await loadTopics(true);
 const saved=sessionStore.getItem('wordsky_room_code');if(saved&&/^[A-Z0-9]{5,12}$/.test(saved)){roomCode=saved;}
 // Restore Arena route without rewriting browser history.
 const hash=location.hash.slice(1);if(['home','solo','solo-bomb','solo-car','attendance','rank','rooms','admin'].includes(hash))navigate(hash,{fromHistory:true});
})();
