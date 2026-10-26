import {learningApi} from './ux10-account-core.js';
import {readBrowserPersonal,planBrowserPersonalImport} from './ux18-personal-core.js';

const el=id=>document.getElementById(id);
const ids=['topic','english','meaning','ipa','example','translation'];
let actor=null,account={words:[],progress:[]},snapshot={words:[],learned:{},error:null};
let editing=null,busy=false,initialized=false;
const cardValues=()=>Object.fromEntries(ids.map(id=>[id,el('personal'+id.charAt(0).toUpperCase()+id.slice(1)).value.trim()]));
function message(text,isError=false){el('personalMessage').textContent=text;el('personalMessage').dataset.error=String(isError)}
async function getActor(){
 const result=await learningApi('auth/me');
 return result.actor?.role==='player'&&result.actor?.id?result.actor:null;
}
async function scopedRequest(path,options){
 const now=await getActor();
 if(!now||now.id!==actor?.id)throw Error('Tài khoản đã thay đổi; dừng thao tác để bảo vệ dữ liệu.');
 return learningApi(path,{...options,body:options?.body===undefined?undefined:{...options.body,expected_actor_id:actor.id}});
}
async function load(){
 try{
  actor=await getActor();
  if(!actor){
   initialized=false;account={words:[],progress:[]};
   message('Đăng nhập tài khoản học viên trên trang chủ để xem và đồng bộ từ cá nhân.',true);
   render();
   return;
  }
  const loaded=await learningApi('learning/personal');
  if(loaded.scope!=='personal-account'||!Array.isArray(loaded.words)||!Array.isArray(loaded.progress))
    throw Error('Dữ liệu thẻ cá nhân từ máy chủ không hợp lệ.');
  account=loaded;initialized=true;
  message('Đã kết nối PostgreSQL cho tài khoản hiện tại. Thẻ cá nhân được lưu theo tài khoản.');
 }catch(e){initialized=false;account={words:[],progress:[]};message('Chưa tải được từ cá nhân theo tài khoản: '+e.message+'. Dữ liệu trên thiết bị không bị thay đổi.',true)}
 render();
}
function resetForm(){
 editing=null;el('personalForm').reset();el('personalId').value='';
 el('personalSave').textContent='+ Thêm từ';el('personalCancel').hidden=true;
}
async function act(operation){
 if(busy||!initialized)return;
 busy=true;render();
 try{
  await operation();
  await load();
 }catch(e){message('Không thể lưu: '+e.message+'. Kiểm tra tài khoản và tải lại trước khi thử tiếp.',true)}
 finally{busy=false;render()}
}
function entry(word,label,onClick,style=''){
 const b=document.createElement('button');b.type='button';b.textContent=label;
 if(style)b.className=style;b.disabled=busy;b.addEventListener('click',onClick);return b;
}
function renderList(){
 const root=el('personalList');root.replaceChildren();
 const term=el('personalSearch').value.toLocaleLowerCase('vi').trim();
 const filtered=account.words.filter(w=>[w.topic,w.english,w.meaning].some(v=>v.toLocaleLowerCase('vi').includes(term)));
 el('personalListMeta').textContent=filtered.length+' / '+account.words.length+' từ';
 const known=new Map(account.progress.map(r=>[r.personal_word_id,r.remembered]));
 if(!filtered.length){const p=document.createElement('p');p.textContent='Chưa có từ phù hợp. Thêm từ mới hoặc chuyển bộ Flashcard cũ ở bên dưới.';root.append(p)}
 for(const word of filtered.slice(0,200)){
  const row=document.createElement('div');row.className='word-row';
  const details=document.createElement('div');
  const title=document.createElement('strong');title.textContent=word.english+' · '+word.meaning;
  const caption=document.createElement('small');caption.textContent=word.topic+' · '+(known.get(word.id)===true?'Đã nhớ':known.has(word.id)?'Cần ôn':'Chưa học');
  details.append(title,caption);
  const controls=document.createElement('div');controls.className='word-controls';
  controls.append(
   entry(word,'✓ Đã nhớ',()=>act(()=>scopedRequest('learning/personal/reviews',{method:'POST',body:{personal_word_id:word.id,remembered:true}}))),
   entry(word,'↻ Cần ôn',()=>act(()=>scopedRequest('learning/personal/reviews',{method:'POST',body:{personal_word_id:word.id,remembered:false}}))),
   entry(word,'Sửa',()=>{
    editing=word;
    for(const id of ids)el('personal'+id.charAt(0).toUpperCase()+id.slice(1)).value=word[id]||'';
    el('personalId').value=word.id;el('personalSave').textContent='✓ Lưu thay đổi';el('personalCancel').hidden=false;
    el('personalForm').scrollIntoView({behavior:'smooth',block:'start'});
   }),
   entry(word,'Xóa',async()=>{
    if(!window.confirm('Ẩn thẻ '+word.english+' khỏi tài khoản? Các bản ghi ôn tập không bị tự động xóa.'))return;
    await act(()=>scopedRequest('learning/personal/'+encodeURIComponent(word.id),{method:'DELETE',body:{revision:word.revision}}));
   },'danger')
  );
  row.append(details,controls);root.append(row);
 }
 if(filtered.length>200){const p=document.createElement('p');p.textContent='Đang hiển thị 200 thẻ đầu tiên; hãy tìm kiếm để xem các thẻ còn lại.';root.append(p)}
}
function render(){
 snapshot=readBrowserPersonal(localStorage);
 const plan=planBrowserPersonalImport(snapshot,account.words,account.progress);
 const ready=initialized&&!!actor;
 el('personalAccount').hidden=!ready;el('personalImport').hidden=!ready;
 el('personalTotal').textContent=ready?String(account.words.length):'—';
 el('personalKnown').textContent=ready?String(account.progress.filter(p=>p.remembered===true&&account.words.some(w=>w.id===p.personal_word_id)).length):'—';
 el('personalLocal').textContent=snapshot.error?'Lỗi':String(snapshot.words.filter(w=>w.known).length);
 if(!ready)return;
 renderList();
 el('personalSave').disabled=busy;
 el('personalReload').disabled=busy;
 const detail=el('personalImportDetail');
 detail.textContent=plan.error?plan.error:
  'Thiết bị có '+snapshot.words.length+' thẻ; '+plan.entries.length+
  ' thao tác cần chuyển, '+plan.existing+' thẻ đã tồn tại và khớp nội dung, '+
  plan.conflicts+' trường hợp trùng từ nhưng khác nội dung bị bỏ qua.';
 el('personalImportButton').disabled=busy||!!plan.error||plan.entries.length===0;
 el('personalImportButton').textContent='Chuyển '+Math.min(20,plan.entries.length)+' thẻ / đánh dấu lên tài khoản';
}
el('personalForm').addEventListener('submit',event=>{
 event.preventDefault();
 const form=cardValues(),current=editing;
 act(async()=>{
  if(current){
   await scopedRequest('learning/personal/'+encodeURIComponent(current.id),{method:'PATCH',body:{...form,revision:current.revision}});
  }else await scopedRequest('learning/personal',{method:'POST',body:form});
  resetForm();
 });
});
el('personalCancel').addEventListener('click',resetForm);
el('personalReload').addEventListener('click',load);
el('personalSearch').addEventListener('input',()=>{if(initialized)renderList()});
el('personalImportButton').addEventListener('click',async()=>{
 if(busy||!initialized||!actor)return;
 snapshot=readBrowserPersonal(localStorage);
 const plan=planBrowserPersonalImport(snapshot,account.words,account.progress);
 if(plan.error||!plan.entries.length)return;
 const batch=plan.entries.slice(0,20);
 if(!window.confirm('Chuyển '+batch.length+' thao tác từ bộ Flashcard TRÊN THIẾT BỊ vào tài khoản? Thẻ trùng khác nội dung sẽ được bỏ qua. Không xóa dữ liệu thiết bị.'))return;
 busy=true;render();
 let done=0,fail='';
 try{
  for(const entry of batch){
   try{
    let wordId=entry.id;
    if(entry.type==='create'){
     const created=await scopedRequest('learning/personal',{method:'POST',body:{
      topic:entry.word.topic,english:entry.word.english,meaning:entry.word.meaning,
      ipa:entry.word.ipa,example:entry.word.example,translation:entry.word.translation}});
     if(typeof created.id!=='string')throw Error('Máy chủ không trả về ID thẻ mới');
     wordId=created.id;
    }
    if(entry.word.known){
     await scopedRequest('learning/personal/reviews',{method:'POST',body:{personal_word_id:wordId,remembered:true}});
    }
    done++;
   }catch(e){fail=e.message;break}
  }
 }finally{
  busy=false;
  await load();
  message('Đã chuyển '+done+' thao tác vào tài khoản.'+(fail?' Dừng vì: '+fail+'; các thao tác chưa xác nhận có thể chuyển lại.':'')+
   ' Bộ Flashcard trên thiết bị vẫn được giữ nguyên.',!!fail);
 }
});
window.addEventListener('focus',()=>{if(!busy)load()});
load();
