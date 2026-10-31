/* UX43E1 Admin workbench: only draft creation/deletion, no approval controls. */
const $=id=>document.getElementById(id);
let wordPage=0,draftPage=0,wordTotal=0,draftTotal=0,wordSeq=0,draftSeq=0;
let selectedWord=null,selectedDraft=null,requestBusy=false;
const PAGE_SIZE=20;
const label=(type,value)=>{const el=document.createElement(type);el.textContent=String(value??'');return el};
const status=(id,message,error=false)=>{$(id).textContent=message;$(id).dataset.error=String(error)};
const scrubPasswords=()=>{$('rcPassword').value='';$('rcDeletePassword').value=''};
function showSelected(word){
 selectedWord={id:word.id,english:word.english,meaning:word.meaning};
 $('rcSelectedWordId').value=word.id;
 $('rcSelected').textContent='Đã chọn: '+word.english+' — '+word.meaning;
 $('rcSave').disabled=requestBusy?true:false;
}
async function api(path,options={}){
 const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...options});
 const json=await response.json().catch(()=>({}));
 if(!response.ok){
  const error=new Error(json.error||'Yêu cầu không thực hiện được ('+response.status+')');
  error.status=response.status;
  throw error;
 }
 return json;
}
const mutation=(method,path,body)=>api(path,{
 method,headers:{'content-type':'application/json'},body:JSON.stringify(body)
});
function pageControls(kind,current,total){
 const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
 $(kind+'Page').textContent=(current+1)+' / '+pages;
 $(kind+'Prev').disabled=current===0;
 $(kind+'Next').disabled=(current+1)*PAGE_SIZE>=total;
}
async function listWords(){
 const ticket=++wordSeq;
 const params=new URLSearchParams({q:$('rcWordSearch').value.trim(),page:String(wordPage),size:String(PAGE_SIZE)});
 status('rcWordStatus','Đang tải từ…');
 try{
  const data=await api('admin/recall/words?'+params);
  if(ticket!==wordSeq)return;
  if(!Array.isArray(data.words)||!Number.isSafeInteger(data.total))
   throw Error('Dữ liệu danh mục không hợp lệ');
  wordTotal=data.total;const host=$('rcWords');host.replaceChildren();
  for(const word of data.words){
   const card=label('article','');card.className='au-user';
   const info=label('div','');
   info.append(label('strong',word.english),label('small',word.meaning+' · '+word.topic));
   const choose=label('button','Chọn từ');choose.type='button';
   choose.addEventListener('click',()=>{
    showSelected(word);
    $('rcAnswers').value=word.english;
    $('rcPrompt').value='';
    $('rcRevision').value='';
    $('rcPrompt').focus();
    status('rcSaveStatus','Điền nghĩa tiếng Việt và các đáp án được kiểm tra thủ công.');
   });
   card.append(info,choose);host.append(card);
  }
  if(!data.words.length)host.append(label('p','Chưa tìm thấy từ phù hợp.'));
  status('rcWordStatus',data.total+' từ đang hoạt động');
  pageControls('rcWord',wordPage,wordTotal);
 }catch(error){
  if(ticket!==wordSeq)return;
  $('rcWords').replaceChildren();
  status('rcWordStatus','Không tải được kho từ: '+error.message,true);
 }
}
async function listDrafts(){
 const ticket=++draftSeq;
 const params=new URLSearchParams({q:$('rcDraftSearch').value.trim(),page:String(draftPage),size:String(PAGE_SIZE)});
 status('rcDraftStatus','Đang tải bản nháp…');
 try{
  const data=await api('admin/recall/drafts?'+params);
  if(ticket!==draftSeq)return;
  if(!Array.isArray(data.drafts)||!Number.isSafeInteger(data.total)||
    data.approval_available!==false)throw Error('Danh sách duyệt không hợp lệ');
  draftTotal=data.total;const host=$('rcDrafts');host.replaceChildren();
  for(const draft of data.drafts){
   const card=label('article','');card.className='rc-draft';
   const title=label('strong',draft.english+' · '+draft.answer_revision);
   const state=label('small',draft.approved||draft.active?
    'Đã có trạng thái kiểm duyệt · chỉ đọc tại đây':'Bản nháp · chưa duyệt, chưa kích hoạt');
   const prompt=label('p',draft.prompt_vi);
   const answers=label('small','Đáp án đề xuất: '+draft.accepted_english.join(' | '));
   const actions=label('div','');actions.className='rc-draft-actions';
   const duplicate=label('button','Soạn phiên bản mới');duplicate.type='button';
   duplicate.addEventListener('click',()=>{
    showSelected({id:draft.word_id,english:draft.english,meaning:draft.meaning});
    $('rcPrompt').value=draft.prompt_vi;
    $('rcAnswers').value=draft.accepted_english.join('\n');
    $('rcRevision').value='';
    $('rcPrompt').focus();
    $('rcDraftForm').scrollIntoView({block:'start'});
    status('rcSaveStatus','Mỗi thay đổi đáp án phải có mã phiên bản mới.');
   });
   actions.append(duplicate);
   if(draft.approved===false&&draft.active===false){
    const remove=label('button','Xóa bản nháp');remove.type='button';
    remove.className='rc-remove';
    remove.addEventListener('click',()=>showDelete(draft));
    actions.append(remove);
   }
   card.append(title,state,prompt,answers,actions);host.append(card);
  }
  if(!data.drafts.length)host.append(label('p','Chưa có bản nháp nào.'));
  status('rcDraftStatus',data.total+' phiên bản · không có thao tác phê duyệt');
  pageControls('rcDraft',draftPage,draftTotal);
 }catch(error){
  if(ticket!==draftSeq)return;
  $('rcDrafts').replaceChildren();
  status('rcDraftStatus','Không tải được bản nháp: '+error.message,true);
 }
}
function showDelete(draft){
 if(requestBusy||draft.approved||draft.active)return;
 selectedDraft={id:draft.id,revision:draft.answer_revision};
 $('rcDeleteForm').reset();
 $('rcDeleteSelected').textContent='Bản nháp: '+draft.english+' / '+draft.answer_revision;
 status('rcDeleteStatus','Thao tác này không phê duyệt hoặc thay đổi dữ liệu học.');
 $('rcDeleteDialog').showModal();
 $('rcConfirmRevision').focus();
}
function busy(value){
 requestBusy=value;
 $('rcSave').disabled=value||!selectedWord;
 $('rcConfirmDelete').disabled=value;
 $('rcCancelDelete').disabled=value;
}
$('rcFindWord').addEventListener('submit',event=>{event.preventDefault();wordPage=0;void listWords()});
$('rcFindDraft').addEventListener('submit',event=>{event.preventDefault();draftPage=0;void listDrafts()});
$('rcWordPrev').addEventListener('click',()=>{if(wordPage>0){wordPage--;void listWords()}});
$('rcWordNext').addEventListener('click',()=>{if((wordPage+1)*PAGE_SIZE<wordTotal){wordPage++;void listWords()}});
$('rcDraftPrev').addEventListener('click',()=>{if(draftPage>0){draftPage--;void listDrafts()}});
$('rcDraftNext').addEventListener('click',()=>{if((draftPage+1)*PAGE_SIZE<draftTotal){draftPage++;void listDrafts()}});
$('rcDraftForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(requestBusy||!selectedWord)return;
 const answers=$('rcAnswers').value.split(/\r?\n/g).map(x=>x.trim()).filter(Boolean);
 const password=$('rcPassword').value;
 if(answers.length<1||answers.length>8){
  status('rcSaveStatus','Cần từ 1 đến 8 đáp án (mỗi dòng một đáp án).',true);return;
 }
 busy(true);
 try{
  const data=await mutation('POST','admin/recall/drafts',{
   word_id:selectedWord.id,prompt_vi:$('rcPrompt').value,
   accepted_english:answers,answer_revision:$('rcRevision').value,
   admin_password:password
  });
  if(data.draft?.approved!==false||data.draft?.active!==false||
    data.approval_available!==false)throw Error('Máy chủ không xác nhận bản nháp bị khóa');
  $('rcDraftForm').reset();
  selectedWord=null;
  $('rcSelectedWordId').value='';
  $('rcSelected').textContent='Chưa chọn từ.';
  status('rcSaveStatus','Đã lưu bản nháp. Chưa phê duyệt, chưa kích hoạt.');
  draftPage=0;await listDrafts();
 }catch(error){status('rcSaveStatus','Chưa lưu: '+error.message,true)}
 finally{scrubPasswords();busy(false);}
});
$('rcCancelDelete').addEventListener('click',()=>$('rcDeleteDialog').close());
$('rcDeleteDialog').addEventListener('close',()=>{
 selectedDraft=null;$('rcDeleteForm').reset();scrubPasswords();
 status('rcDeleteStatus','');
});
$('rcDeleteForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(requestBusy||!selectedDraft)return;
 busy(true);
 try{
  const data=await mutation('DELETE','admin/recall/drafts/'+encodeURIComponent(selectedDraft.id),{
   confirm_revision:$('rcConfirmRevision').value,
   admin_password:$('rcDeletePassword').value
  });
  if(!data.deleted_draft)throw Error('Máy chủ chưa xác nhận đã xóa.');
  $('rcDeleteDialog').close();
  status('rcDraftStatus','Đã xóa bản nháp chưa duyệt.');
  await listDrafts();
 }catch(error){status('rcDeleteStatus','Không xóa: '+error.message,true)}
 finally{scrubPasswords();busy(false);}
});
(async()=>{
 try{
  const auth=await api('auth/me');
  if(auth.actor?.role!=='admin'){
   status('rcAuth','Đăng nhập bằng tài khoản Admin WordSky trước khi mở trang này.',true);
   return;
  }
  const check=await api('admin/recall/words?page=0&size=1');
  if(!Array.isArray(check.words))throw Error('Bàn kiểm duyệt chưa sẵn sàng');
  $('rcAuth').hidden=true;
  $('rcApp').hidden=false;
  await Promise.all([listWords(),listDrafts()]);
 }catch(error){
  status('rcAuth',error.status===404?
   'Chức năng chỉ mở trên môi trường QA/Preview cô lập đã được bật và có migration.':
   'Không thể mở bàn kiểm duyệt: '+error.message,true);
 }
})();
