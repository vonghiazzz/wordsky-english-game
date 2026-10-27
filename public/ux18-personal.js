import {learningApi,postUnifiedAccountReview} from './ux10-account-core.js';
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
async function scopedUnifiedReview(wordId,remembered){
 const current=await getActor();
 if(!current||current.id!==actor?.id)
  throw Error('Tài khoản đã thay đổi; không gửi lượt ôn sang tài khoản khác.');
 return postUnifiedAccountReview('personal',wordId,remembered,actor.id);
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
   entry(word,'✓ Đã nhớ',()=>act(()=>scopedUnifiedReview(word.id,true))),
   entry(word,'↻ Cần ôn',()=>act(()=>scopedUnifiedReview(word.id,false))),
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
 el('personalImportButton').textContent='Đồng bộ toàn bộ '+plan.entries.length+' thao tác an toàn';
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
 const all=plan.entries;
 const total=all.length;
 if(!window.confirm('Đồng bộ TẤT CẢ '+total+' thao tác đủ điều kiện chỉ với một lần xác nhận? '+
   'WordSky sẽ tự chia thành các lô nhỏ, so khớp lại trên PostgreSQL và bỏ qua từ trùng hoặc tiến độ đã có. '+
   'KHÔNG xóa/sửa bộ từ trên thiết bị.'))return;
 const expectedActor=actor.id,deviceSignature=JSON.stringify(snapshot.words);
 let completed=0,created=0,reviewed=0,skipped=0,error='';
 const progress=el('personalImportProgress'),status=el('personalImportLive');
 busy=true;render();
 progress.hidden=false;progress.max=total;progress.value=0;
 status.hidden=false;status.textContent='Đang kiểm tra dữ liệu trước khi chuyển…';
 try{
  const same=await getActor();
  if(!same||same.id!==expectedActor)throw Error('Tài khoản đã thay đổi.');
  const fresh=await learningApi('learning/me/summary');
  if(fresh.scope!=='unified-account'||fresh.actor_id!==expectedActor)
   throw Error('Không xác minh được dữ liệu tài khoản mới nhất.');
  const current=readBrowserPersonal(localStorage);
  if(current.error||JSON.stringify(current.words)!==deviceSignature)
   throw Error('Bộ từ thiết bị vừa thay đổi; vui lòng xem lại trước khi chuyển.');
  const latest=planThreeWayLegacyImport(current,fresh);
  if(latest.error)throw Error(latest.error);
  const signature=entries=>JSON.stringify(entries.map(x=>[x.type,x.id||null,x.word]));
  if(signature(latest.entries)!==signature(all))
   throw Error('Kho từ tài khoản vừa thay đổi; vui lòng kiểm tra lại trước khi chuyển.');
  // 20 cards per transaction/API call, but a single confirmation for the full import.
  for(let offset=0;offset<total;offset+=20){
   if(JSON.stringify(readBrowserPersonal(localStorage).words)!==deviceSignature)
    throw Error('Bộ từ trên thiết bị đã thay đổi trong khi đồng bộ.');
   const group=all.slice(offset,offset+20);
   const result=await scopedRequest('learning/import/legacy/batch',{
    method:'POST',
    body:{cards:group.map(entry=>({
      card:{topic:entry.word.topic,english:entry.word.english,
        ipa:entry.word.ipa,meaning:entry.word.meaning,
        example:entry.word.example,translation:entry.word.translation},
      known:entry.word.known
    }))}
   });
   if(result.scope!=='legacy-import-batch'||result.processed!==group.length||
      !result.counts||Object.values(result.counts).some(n=>!Number.isInteger(n)||n<0))
    throw Error('Máy chủ chưa xác nhận lô chuyển dữ liệu.');
   completed+=result.processed;
   created+=result.counts.created;
   reviewed+=result.counts.reviewed;
   skipped+=result.counts.alreadyReviewed+result.counts.alreadyPresent+
      result.counts.conflict+result.counts.ambiguous;
   progress.value=completed;
   status.textContent='Đã xử lý '+completed+' / '+total+
     ' thao tác. Có thể tiếp tục học khi hoàn tất.';
  }
 }catch(e){error=e.message||'Không thể đồng bộ dữ liệu';}
 finally{
  busy=false;
  // Any completed chunk is already committed; retry after failure is safe.
  await load();
  status.textContent=error
    ?'Đã xác nhận '+completed+'/'+total+' thao tác. Có thể bấm đồng bộ lại sau khi kiểm tra lỗi.'
    :'Đã xử lý '+completed+'/'+total+' thao tác đủ điều kiện.';
  message('Đã xử lý '+completed+'/'+total+' thao tác: '+
   created+' từ cá nhân mới, '+reviewed+' lượt ghi nhớ mới, '+
   skipped+' thao tác bỏ qua an toàn.'+
   (error?' Dừng do lỗi: '+error+'. Các lô đã xác nhận sẽ không bị nhập trùng khi thử lại.':'')+
   ' Bộ Flashcard trên thiết bị vẫn được giữ nguyên.',!!error);
 }
});
window.addEventListener('focus',()=>{if(!busy)load()});
load();
