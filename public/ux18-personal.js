import {learningApi} from './ux10-account-core.js';
import {readBrowserPersonal} from './ux18-personal-core.js';
import {planThreeWayLegacyImport} from './ux21-legacy-reconciliation.js';

const el=id=>document.getElementById(id);
const ids=['topic','english','meaning','ipa','example','translation'];
let actor=null,account={words:[],progress:[]},unifiedSnapshot=null,snapshot={words:[],learned:{},error:null};
let loadTicket=0;
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
 const ticket=++loadTicket;
 try{
  const current=await getActor();
  if(ticket!==loadTicket)return;
  if(!current){
   actor=null;initialized=false;account={words:[],progress:[]};unifiedSnapshot=null;
   message('Đăng nhập tài khoản học viên trên trang chủ để quản lý từ cá nhân.',true);
   render();return;
  }
  const [loaded,summary]=await Promise.all([
   learningApi('learning/personal'),learningApi('learning/me/summary')
  ]);
  const verified=await getActor();
  if(ticket!==loadTicket)return;
  if(!verified||verified.id!==current.id)
   throw Error('Phiên tài khoản đã thay đổi trong lúc tải dữ liệu.');
  if(loaded.scope!=='personal-account'||!Array.isArray(loaded.words)||
     !Array.isArray(loaded.progress)||summary.scope!=='unified-account'||
     summary.actor_id!==current.id||!Array.isArray(summary.words))
   throw Error('Dữ liệu từ vựng theo tài khoản không hợp lệ.');
  actor=current;account=loaded;unifiedSnapshot=summary;initialized=true;
  message('Đã đồng bộ kho từ chung và từ cá nhân theo tài khoản PostgreSQL.');
 }catch(e){
  if(ticket!==loadTicket)return;
  actor=null;initialized=false;account={words:[],progress:[]};unifiedSnapshot=null;
  message('Không tải được dữ liệu theo tài khoản: '+e.message+
    '. Không chuyển hoặc ghi đè dữ liệu thiết bị.',true);
 }
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
 const plan=planThreeWayLegacyImport(snapshot,unifiedSnapshot);
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
 const c=plan.counts;
 detail.textContent=plan.error?plan.error:
  'Thiết bị có '+snapshot.words.length+' thẻ. Khớp từ chung: '+c.shared+
  '; khớp từ cá nhân: '+c.personal+
  '; từ mới thực sự: '+c.newCards+
  '; đánh dấu nhớ có thể chuyển: '+c.reviewable+
  '; đã có quyết định học: '+c.alreadyReviewed+
  '; trùng khác nội dung: '+c.conflicts+
  '; trùng không rõ nguồn: '+c.ambiguous+
  '; thẻ sai định dạng: '+c.invalid+
  '. '+plan.entries.length+' thao tác đủ điều kiện. Các trường hợp xung đột không tự ghi.';
 el('personalImportButton').disabled=busy||!!plan.error||plan.entries.length===0;
 el('personalImportButton').textContent='Chuyển tối đa '+Math.min(20,plan.entries.length)+' thao tác an toàn';
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
 if(busy||!initialized||!actor||!unifiedSnapshot)return;
 snapshot=readBrowserPersonal(localStorage);
 const plan=planThreeWayLegacyImport(snapshot,unifiedSnapshot);
 if(plan.error||!plan.entries.length)return;
 const batch=plan.entries.slice(0,20);
 if(!window.confirm('Chuyển '+batch.length+
    ' thao tác đã đối chiếu với KHO TỪ CHUNG và TỪ CÁ NHÂN lên tài khoản? '+
    'Không ghi đè quyết định học đã có, không xóa dữ liệu thiết bị.'))return;
 busy=true;render();
 let completed=0,created=0,reviewed=0,skipped=0,fail='';
 try{
  const same=await getActor();
  if(!same||same.id!==actor.id)throw Error('Tài khoản đã thay đổi.');
  const fresh=await learningApi('learning/me/summary');
  if(fresh.scope!=='unified-account'||fresh.actor_id!==actor.id)
   throw Error('Không xác minh được dữ liệu tài khoản mới nhất.');
  const current=readBrowserPersonal(localStorage);
  const latest=planThreeWayLegacyImport(current,fresh);
  if(latest.error)throw Error(latest.error);
  const signature=entries=>JSON.stringify(entries.map(x=>[x.type,x.id||null,x.word]));
  if(signature(latest.entries.slice(0,20))!==signature(batch))
   throw Error('Kho từ hoặc dữ liệu thiết bị vừa thay đổi; tải lại và xác nhận lần nữa.');
  for(const entry of batch){
   try{
    const saved=await scopedRequest('learning/import/legacy',{
     method:'POST',body:{card:{
      topic:entry.word.topic,english:entry.word.english,ipa:entry.word.ipa,
      meaning:entry.word.meaning,example:entry.word.example,
      translation:entry.word.translation
     },known:entry.word.known}
    });
    if(saved.scope!=='legacy-import'||!['created','reviewed',
       'already-reviewed','already-present','conflict','ambiguous'].includes(saved.status))
     throw Error('Máy chủ chưa xác nhận thao tác chuyển từ.');
    if(saved.status==='created')created++;
    if(saved.reviewed===true)reviewed++;
    if(['conflict','ambiguous','already-reviewed','already-present'].includes(saved.status))skipped++;
    completed++;
   }catch(e){fail=e.message;break;}
  }
 }catch(e){fail=e.message}
 finally{
  busy=false;await load();
  message('Đã đối chiếu '+completed+'/'+batch.length+' thao tác: '+
    created+' từ mới, '+reviewed+' lượt ghi nhớ mới, '+skipped+
    ' thao tác bỏ qua an toàn.'+(fail?' Dừng: '+fail:'')+
    ' Bộ từ cũ trên thiết bị không bị thay đổi.',!!fail);
 }
});
window.addEventListener('focus',()=>{if(!busy)load()});
load();
