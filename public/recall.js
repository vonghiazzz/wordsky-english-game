/* UX43C: isolated account-only typed recall. No raw answer persistence. */
const $=id=>document.getElementById(id);
const state={
 actor:null,trial:null,pending:false,requestId:null,unconfirmedAnswer:null,
 seq:0,consented:false
};
const status=(message,error=false)=>{
 $('ws43cStatus').textContent=message;
 $('ws43cStatus').dataset.error=String(error);
};
const show=(id,visible)=>{$(id).hidden=!visible};
const clearEntry=()=>{
 $('ws43cAnswer').value='';
 $('ws43cAnswer').readOnly=false;
 state.unconfirmedAnswer=null;
 state.requestId=null;
};
const clearTrial=()=>{
 state.trial=null;clearEntry();
 $('ws43cAnswerForm').reset();
 show('ws43cAnswerForm',false);
 show('ws43cResult',false);
 show('ws43cNext',true);
 $('ws43cNext').disabled=false;
 $('ws43cPrompt').textContent='Nhấn “Bắt đầu” để nhận câu hỏi.';
 $('ws43cExpires').textContent='';
};
const resetForAuth=()=>{
 state.actor=null;state.consented=false;state.seq++;
 clearTrial();
 show('ws43cOptIn',false);
 show('ws43cExercise',false);
 show('ws43cPrivacy',false);
 show('ws43cGuest',true);
 $('ws43cIdentity').textContent='Chưa có phiên học viên hợp lệ';
};

async function request(path,options={}){
 const result=await fetch('/api/'+path,{
  credentials:'same-origin',cache:'no-store',...options
 });
 let data;
 try{data=await result.json();}catch{throw Error('Máy chủ trả về dữ liệu không hợp lệ.');}
 if(!result.ok){
  const error=Error(data.error||'Không thực hiện được yêu cầu.');
  error.status=result.status;
  throw error;
 }
 return data;
}
const post=(path,body,method='POST')=>request(path,{
 method,headers:{'content-type':'application/json'},body:JSON.stringify(body)
});
async function verifiedActor(){
 const data=await request('auth/me');
 if(data.actor?.role!=='player'||typeof data.actor.id!=='string')
  throw Object.assign(Error('Vui lòng đăng nhập tài khoản người chơi.'),{status:401});
 if(state.actor&&state.actor!==data.actor.id)
  throw Object.assign(Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.'),{status:409});
 return data.actor.id;
}
function displayOptIn(){
 state.consented=false;clearTrial();
 show('ws43cGuest',false);
 show('ws43cOptIn',true);
 show('ws43cExercise',false);
 show('ws43cPrivacy',false);
 $('ws43cConsentCheck').checked=false;
 $('ws43cAgree').disabled=true;
}
function displayActive(available){
 state.consented=true;
 show('ws43cGuest',false);
 show('ws43cOptIn',false);
 show('ws43cExercise',true);
 show('ws43cPrivacy',true);
 if(!state.trial){
  clearTrial();
  $('ws43cNext').disabled=!available;
 }
 if(!available)status('Chưa có câu hỏi tiếng Việt được duyệt. Không có dữ liệu để kiểm tra.',true);
}
async function refresh(){
 if(state.pending)return;
 const seq=++state.seq;
 try{
  const actor=await request('auth/me');
  if(seq!==state.seq)return;
  if(actor.actor?.role!=='player'||!actor.actor.id){
   resetForAuth();status('Hãy đăng nhập học viên để tiếp tục.',true);
   return;
  }
  if(state.actor&&state.actor!==actor.actor.id){
   clearTrial();
   state.consented=false;
   status('Tài khoản đã thay đổi. Đang xác minh phiên mới.',true);
  }
  state.actor=actor.actor.id;
  $('ws43cIdentity').textContent='Tài khoản: '+String(actor.actor.profile?.username||'đã đăng nhập');
  const availability=await request('learning/recall/status');
  if(seq!==state.seq)return;
  if(!availability.pilot||availability.schedule_unchanged!==true)
   throw Error('Chế độ kiểm tra thử nghiệm chưa sẵn sàng.');
  if(availability.consent_active)displayActive(availability.curated_prompts>0);
  else{displayOptIn();status('Bạn có thể đồng ý tham gia hoặc rời trang.');}
 }catch(error){
  if(seq!==state.seq)return;
  if(error.status===401||error.status===409){resetForAuth();status(error.message,true);}
  else if(error.status===404){
   resetForAuth();status('Tính năng đang thử nghiệm nội bộ, chưa bật tại môi trường này.',true);
  }else{resetForAuth();status('Không kiểm tra được phiên: '+error.message,true);}
 }
}
function busy(value){
 state.pending=value;
 for(const id of ['ws43cAgree','ws43cWithdraw','ws43cNext','ws43cSubmit'])
  $(id).disabled=value;
 if(!value){
  $('ws43cAgree').disabled=!$('ws43cConsentCheck').checked;
  $('ws43cWithdraw').disabled=!$('ws43cWithdrawCheck').checked;
 }
}
$('ws43cConsentCheck').addEventListener('change',()=>{
 $('ws43cAgree').disabled=state.pending||!$('ws43cConsentCheck').checked;
});
$('ws43cWithdrawCheck').addEventListener('change',()=>{
 $('ws43cWithdraw').disabled=state.pending||!$('ws43cWithdrawCheck').checked;
});
$('ws43cAgree').addEventListener('click',async()=>{
 if(state.pending||!state.actor||!$('ws43cConsentCheck').checked)return;
 busy(true);
 try{
  const actor=await verifiedActor();
  const answer=await post('learning/recall/consent',{
   expected_actor_id:actor,agree:true,consent_version:'ux43b-opt-in-v1'
  });
  if(answer.consent_active!==true)throw Error('Máy chủ chưa ghi nhận đồng ý.');
  clearTrial();await refresh();
  status('Đã ghi nhận lựa chọn. Bạn có thể kiểm tra nhớ từ.');
 }catch(error){status(error.message,true);if(error.status===401||error.status===409)resetForAuth();}
 finally{busy(false);}
});
$('ws43cNext').addEventListener('click',async()=>{
 if(state.pending||!state.actor||!state.consented)return;
 busy(true);clearTrial();
 try{
  const actor=await verifiedActor();
  const payload=await post('learning/recall/trials',{expected_actor_id:actor});
  if(payload.schedule_unchanged!==true||typeof payload.trial?.trial_id!=='string'||
      typeof payload.trial.prompt_vi!=='string'||payload.trial.prompt_kind!=='vi-to-en-typed')
   throw Error('Máy chủ trả về câu hỏi không hợp lệ.');
  state.trial=payload.trial;
  $('ws43cPrompt').textContent=payload.trial.prompt_vi;
  $('ws43cExpires').textContent='Hoàn thành trước: '+
   new Date(payload.trial.expires_at).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
  show('ws43cAnswerForm',true);show('ws43cNext',false);
  $('ws43cAnswer').focus();
  status('Gõ đáp án tiếng Anh, không có gợi ý.');
 }catch(error){
  status(error.message,true);
  if(error.status===401)resetForAuth();
 }
 finally{busy(false);if(state.trial)$('ws43cNext').hidden=true;}
});
$('ws43cAnswerForm').addEventListener('submit',async(event)=>{
 event.preventDefault();
 if(state.pending||!state.trial||!state.actor)return;
 // An uncertain network response retries the SAME challenge and request ID;
 // no auto-retry or raw answer saved to browser storage.
 if(!state.requestId){
  state.unconfirmedAnswer=$('ws43cAnswer').value;
  if(!state.unconfirmedAnswer.trim()){status('Vui lòng nhập câu trả lời.',true);return;}
  state.requestId=crypto.randomUUID();
 }
 busy(true);
 try{
  const actor=await verifiedActor();
  const result=await post('learning/recall/submit',{
   expected_actor_id:actor,trial_id:state.trial.trial_id,
   request_id:state.requestId,response:state.unconfirmedAnswer
  });
  if(result.schedule_unchanged!==true||result.trial_id!==state.trial.trial_id||
     typeof result.correct!=='boolean')
   throw Error('Máy chủ trả về kết quả không hợp lệ.');
  clearEntry();
  $('ws43cAnswerForm').reset();
  show('ws43cAnswerForm',false);
  $('ws43cResult').textContent=result.correct?
   '✓ Đúng rồi! Đây là kết quả một lần kiểm tra, chưa thay đổi SRS.':
   '↻ Chưa chính xác. Kết quả này không tự đánh dấu từ là chưa nhớ.';
  $('ws43cResult').dataset.correct=String(result.correct);
  show('ws43cResult',true);
  show('ws43cNext',true);
  status(result.replayed?'Đã xác nhận lại kết quả đã lưu.':'Kết quả đã được ghi riêng cho thử nghiệm.');
 }catch(error){
  if(error.status===401||error.status===409){
   clearEntry();clearTrial();status(error.message,true);
   if(error.status===401)resetForAuth();
  }else if(!error.status){
   $('ws43cAnswer').readOnly=true;
   status('Chưa nhận được phản hồi. Bấm lại để xác minh chính yêu cầu trước, không nhập đáp án mới.',true);
  }else{clearEntry();status(error.message,true);}
 }finally{
  busy(false);
  if(state.trial&&!$('ws43cAnswerForm').hidden)
   $('ws43cSubmit').disabled=false;
 }
});
$('ws43cWithdraw').addEventListener('click',async()=>{
 if(state.pending||!state.actor||!$('ws43cWithdrawCheck').checked)return;
 busy(true);
 try{
  const actor=await verifiedActor();
  const result=await post('learning/recall/consent',{
   expected_actor_id:actor,confirm_withdraw:true
  },'DELETE');
  if(result.deleted_account_recall_data!==true)throw Error('Máy chủ chưa xác nhận xóa dữ liệu.');
  clearTrial();displayOptIn();status('Đã rút lại đồng ý và xóa toàn bộ dữ liệu thử nghiệm.',false);
 }catch(error){status(error.message,true);if(error.status===401)resetForAuth();}
 finally{busy(false);$('ws43cWithdrawCheck').checked=false;}
});
window.addEventListener('pagehide',()=>{
 $('ws43cAnswer').value='';state.unconfirmedAnswer=null;state.requestId=null;
});
window.addEventListener('focus',()=>{if(!state.pending)void refresh();});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&!state.pending)void refresh();
});
void refresh();
