/* UX40: player password change. No password storage, telemetry or HTML injection. */
const byId=id=>document.getElementById(id);
const form=byId('ws40Form');
const guest=byId('ws40Guest');
const done=byId('ws40Done');
const submit=byId('ws40Submit');
const revokeForm=byId('ws41Form');
const revokeSubmit=byId('ws41Submit');
let actorId=null;
let pending=false;
let authCheckSeq=0;
let lastAuthCheckAt=0;
const securityActionComplete=()=>!done.hidden||!byId('ws41Done').hidden;

function status(message,kind='info'){
 const label=byId('ws40Status');
 label.textContent=message;
 label.dataset.kind=kind;
}
function clearPasswords(){
 for(const id of ['ws40Current','ws40New','ws40Confirm','ws41Current'])byId(id).value='';
 byId('ws41Confirm').checked=false;
}
function revokeStatus(message,kind='info'){
 const label=byId('ws41Status');
 label.textContent=message;
 label.dataset.kind=kind;
}
function showGuest(message){
 actorId=null;
 clearPasswords();
 byId('ws40Username').value='';
 revokeStatus('');
 form.hidden=true;
 done.hidden=true;
 revokeForm.hidden=true;
 byId('ws41Done').hidden=true;
 byId('ws41Card').hidden=true;
 guest.hidden=false;
 byId('ws40Identity').textContent='Chưa có phiên người chơi hợp lệ';
 status(message||'Vui lòng đăng nhập để tiếp tục.');
}
async function api(path,options={}){
 const response=await fetch('/api/'+path,{
  credentials:'same-origin',cache:'no-store',
  ...options
 });
 let json;
 try{json=await response.json()}catch{throw Error('Không đọc được phản hồi từ máy chủ.')}
 if(!response.ok)throw Object.assign(Error(json.error||'Yêu cầu thất bại.'),{status:response.status});
 return json;
}
async function refresh(){
 if(pending||securityActionComplete())return;
 // Ignore older auth responses if tabs, focus or password actions overlap.
 const check=++authCheckSeq;
 try{
  const data=await api('auth/me');
  if(check!==authCheckSeq||pending)return;
  if(data.actor?.role!=='player'||typeof data.actor.id!=='string'){
   showGuest('Phiên đăng nhập không còn hiệu lực. Hãy đăng nhập lại.');
   return;
  }
  if(actorId&&actorId!==data.actor.id){
   clearPasswords();
   status('Tài khoản đã thay đổi. Vui lòng nhập lại mật khẩu.');
   revokeStatus('');
  }
  actorId=data.actor.id;
  const username=String(data.actor.profile?.username||'');
  byId('ws40Username').value=username;
  byId('ws40Identity').textContent='Tài khoản: '+username;
  guest.hidden=true;
  done.hidden=true;
  form.hidden=false;
  byId('ws41Card').hidden=false;
  byId('ws41Done').hidden=true;
  revokeForm.hidden=false;
 }catch{
  if(check!==authCheckSeq||pending)return;
  // No account-specific form is shown without a verified signed session.
  showGuest('Không thể xác minh phiên đăng nhập. Hãy thử đăng nhập lại.');
 }
}

for(const toggle of document.querySelectorAll('[data-ws40-show]')){
 toggle.addEventListener('click',()=>{
  const input=byId(toggle.dataset.ws40Show);
  if(!input)return;
  const visible=input.type==='password';
  input.type=visible?'text':'password';
  toggle.textContent=visible?'Ẩn':'Hiện';
  toggle.setAttribute('aria-pressed',String(visible));
  input.focus({preventScroll:true});
 });
}

form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(pending||!actorId)return;
 const current=byId('ws40Current').value;
 const next=byId('ws40New').value;
 const confirm=byId('ws40Confirm').value;
 const username=byId('ws40Username').value;
 if(next!==confirm){status('Hai mật khẩu mới chưa trùng khớp.','error');return;}
 if(next.length<12||next.length>128||!/[a-z]/i.test(next)||!/[0-9]/.test(next)||
    (username&&next.toLowerCase().includes(username.toLowerCase()))){
  status('Mật khẩu mới cần 12–128 ký tự, có chữ và số và không chứa tên đăng nhập.','error');
  return;
 }
 pending=true;
 ++authCheckSeq;
 submit.disabled=true;
 revokeSubmit.disabled=true;
 status('Đang xác minh và cập nhật mật khẩu…');
 try{
  const result=await api('auth/change-password',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({
    expected_actor_id:actorId,
    current_password:current,
    new_password:next,
    confirm_password:confirm
   })
  });
  if(result.ok!==true||result.sessions_revoked!==true||result.reauth_required!==true)
   throw Error('Máy chủ trả về trạng thái không nhất quán. Hãy kiểm tra đăng nhập.');
  actorId=null;
  form.reset();
  form.hidden=true;
  done.hidden=false;
  byId('ws41Card').hidden=true;
  status('Mật khẩu đã được cập nhật.','success');
 }catch(error){
  if(error.status===401){
   showGuest('Phiên đăng nhập không còn hiệu lực. Hãy đăng nhập lại.');
  }else if(error.status===409){
   showGuest('Tài khoản đã thay đổi. Hãy đăng nhập lại đúng tài khoản.');
  }else if(!error.status){
   // The server may have committed even if the response was lost.
   status('Không nhận được xác nhận. Không gửi lại ngay; hãy thử đăng nhập bằng mật khẩu mới để kiểm tra.','error');
  }else status(error.message,'error');
 }finally{
  clearPasswords();
  pending=false;
  submit.disabled=false;
  revokeSubmit.disabled=false;
 }
});

revokeForm.addEventListener('submit',async event=>{
 event.preventDefault();
 if(pending||!actorId)return;
 if(!byId('ws41Confirm').checked){
  revokeStatus('Vui lòng xác nhận bạn muốn đăng xuất khỏi tất cả thiết bị.','error');
  return;
 }
 const current=byId('ws41Current').value;
 pending=true;
 ++authCheckSeq;
 submit.disabled=true;
 revokeSubmit.disabled=true;
 revokeStatus('Đang xác minh mật khẩu và thu hồi phiên đăng nhập…');
 try{
  const result=await api('auth/revoke-sessions',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({
    expected_actor_id:actorId,
    current_password:current,
    confirm_revoke_all:true
   })
  });
  if(result.ok!==true||result.sessions_revoked!==true||
     result.reauth_required!==true||result.password_unchanged!==true)
   throw Error('Máy chủ trả về trạng thái không nhất quán. Hãy kiểm tra đăng nhập.');
  actorId=null;
  revokeForm.reset();
  form.hidden=true;
  revokeForm.hidden=true;
  done.hidden=true;
  byId('ws41Done').hidden=false;
  byId('ws40Identity').textContent='Tất cả phiên đăng nhập đã được thu hồi';
  revokeStatus('Thu hồi thành công. Mật khẩu không thay đổi.','success');
 }catch(error){
  if(error.status===401){
   showGuest('Phiên đăng nhập không còn hiệu lực. Hãy đăng nhập lại.');
  }else if(error.status===409){
   showGuest('Tài khoản đã thay đổi. Hãy đăng nhập lại đúng tài khoản.');
  }else if(!error.status){
   revokeStatus('Chưa nhận được xác nhận. Hãy kiểm tra trạng thái đăng nhập trước khi gửi lại.','error');
  }else revokeStatus(error.message,'error');
 }finally{
  clearPasswords();
  pending=false;
  submit.disabled=false;
  revokeSubmit.disabled=false;
 }
});

byId('ws40Logout').addEventListener('click',async()=>{
 if(pending)return;
 ++authCheckSeq;
 try{
  await api('auth/logout',{
   method:'POST',headers:{'content-type':'application/json'},body:'{}'
  });
  actorId=null;
  clearPasswords();
  location.assign('/#home');
 }catch{status('Không đăng xuất được. Vui lòng thử lại.','error')}
});
function recheckVisibleSession(force=false){
 // A real window focus may fire before visibilityState flips to visible.
 if(pending||securityActionComplete()||(!force&&document.visibilityState==='hidden'))return;
 const now=Date.now();
 // When logged out, check immediately after a re-login in another tab.
 if(!force&&actorId!==null&&now-lastAuthCheckAt<750)return;
 lastAuthCheckAt=now;
 void refresh(); // Read-only GET; no polling and no session writes.
}
window.addEventListener('focus',()=>recheckVisibleSession(true));
document.addEventListener('visibilitychange',()=>recheckVisibleSession());
window.addEventListener('pagehide',()=>{
 ++authCheckSeq;
 clearPasswords();
});
window.addEventListener('pageshow',event=>{
 if(event.persisted){
  clearPasswords();
  recheckVisibleSession(true);
 }
});
refresh();
