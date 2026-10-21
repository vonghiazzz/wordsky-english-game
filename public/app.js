'use strict';
const $=id=>document.getElementById(id);
const sessionStore={getItem(k){try{return sessionStorage.getItem(k)}catch{return null}},setItem(k,v){try{sessionStorage.setItem(k,v)}catch{}},removeItem(k){try{sessionStorage.removeItem(k)}catch{}}};
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n??0).toLocaleString('vi-VN');
const MODE_LABEL={MATCH:'🔗 Nối từ',BOMB:'💣 Giải bom',CAR:'🏎️ Đua xe 5 làn'};
const MODE_SHORT={MATCH:'Matching',BOMB:'Bomb Defuser',CAR:'Lane Escape'};
const rankThresholds=[{xp:0,label:'🥉 Đồng'},{xp:200,label:'🥈 Bạc'},{xp:600,label:'🥇 Vàng'},{xp:1400,label:'💎 Bạch kim'},{xp:3000,label:'👑 Kim cương'}];
let session=null,topics=[],adminEvents=[],editingEvent=null,roomCode='',room=null,game=null,localTimeOffset=0,selectedEnglish=null,selectedLane=2,selectedBombId=null,feedback='',adminTab='events',loginMode='login',timer=null,screen='home';
let gameBusy=false,joinBusy=false,gameRevision=0;
function toast(message,error=false){const el=$('toast');el.textContent=message;el.className='toast'+(error?' error':'');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),3800)}
async function api(path,{method='GET',body}={}){
 let resp;
 try{resp=await fetch('/api/'+path,{method,credentials:'same-origin',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});}catch{throw Error('Không kết nối được máy chủ WordSky.')}let json;
 try{json=await resp.json()}catch{throw Error('Máy chủ chưa cấu hình API hoặc kết nối bị lỗi.')}
 if(!resp.ok)throw Error(json.error||'Có lỗi máy chủ');return json;
}
const $screen=n=>$('screen-'+n);
function navigate(name){if(!['home','rooms','attendance','rank','admin'].includes(name))return;screen=name;
 document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('active',e.id==='screen-'+name));
 document.querySelectorAll('[data-screen]').forEach(e=>e.classList.toggle('active',e.dataset.screen===name));
 window.scrollTo({top:0,behavior:'smooth'});
 if(name==='attendance')loadAttendance();if(name==='rank')loadRank();if(name==='admin')loadAdmin();if(name==='rooms'&&roomCode)loadRoom();
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
async function loadTopics(silent=false){try{const data=await api('topics');topics=data.topics||[];return topics}catch(e){if(!silent)toast(e.message,true);return[]}}
function fmtDate(s){return s?new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}):'—'}
function secLeft(t){return Math.max(0,Math.ceil((new Date(t).getTime()-(Date.now()+localTimeOffset))/1000))}
function formatCountdown(sec){return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
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
async function loadRoom(){if(!roomCode)return;try{const data=await api('rooms/'+encodeURIComponent(roomCode));const previous=room;room=data;localTimeOffset=data.serverNow-Date.now();$('joinRoomPane').classList.add('hidden');$('roomPane').classList.remove('hidden');if(previous&&previous.event.status===data.event.status&&previous.event.started_at===data.event.started_at&&!game&&$('eventBoard')){$('eventBoard').innerHTML=boardHtml(data.board,'event');}else renderRoom();}catch(e){if(e.message.includes('chưa tham gia')||e.message.includes('đăng nhập')){roomCode='';sessionStore.removeItem('wordsky_room_code');$('roomPane').classList.add('hidden');$('joinRoomPane').classList.remove('hidden')}else toast(e.message,true)}}
function renderRoom(){if(!room)return;const e=room.event,active=currentRoundFromEvent(e),live=e.status==='LIVE',ended=e.status==='FINISHED'||e.status==='CANCELLED'||(live&&!active&&Date.now()+localTimeOffset>=new Date(e.rounds.at(-1).ends_at).getTime());
 const statusLabel={DRAFT:'Đang chuẩn bị',OPEN:'Đang nhận người',LIVE:'Đang thi',FINISHED:'Đã kết thúc',CANCELLED:'Đã hủy'}[e.status];
 let head=`<div class="room-card"><div class="room-title"><div><span class="mini">PHÒNG #${escapeHtml(e.join_code)}</span><h2>${escapeHtml(e.title)}</h2></div><span class="pill ${live?'good':ended?'red':'yellow'}">${statusLabel}</span></div><p class="small-note">${fmt(e.participant_count)} / ${fmt(e.max_players)} người · ${e.rounds.length} vòng · ${room.me?`Bạn: ${escapeHtml(room.me.name)}`:'Admin'}</p><div class="round-list">${e.rounds.map(r=>`<div class="round-tile ${active?.id===r.id?'active':''}"><div class="number">ROUND ${r.position}</div><strong>${MODE_LABEL[r.mode]}</strong><small>${fmt(r.duration_seconds)} giây · ${escapeHtml(r.difficulty)} · x${r.weight} điểm</small>${r.starts_at?`<div class="small-note" style="margin-top:7px">${fmtDate(r.starts_at)}</div>`:''}</div>`).join('')}</div>`;
 if(e.status==='OPEN')head+=`<p class="game-status">⏳ Đang đợi quản trị viên bắt đầu. Có thể chia sẻ mã <strong>${escapeHtml(e.join_code)}</strong> và mật khẩu cho bạn bè.</p>`;
 else if(live&&active)head+=`<p class="game-status">⚡ Đang mở ${MODE_LABEL[active.mode]}. Còn <b id="roundCountdown">${formatCountdown(secLeft(active.ends_at))}</b>.</p><button class="btn primary" id="startRoundButton" ${game?.runId&&game.round?.id===active.id?'disabled':''}>${game?.runId&&game.round?.id===active.id?'Vòng đang diễn ra bên dưới':'Bắt đầu / Tiếp tục vòng '+active.position} →</button>`;
 else if(live&&!ended)head+=`<p class="game-status">Vòng tiếp theo chưa bắt đầu, bảng xếp hạng sẽ tự cập nhật.</p>`;
 else if(ended)head+=`<p class="game-status good">🏆 Cuộc thi đã đến thời điểm kết thúc. Xem bảng điểm tổng bên dưới.</p>`;
 head+='</div>';
 $('roomPane').innerHTML=head+'<div id="liveGame"></div><div class="dashboard-row" style="margin:24px 0 11px"><h2>🏆 Bảng điểm toàn giải</h2><button class="btn" id="refreshRoom">Làm mới ↻</button></div><div class="board" id="eventBoard">'+boardHtml(room.board,'event')+'</div><button class="btn ghost" id="leaveRoom">Rời giao diện phòng</button>';
 if(game&&active?.id===game.round?.id)renderGame();
}
async function startRound(){
 if(!room||!roomCode||gameBusy)return;
 const active=currentRoundFromEvent(room.event);if(!active){toast('Chưa đến giờ vòng thi',true);return}
 gameBusy=true;gameRevision++;const button=$('startRoundButton');if(button){button.disabled=true;button.textContent='⏳ Đang vào vòng thi...'}
 try{
  game=await api(`rooms/${roomCode}/rounds/${active.id}/start`,{method:'POST',body:{}});
  selectedEnglish=null;selectedLane=2;selectedBombId=null;feedback='';renderRoom();
  document.querySelector('#liveGame')?.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){toast(e.message,true);if(button){button.disabled=false;button.textContent='Thử vào vòng thi →'}}
 finally{gameBusy=false}
}
async function refreshGame(){if(!game||!roomCode)return;
 const revision=gameRevision;try{const before=game.game;const answer=await api(`rooms/${roomCode}/runs/${game.runId}`);if(!game||gameBusy||revision!==gameRevision)return;game.game=answer.game;
  const fingerprint=g=>JSON.stringify([g.mode,g.status,g.score,g.health,g.correct,g.mistakes,g.index,g.bombs?.map(b=>b.id)]);
  if(fingerprint(before)!==fingerprint(game.game))renderGame();else animateBombs();
  if(game.game.status!=='PLAYING'){setTimeout(()=>loadRoom(),1100)}}catch(e){if(screen==='rooms')toast(e.message,true)}
}
async function submitGameAnswer(payload){
 if(!game||gameBusy)return;gameBusy=true;gameRevision++;
 const runId=game.runId;
 try{
  const answer=await api(`rooms/${roomCode}/runs/${runId}/answer`,{method:'POST',body:payload});
  if(game?.runId!==runId)return;
  game.game=answer.game;
  if(game.game.mode==='CAR'){
   if(answer.result?.wordCorrect===false){feedback='Sai từ tiếng Anh, chưa vượt chặng. Hãy thử lại!'}
   else if(answer.result?.laneSafe===false){feedback='Đúng từ nhưng đâm vào vật cản! Mất 1 tim.'}
   else feedback='✅ Chính xác! Qua làn an toàn, +'+fmt(answer.result.awarded)+' điểm.';
  }else{
   feedback=answer.result?.correct?'Đúng rồi! +'+fmt(answer.result.awarded)+' điểm.':'Chưa chính xác — cố gắng nhé!';
  }
  if(game.game.mode==='BOMB'&&answer.result?.correct){selectedBombId=null;const input=$('bombAnswer');if(input)input.value='';}
  if(game.game.mode==='CAR'&&answer.result?.wordCorrect){const input=$('carAnswer');if(input)input.value='';}
  renderGame();if(answer.game.status!=='PLAYING')setTimeout(()=>loadRoom(),700);
 }catch(e){feedback=e.message;renderGame()}
 finally{gameBusy=false}
}
function compactKeyboard(target){
 const rows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
 return `<div class="game-keyboard" aria-label="Bàn phím tiếng Anh trong game" data-keyboard-target="${target}">
 ${rows.map(row=>`<div class="game-keyboard-row">${[...row].map(c=>`<button type="button" data-game-key="${c}" data-keyboard-target="${target}">${c}</button>`).join('')}</div>`).join('')}
 <div class="game-keyboard-row"><button type="button" class="game-keyboard-wide" data-game-key="SPACE" data-keyboard-target="${target}">SPACE</button><button type="button" data-game-key="DEL" data-keyboard-target="${target}">DEL</button><button type="button" class="game-keyboard-enter" data-game-key="ENTER" data-keyboard-target="${target}">ENTER</button></div></div>`;
}
function renderGame(){
 const host=$('liveGame');if(!host||!game)return;
 const existingBombAnswer=host.querySelector('#bombAnswer')?.value||'';
 const existingCarAnswer=host.querySelector('#carAnswer')?.value||'';
 const oldFocus=document.activeElement?.id;
 const g=game.game,rd=game.round;
 const names={MATCH:'Nối từ cùng nghĩa',BOMB:'Gỡ bom từ vựng',CAR:'Dịch từ và lách xe 5 làn'};
 let h=`<div class="game-shell"><div class="game-bar"><strong>${MODE_LABEL[g.mode]} — ${names[g.mode]}</strong><span class="counter">${fmt(g.score)} ĐIỂM</span><span>❤️ ${g.health}/3</span><span>⏱ <span id="gameCountdown">${formatCountdown(secLeft(g.endsAt))}</span></span></div>`;
 if(g.status!=='PLAYING')h+=`<div class="game-status good">${g.status==='COMPLETED'?'🎉 Hoàn thành vòng thi!':g.status==='FAILED'?'💔 Đã mất 3 tim!':'⌛ Hết thời gian'} · ${fmt(g.score)} điểm · ${g.correct} lượt đúng</div>`;
 else if(g.mode==='MATCH'){
  const right=g.rightOptions||[];
  h+=`<p class="small-note">Chọn một từ tiếng Anh bên trái, sau đó chọn nghĩa tiếng Việt bên phải. Chọn sai trừ ${rd.penalty} điểm.</p><div class="pair-grid"><div class="pair-col">${g.pairs.map(p=>`<button data-pair-left="${p.id}" class="pairbtn ${p.matched?'matched':''} ${selectedEnglish===p.id?'selected':''}" ${p.matched?'disabled':''}>${escapeHtml(p.english)}</button>`).join('')}</div><div class="pair-col">${right.map(p=>`<button data-pair-right="${p.id}" class="pairbtn ${p.matched?'matched':''}" ${p.matched?'disabled':''}>${escapeHtml(p.meaning)}</button>`).join('')}</div></div>`;
 }else if(g.mode==='BOMB'){
  const bombs=g.bombs||[];
  if(!bombs.some(b=>b.id===selectedBombId))selectedBombId=bombs[0]?.id||null;
  const chosen=bombs.find(b=>b.id===selectedBombId);
  h+=`<p class="small-note">Chọn một bom đang rơi, gõ từ tiếng Anh rồi Enter. Bom chạm đáy sẽ mất 1 tim.</p><div class="bomb-arena" id="bombArena" aria-label="Các quả bom từ vựng đang rơi">
    <div class="bomb-topline">💣 ${bombs.length} bom đang rơi · Còn ${g.left} bom chưa gỡ</div>
    ${bombs.map((b,i)=>`<button type="button" class="bomb-falling ${b.id===selectedBombId?'selected':''}" data-select-bomb="${escapeHtml(b.id)}" data-bomb-spawn="${Number(b.spawnAt)}" data-bomb-deadline="${Number(b.deadline)}" style="left:${16+(i%3)*34}%"><span class="bomb-emoji">💣</span><strong>${escapeHtml(b.meaning)}</strong><small>${Math.max(0,Math.ceil((b.deadline-Date.now()-localTimeOffset)/1000))}s</small></button>`).join('')}
  </div><form class="bomb-answer-form" id="bombAnswerForm" autocomplete="off"><label for="bombAnswer">${chosen?'Đang giải: '+escapeHtml(chosen.meaning):'Đợi bom xuất hiện...'}</label><input id="bombAnswer" name="answer" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Gõ tiếng Anh rồi Enter" maxlength="100" ${chosen?'required':'disabled'}><button type="submit" class="btn primary" ${chosen?'':'disabled'}>↵ Gỡ bom</button></form>${compactKeyboard('bombAnswer')}`;
 }else if(g.mode==='CAR'){
  const carWait=Math.max(0,Math.ceil((g.nextAllowedAt-Date.now()-localTimeOffset)/1000));
  h+=`<div class="car-clue"><span>📝 DỊCH SANG TIẾNG ANH ĐỂ VƯỢT CHẶNG</span><strong>${escapeHtml(g.level?.meaning||'Đang tải câu hỏi...')}</strong><small>Trả lời đúng mới được đi qua làn đang chọn. Nhập sai không vượt chặng.</small></div>
  <div class="car-stage"><div class="game-bar"><span>CHẶNG ${g.index+1}/${g.total}</span><span>LÀN ${selectedLane+1}/5</span></div><div class="car-lanes">${[0,1,2,3,4].map(i=>`<button type="button" data-lane="${i}" class="lane ${selectedLane===i?'selected':''}"><span class="item">${g.level?.blocked.includes(i)?'🧱':g.level?.bonus===i?'⭐':g.level?.double===i?'×2':'·'}</span><span class="you">${selectedLane===i?'🏎️':'·'}</span><span>LÀN ${i+1}</span></button>`).join('')}</div></div>
  <div class="car-steering"><button class="btn" type="button" data-car-left>← Trái</button><span>Làn đang chọn: ${selectedLane+1}/5</span><button class="btn" type="button" data-car-right>Phải →</button></div>
  <form id="carAnswerForm" class="car-answer-form" autocomplete="off"><label for="carAnswer">Đáp án tiếng Anh</label><input id="carAnswer" name="answer" required maxlength="100" autocapitalize="off" autocomplete="off" spellcheck="false" enterkeyhint="go" placeholder="Ví dụ: apple"><button type="submit" class="btn primary" id="carDrive" ${carWait?'disabled':''}>↵ Trả lời và lái xe</button><span id="carReadyHint" class="small-note">${carWait?'Chờ '+carWait+'s':'Sẵn sàng'}</span></form>${compactKeyboard('carAnswer')}
  <p class="small-note">🧱 Trừ 1 tim · ⭐ +50% điểm · ×2 nhân đôi điểm. Chọn làn bằng phím ← → hoặc chạm màn hình.</p>`;
 }
 if(feedback)h+=`<div class="game-status ${feedback.startsWith('Đúng')||feedback.startsWith('✅')?'good':feedback.startsWith('Chưa')||feedback.startsWith('Sai')?'bad':''}">${escapeHtml(feedback)}</div>`;
 h+='</div>';host.innerHTML=h;
 if(g.mode==='BOMB'&&g.status==='PLAYING'){
  const el=$('bombAnswer');if(el){el.value=existingBombAnswer;if(matchMedia('(pointer:coarse) and (max-width:760px)').matches)el.readOnly=true;}
  for(const bomb of $('bombArena').querySelectorAll('.bomb-falling'))bomb.style.transition='none';
  animateBombs();requestAnimationFrame(()=>{for(const bomb of $('bombArena')?.querySelectorAll('.bomb-falling')||[])bomb.style.transition='';});
  if(oldFocus==='bombAnswer'&&el)el.focus({preventScroll:true});
 }
 if(g.mode==='CAR'&&g.status==='PLAYING'){
  const el=$('carAnswer');if(el){el.value=existingCarAnswer;if(matchMedia('(pointer:coarse) and (max-width:760px)').matches)el.readOnly=true;}
  if(oldFocus==='carAnswer'&&el)el.focus({preventScroll:true});
 }
}
function animateBombs(){
 const arena=$('bombArena');if(!arena)return;
 const now=Date.now()+localTimeOffset;
 for(const b of arena.querySelectorAll('.bomb-falling')){
  const spawn=Number(b.dataset.bombSpawn),deadline=Number(b.dataset.bombDeadline);
  const pct=Math.max(0,Math.min(1,(now-spawn)/Math.max(1,deadline-spawn)));
  const floor=Math.max(0,arena.clientHeight-b.offsetHeight-12);
  b.style.transform=`translate(-50%,${Math.round(42+pct*Math.max(0,floor-42))}px)`;
  const small=b.querySelector('small');if(small)small.textContent=Math.max(0,Math.ceil((deadline-now)/1000))+'s';
 }
}
function updateCountdowns(){if(screen!=='rooms')return;animateBombs();const c=$('roundCountdown');const gc=$('gameCountdown');if(c&&room){let rd=currentRoundFromEvent(room.event);if(rd)c.textContent=formatCountdown(secLeft(rd.ends_at))}if(gc&&game)gc.textContent=formatCountdown(secLeft(game.game.endsAt));
 if(game?.game.mode==='CAR'&&game.game.status==='PLAYING'){
  const remaining=Math.max(0,Math.ceil((game.game.nextAllowedAt-Date.now()-localTimeOffset)/1000));
  const go=$('carDrive');if(go)go.disabled=remaining>0;
  const hint=$('carReadyHint');if(hint)hint.textContent=remaining?'Chờ '+remaining+'s trước chặng tiếp theo':'Sẵn sàng';
 }
}
function leaveRoom(){roomCode='';sessionStore.removeItem('wordsky_room_code');room=null;game=null;$('roomPane').classList.add('hidden');$('joinRoomPane').classList.remove('hidden');}
// Admin
const initialRounds=()=>['MATCH','BOMB','CAR'].map((mode,i)=>({mode,difficulty:'NORMAL',duration_seconds:mode==='BOMB'?120:90,question_count:mode==='CAR'?12:8,points_per_correct:100,penalty:25,weight:1,topic_id:mode==='CAR'?null:topics[0]?.id||null}));
let draftRounds=[];
async function loadAdmin(){const pane=$('adminContent');if(session?.role!=='admin'){pane.innerHTML='<div class="empty"><h2>🔒 Khu vực quản trị</h2><p>Chỉ tài khoản quản trị được phép điều khiển các cuộc thi, chủ đề và tính năng.</p><button class="btn primary" id="adminLoginBtn">Đăng nhập quản trị →</button></div>';return}
 pane.innerHTML='<div class="loading">Đang tải quản trị…</div>';
 try{const [events,features]=await Promise.all([api('admin/events'),api('admin/features')]);adminEvents=events.events||[];
 await loadTopics();if(!draftRounds.length)draftRounds=initialRounds();
 pane.innerHTML=`<div class="panel-tabs"><button data-admin-tab="events" class="${adminTab==='events'?'on':''}">🏆 Cuộc thi</button><button data-admin-tab="vocab" class="${adminTab==='vocab'?'on':''}">📚 Từ vựng</button><button data-admin-tab="features" class="${adminTab==='features'?'on':''}">⚙️ Tính năng</button></div><div id="adminPanelEvents" class="admin-panel ${adminTab==='events'?'active':''}"></div><div id="adminPanelVocab" class="admin-panel ${adminTab==='vocab'?'active':''}"></div><div id="adminPanelFeatures" class="admin-panel ${adminTab==='features'?'active':''}"></div>`;
  renderAdminEvents();renderAdminVocab();renderAdminFeatures(features.features||[]);setupPasswordToggles(pane);
 }catch(e){pane.innerHTML=`<div class="empty">${escapeHtml(e.message)}<p class="small-note">Cần cấu hình PostgreSQL và khóa admin để mở bảng quản trị.</p></div>`}}
function optionsTopics(value){return `<option value="">-- Chọn chủ đề --</option>`+topics.map(t=>`<option value="${t.id}" ${t.id===value?'selected':''}>${escapeHtml(t.title)} (${t.words?.length||0} từ)</option>`).join('')}
function renderRounds(){const host=$('roundsEditor');if(!host)return;host.innerHTML=draftRounds.map((r,i)=>{
 const available=r.mode==='CAR'&&!r.topic_id?topics.reduce((sum,t)=>sum+(t.words?.length||0),0):(topics.find(t=>t.id===r.topic_id)?.words?.length||0);
 const extra=r.mode==='MATCH'?({EASY:0,NORMAL:2,HARD:4}[r.difficulty]||0):0;
 const cap=Math.max(0,Math.min(30,available-extra));
 return `<div class="round-line" data-round="${i}"><label>Kiểu chơi<select data-k="mode">${['MATCH','BOMB','CAR'].map(m=>`<option ${m===r.mode?'selected':''} value="${m}">${MODE_SHORT[m]}</option>`).join('')}</select></label><label>Chủ đề<select data-k="topic_id">${r.mode==='CAR'?`<option value="" ${!r.topic_id?'selected':''}>Tất cả từ đang bật</option>`+topics.map(t=>`<option value="${t.id}" ${t.id===r.topic_id?'selected':''}>${escapeHtml(t.title)} (${t.words?.length||0} từ)</option>`).join(''):optionsTopics(r.topic_id)}</select></label><label>Độ khó<select data-k="difficulty">${['EASY','NORMAL','HARD'].map(d=>`<option value="${d}" ${d===r.difficulty?'selected':''}>${d}</option>`).join('')}</select></label><label>Thời gian (s)<input type="number" data-k="duration_seconds" min="20" max="600" value="${r.duration_seconds}"></label><label>Số lượt<input type="number" data-k="question_count" min="3" max="${r.mode==='MATCH'?Math.min(20,cap):cap}" value="${r.question_count}"><small>Cho phép tối đa ${r.mode==='CAR'?30:cap} lượt${extra?' (gồm '+extra+' nghĩa nhiễu)':''}</small></label><label>Điểm đúng<input type="number" data-k="points_per_correct" min="10" max="1000" value="${r.points_per_correct}"></label><label>Hệ số<input type="number" data-k="weight" min="1" max="10" value="${r.weight}"></label><button class="btn warn" type="button" data-remove-round="${i}" aria-label="Xóa vòng ${i+1}">✕</button></div>`;}).join('')+`<p class="small-note">Mỗi câu đúng +điểm, câu sai trừ ${draftRounds[0]?.penalty||25} điểm (có thể chỉnh trong cấu hình). Tổng giải tính điểm vòng × hệ số.</p>`}
function collectRounds(){document.querySelectorAll('[data-round]').forEach(e=>{const i=Number(e.dataset.round);const r=draftRounds[i];e.querySelectorAll('[data-k]').forEach(c=>{r[c.dataset.k]=['mode','topic_id','difficulty'].includes(c.dataset.k)?c.value:Number(c.value)});if(r.mode==='CAR')r.topic_id=r.topic_id||null;
 if(r.mode!=='CAR'&&!r.topic_id)r.topic_id=topics[0]?.id||null;
 if(r.mode==='MATCH')r.question_count=Math.min(20,r.question_count);});return draftRounds}
function renderAdminEvents(){const host=$('adminPanelEvents');if(!host)return;
 host.innerHTML=`<div class="dashboard-card"><div class="dashboard-row"><h2>🛠️ ${editingEvent?'Sửa cuộc thi':'Tạo cuộc thi mới'}</h2>${editingEvent?'<button class="btn" id="cancelEditEvent">Hủy sửa</button>':''}</div><p class="small-note">Cấu hình mật khẩu phòng, số người tối đa, thời gian mỗi vòng và điểm số. Người tham gia nhìn thấy bảng điểm theo thời gian thực.</p><form id="createEventForm" class="form-grid"><label>Tên cuộc thi<input name="title" value="${escapeHtml(editingEvent?.title||'WordSky English Cup')}" required maxlength="120"></label><label>Mật khẩu tham gia<input name="password" type="password" minlength="8" placeholder="${editingEvent?'Bỏ trống để giữ mật khẩu':'Tối thiểu 8 ký tự'}" ${editingEvent?'':'required'} autocomplete="new-password"></label><label>Giới hạn số người<input name="max_players" type="number" min="2" max="500" value="${editingEvent?.max_players||30}" required></label><label>Điểm trừ khi sai<input name="penalty" type="number" min="0" max="1000" value="${draftRounds[0]?.penalty??25}"></label><div class="span2"><div class="dashboard-row"><h3>Các vòng thi (${draftRounds.length})</h3><div class="form-actions"><button type="button" class="btn" data-add-round="MATCH">+ Nối từ</button><button type="button" class="btn" data-add-round="BOMB">+ Bom</button><button type="button" class="btn" data-add-round="CAR">+ Đua xe</button></div></div><div id="roundsEditor"></div></div><button type="submit" class="btn primary span2">${editingEvent?'Lưu chỉnh sửa':'Tạo phòng thi'} →</button></form></div><div class="dashboard-card"><div class="dashboard-row"><h2>📋 Danh sách giải đấu</h2><span class="pill">${adminEvents.length} giải</span></div><div id="eventsList"></div></div>`;
  renderRounds();setupPasswordToggles(host);renderAdminEventList();
}
function renderAdminEventList(){
 const list=$('eventsList');list.innerHTML=adminEvents.length?adminEvents.map(e=>`<div class="editor-item"><div><strong>${escapeHtml(e.title)}</strong> <span class="pill ${e.status==='LIVE'?'good':e.status==='FINISHED'?'red':'yellow'}">${e.status}</span><p class="small-note" style="margin:7px 0">Mã: <b>${escapeHtml(e.join_code)}</b> · ${e.participants}/${e.max_players} người · ${e.rounds.length} vòng</p></div><div class="form-actions">${['DRAFT','OPEN'].includes(e.status)?`<button class="btn" data-edit-event="${e.id}">Sửa</button>`:''}${e.status==='DRAFT'?`<button class="btn" data-event-action="open" data-event-id="${e.id}">Mở phòng</button>`:''}${e.status==='OPEN'?`<button class="btn primary" data-event-action="start" data-event-id="${e.id}">Bắt đầu</button>`:''}${['OPEN','LIVE','DRAFT'].includes(e.status)?`<button class="btn warn" data-event-action="finish" data-event-id="${e.id}">Kết thúc</button>`:''}<button class="btn" data-copy-code="${escapeHtml(e.join_code)}">Copy mã</button></div></div>`).join(''):'<div class="empty">Chưa có cuộc thi nào. Hãy tạo một cuộc thi đầu tiên.</div>';
}
async function submitEventForm(event){event.preventDefault();collectRounds();const f=new FormData(event.target);const p=Object.fromEntries(f);const penalty=Number(p.penalty);const rounds=draftRounds.map(r=>({...r,penalty}));const payload={title:p.title,max_players:Number(p.max_players),rounds};if(p.password)payload.password=p.password;
 for(const round of rounds){
  const topic=topics.find(t=>t.id===round.topic_id);
  const available=round.mode==='CAR'&&!round.topic_id?topics.reduce((n,t)=>n+(t.words?.length||0),0):(topic?.words?.length||0);
  const needed=round.question_count+(round.mode==='MATCH'?({EASY:0,NORMAL:2,HARD:4}[round.difficulty]||0):0);
  if(available<needed){toast(`Chủ đề ${topic?.title||'chưa chọn'} cần ${needed} từ, hiện có ${available} từ.`,true);return;}
 }
 try{if(editingEvent){await api('admin/events/'+editingEvent.id,{method:'PATCH',body:payload});toast('Đã lưu cấu hình cuộc thi');editingEvent=null}else{const out=await api('admin/events',{method:'POST',body:payload});toast('Đã tạo phòng '+out.join_code+' — hãy Mở phòng để đón người chơi')}draftRounds=[];loadAdmin()}
 catch(e){toast(e.message,true)}
}
function renderAdminVocab(){const host=$('adminPanelVocab');if(!host)return;
 host.innerHTML=`<div class="twocol" style="margin:0 0 16px"><div class="dashboard-card"><h2>Thêm chủ đề</h2><form id="topicForm" class="form-stack"><label>Tên chủ đề<input name="title" placeholder="VD: Sports - Thể thao" maxlength="80" required></label><button type="submit" class="btn primary">+ Thêm chủ đề</button></form></div><div class="dashboard-card"><h2>Thêm thẻ từ</h2><form id="wordForm" class="form-stack"><label>Chủ đề<select name="topic_id" required>${optionsTopics(topics[0]?.id)}</select></label><label>English<input name="english" maxlength="80" required placeholder="apple"></label><label>Nghĩa tiếng Việt<input name="meaning" maxlength="180" required placeholder="Quả táo"></label><label>Phiên âm<input name="ipa" placeholder="/ˈæpəl/"></label><label>Ví dụ<input name="example" placeholder="I eat an apple."></label><label>Dịch ví dụ<input name="translation" placeholder="Tôi ăn một quả táo."></label><button type="submit" class="btn primary">+ Thêm thẻ từ</button></form></div></div><div class="dashboard-card"><h2>Danh sách chủ đề & từ</h2>${topics.map(t=>`<details class="room-card"><summary class="dashboard-row"><strong>${escapeHtml(t.title)} (${t.words.length})</strong><span><button class="btn" data-edit-topic="${t.id}">Sửa tên</button> <button class="btn warn" data-del-topic="${t.id}">Ẩn chủ đề</button></span></summary><div style="margin-top:15px">${t.words.map(w=>`<div class="editor-item"><div><strong>${escapeHtml(w.english)}</strong> <small>${escapeHtml(w.meaning)}</small></div><span class="form-actions"><button class="btn" data-edit-word="${w.id}">Sửa</button><button class="btn warn" data-del-word="${w.id}">Ẩn</button></span></div>`).join('')}</div></details>`).join('')}</div>`}
function renderAdminFeatures(data){const labels={ATTENDANCE:'📅 Điểm chuyên cần',SIGNUP:'👥 Đăng ký học viên',MATCH:'🔗 Game nối từ',BOMB:'💣 Game giải bom',CAR:'🏎️ Game xe 5 làn'};$('adminPanelFeatures').innerHTML=`<div class="dashboard-card"><h2>Quản lý tính năng hệ thống</h2><p class="small-note">Bật / tắt chức năng ngay trên backend. Trận đang diễn ra có thể bị gián đoạn khi tắt chế độ thi đấu, hãy thay đổi ngoài giờ thi.</p>${data.map(x=>`<div class="editor-item"><strong>${labels[x.feature_key]||x.feature_key}</strong><label style="flex-direction:row;align-items:center"><input type="checkbox" data-feature="${x.feature_key}" ${x.enabled?'checked':''}> ${x.enabled?'Đang bật':'Đang tắt'}</label></div>`).join('')}</div>`}
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
// Delegated user interactions
window.addEventListener('click',async event=>{
 const button=event.target.closest('button,[data-screen],[data-close]');if(!button)return;
 if(button.dataset.screen){navigate(button.dataset.screen);return}
 if(button.dataset.close==='auth'){closeAuth();return}
 if(button.id==='accountButton'){if(session){if(confirm('Bạn muốn đăng xuất?'))await logout()}else openAuth();return}
 if(button.id==='loginTab'){setLoginMode('login');return}
 if(button.id==='signupTab'){setLoginMode('signup');return}
 if(button.id==='attendanceLogin'||button.id==='adminLoginBtn'){setLoginMode('login');openAuth();return}
 if(button.id==='checkinBtn'){try{const r=await api('attendance/checkin',{method:'POST',body:{}});toast(r.already?'Hôm nay bạn đã điểm danh rồi!':`Điểm danh thành công! +${r.earned} XP`);loadAttendance()}catch(e){toast(e.message,true)}return}
 if(button.id==='startRoundButton'){await startRound();return}
 if(button.id==='refreshRoom'){loadRoom();return}
 if(button.id==='leaveRoom'){leaveRoom();return}
  if(button.dataset.gameKey!==undefined){
   const input=$(button.dataset.keyboardTarget);if(!input||input.disabled||gameBusy)return;
   const key=button.dataset.gameKey;
   if(key==='ENTER'){if(button.dataset.keyboardTarget==='carAnswer'&&$('carDrive')?.disabled){toast('Chờ chặng tiếp theo sẵn sàng');return}input.closest('form')?.requestSubmit();return}
   if(key==='DEL')input.value=input.value.slice(0,-1);
   else if(key==='SPACE')input.value+=' ';
   else if(input.value.length<input.maxLength)input.value+=key.toLowerCase();
   input.dispatchEvent(new Event('input',{bubbles:true}));return;
  }
  if(button.dataset.selectBomb){selectedBombId=button.dataset.selectBomb;renderGame();return}
  if(button.dataset.pairLeft){if(game?.game.status!=='PLAYING')return;selectedEnglish=button.dataset.pairLeft;renderGame();return}
 if(button.dataset.pairRight){if(game?.game.status!=='PLAYING')return;if(!selectedEnglish){toast('Chọn từ tiếng Anh ở cột trái trước');return}const leftId=selectedEnglish;selectedEnglish=null;await submitGameAnswer({leftId,rightId:button.dataset.pairRight});return}
 if(button.dataset.lane!==undefined){selectedLane=Number(button.dataset.lane);renderGame();return}
 if(button.hasAttribute('data-car-left')){selectedLane=Math.max(0,selectedLane-1);renderGame();return}
 if(button.hasAttribute('data-car-right')){selectedLane=Math.min(4,selectedLane+1);renderGame();return}
  if(button.hasAttribute('data-car-go')){const value=$('carAnswer')?.value||'';if(value)await submitGameAnswer({lane:selectedLane,answer:value});return}
 if(button.dataset.adminTab){adminTab=button.dataset.adminTab;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('on',b.dataset.adminTab===adminTab));document.querySelectorAll('.admin-panel').forEach(p=>p.classList.toggle('active',p.id==='adminPanel'+adminTab.charAt(0).toUpperCase()+adminTab.slice(1)));return}
 if(button.dataset.addRound){collectRounds();if(draftRounds.length>=12)return toast('Tối đa 12 vòng',true);draftRounds.push({mode:button.dataset.addRound,difficulty:'NORMAL',duration_seconds:90,question_count:8,points_per_correct:100,penalty:25,weight:1,topic_id:button.dataset.addRound==='CAR'?null:topics[0]?.id||null});renderRounds();return}
 if(button.dataset.removeRound!==undefined){collectRounds();if(draftRounds.length===1)return toast('Phải còn ít nhất một vòng',true);draftRounds.splice(Number(button.dataset.removeRound),1);renderRounds();return}
 if(button.dataset.editEvent){editEvent(button.dataset.editEvent);return}
 if(button.id==='cancelEditEvent'){editingEvent=null;draftRounds=[];renderAdminEvents();return}
 if(button.dataset.eventAction){await manageAction(button.dataset.eventAction,button.dataset.eventId);return}
 if(button.dataset.copyCode){await navigator.clipboard?.writeText(button.dataset.copyCode);toast('Đã sao chép mã phòng');return}
 for(const [attr,k] of [['editTopic','edit-topic'],['delTopic','del-topic'],['editWord','edit-word'],['delWord','del-word']])if(button.dataset[attr]){await manageVocabulary(k,button.dataset[attr]);return}
});
window.addEventListener('submit',async e=>{
 if(e.target.id==='authForm'){handleAuth(e);return}
 if(e.target.id==='joinForm'){joinRoom(e);return}
 if(e.target.id==='createEventForm'){submitEventForm(e);return}
 if(e.target.id==='topicForm'){e.preventDefault();const f=new FormData(e.target);try{await api('admin/topics',{method:'POST',body:{title:f.get('title')}});toast('Đã thêm chủ đề');loadAdmin()}catch(x){toast(x.message,true)}return}
 if(e.target.id==='wordForm'){e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await api('admin/words',{method:'POST',body:f});toast('Đã thêm từ mới');loadAdmin()}catch(x){toast(x.message,true)}return}
  if(e.target.id==='bombAnswerForm'){e.preventDefault();const ans=e.target.elements.answer.value;if(!ans||!selectedBombId)return;await submitGameAnswer({bombId:selectedBombId,answer:ans});return}
  if(e.target.id==='carAnswerForm'){e.preventDefault();const ans=e.target.elements.answer.value;if(!ans)return;await submitGameAnswer({lane:selectedLane,answer:ans});return}
});
window.addEventListener('change',async e=>{
 if(e.target.closest('#roundsEditor')&&e.target.dataset.k){collectRounds();renderRounds();return;}
 if(e.target.dataset.feature){try{const f=e.target.dataset.feature;await api('admin/features/'+f,{method:'PATCH',body:{enabled:e.target.checked}});toast('Đã cập nhật tính năng '+f);loadAdmin()}catch(x){toast(x.message,true);e.target.checked=!e.target.checked}}
});
window.addEventListener('keydown',e=>{
 if(screen!=='rooms'||!game||game.game.status!=='PLAYING'||game.game.mode!=='CAR'||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
 if(['ArrowLeft','a','A'].includes(e.key)){e.preventDefault();selectedLane=Math.max(0,selectedLane-1);renderGame()}
 if(['ArrowRight','d','D'].includes(e.key)){e.preventDefault();selectedLane=Math.min(4,selectedLane+1);renderGame()}
  if([' ','Enter'].includes(e.key)&&!['BUTTON'].includes(e.target.tagName)){e.preventDefault();$('carAnswer')?.focus()}
});
let polling=false;setInterval(async()=>{
 if(polling)return;polling=true;updateCountdowns();try{if(screen==='rooms'&&roomCode){
  if(game?.game.status==='PLAYING'){await refreshGame()}
  else{await loadRoom()}
 }}finally{polling=false}
},1200);
setInterval(updateCountdowns,500);
(async function init(){
  document.querySelectorAll('[data-screen]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();navigate(btn.dataset.screen)}));
  setupPasswordToggles(document);
  await refreshSession();
 await loadTopics(true);
 const saved=sessionStore.getItem('wordsky_room_code');if(saved&&/^[A-Z0-9]{5,12}$/.test(saved)){roomCode=saved;}
 // SPA tabs can be addressed by hash, without losing server-issued session cookies.
 const hash=location.hash.slice(1);if(['home','attendance','rank','rooms','admin'].includes(hash))navigate(hash);
})();
