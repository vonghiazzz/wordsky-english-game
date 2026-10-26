/* UX-17: cloud personal library (WordSky session cookie, not Supabase browser keys). */
import {learningApi} from './ux10-account-core.js';
const $=id=>document.getElementById(id);
const ids=['topic','english','ipa','meaning','example','translation'];
const status=(message,error=false)=>{ $('ws17Status').textContent=message;$('ws17Status').classList.toggle('error',error); };
let userId=null,remote=[],editing=null,busy=false;
const val=(id)=>$('ws17'+id[0].toUpperCase()+id.slice(1)).value.trim();
function readLocalDeck(){
  const raw=localStorage.getItem('wordsky_vocab_v2');
  if(!raw)return {cards:[],count:0,learnedCount:0};
  const parsed=JSON.parse(raw),topics=parsed?.topics||parsed;
  if(!topics||typeof topics!=='object'||Array.isArray(topics))throw Error('Bộ từ trên thiết bị không hợp lệ');
  const learnedRaw=localStorage.getItem('wordsky_learned');
  const learned=learnedRaw?JSON.parse(learnedRaw):{};
  if(!learned||typeof learned!=='object'||Array.isArray(learned))throw Error('Tiến độ cá nhân trên thiết bị không hợp lệ');
  const cards=[],keys=new Set();
  for(const [topic,items] of Object.entries(topics)){
    if(!Array.isArray(items))throw Error('Chủ đề trong bộ từ không hợp lệ');
    for(const card of items){
      if(!Array.isArray(card)||card.length!==5||card.some(v=>typeof v!=='string'))throw Error('Một thẻ từ trên máy bị lỗi');
      const [english,ipa,meaning,example,translation]=card;
      const key=topic.toLocaleLowerCase('en')+':'+english.toLocaleLowerCase('en');
      if(keys.has(key))throw Error('Bộ từ có định danh trùng');
      keys.add(key);
      cards.push({topic,english,ipa,meaning,example,translation,remembered:learned[topic+':'+english.toLocaleLowerCase('en')]===true});
    }
  }
  if(cards.length>5000)throw Error('Bộ từ vượt giới hạn 5000');
  return {cards,count:cards.length,learnedCount:cards.filter(x=>x.remembered).length};
}
function setBusy(value){
  busy=value;
  $('ws17Import').disabled=value||!userId;
  $('ws17Refresh').disabled=value;
}
function render(){
  $('ws17Summary').textContent=remote.length+' từ thuộc tài khoản • '+remote.filter(x=>x.remembered).length+' đã nhớ';
  const root=$('ws17Cards');root.replaceChildren();
  if(!remote.length){const p=document.createElement('p');p.className='muted';p.textContent='Tài khoản chưa có thẻ riêng. Bạn có thể chuyển bộ từ trên thiết bị ở phần trên.';root.append(p);return}
  for(const card of remote){
    const article=document.createElement('article');article.className='card';
    const title=document.createElement('h3');title.textContent=card.english;
    const topic=document.createElement('p');topic.textContent=card.topic+' · '+card.meaning;
    const state=document.createElement('p');state.textContent=card.remembered?'✓ Đã nhớ':'↻ Cần ôn';
    const row=document.createElement('div');row.className='row';
    const edit=document.createElement('button');edit.className='secondary';edit.textContent='✏️ Sửa';edit.disabled=busy;
    edit.addEventListener('click',()=>openEditor(card));
    const mark=document.createElement('button');mark.className='secondary';
    mark.textContent=card.remembered?'Đánh dấu cần ôn':'Đánh dấu đã nhớ';mark.disabled=busy;
    mark.addEventListener('click',()=>update(card,{...card,remembered:!card.remembered}));
    row.append(edit,mark);article.append(title,topic,state,row);root.append(article);
  }
}
async function readCloud(){
  const response=await learningApi('learning/personal-vocabulary');
  if(response.scope!=='personal-account'||!Array.isArray(response.cards))throw Error('Dữ liệu tài khoản không hợp lệ');
  remote=response.cards;
  render();
}
async function requireSession(){
  const a=await learningApi('auth/me');
  if(a.actor?.role!=='player'||!a.actor.id){userId=null;throw Error('Bạn cần đăng nhập học viên ở Trang chủ trước khi đồng bộ.')}
  userId=a.actor.id;
  $('ws17Auth').textContent='Đã đăng nhập: '+(a.actor.profile?.display_name||'Học viên')+' · Dữ liệu lưu riêng theo tài khoản.';
}
function openEditor(card){
  editing=card;
  for(const key of ids)$('ws17'+key[0].toUpperCase()+key.slice(1)).value=card[key]||'';
  $('ws17Remembered').checked=card.remembered;
  $('ws17Editor').classList.remove('hidden');
  $('ws17Editor').scrollIntoView({behavior:'smooth',block:'start'});
}
async function update(card,next){
  if(busy)return;
  setBusy(true);
  try{
    // Version check on server protects from stale edits across devices.
    const payload={...next,expected_version:card.version,expected_actor_id:userId};
    const answer=await learningApi('learning/personal-vocabulary/'+encodeURIComponent(card.id),{method:'PATCH',body:payload});
    if(answer.scope!=='personal-account'||!answer.card?.id)throw Error('Server chưa xác nhận thay đổi');
    editing=null;$('ws17Editor').classList.add('hidden');
    await readCloud();status('Đã lưu thay đổi theo tài khoản.'); 
  }catch(e){status(e.message||'Không thể lưu. Tải lại dữ liệu tài khoản trước khi thử lại.',true)}
  finally{setBusy(false)}
}
$('ws17Cancel').onclick=()=>{$('ws17Editor').classList.add('hidden');editing=null};
$('ws17Form').addEventListener('submit',e=>{
  e.preventDefault();if(!editing)return;
  const card={...editing};for(const key of ids)card[key]=val(key);
  card.remembered=$('ws17Remembered').checked;
  update(editing,card);
});
$('ws17Refresh').onclick=async()=>{
  if(busy)return;setBusy(true);
  try{await requireSession();await readCloud();status('Đã tải dữ liệu mới nhất từ PostgreSQL.')}
  catch(e){status(e.message,true)}
  finally{setBusy(false)}
};
$('ws17Import').onclick=async()=>{
  if(busy||!userId)return;
  let local;
  try{local=readLocalDeck()}catch(e){status('Không thể đọc bộ từ cũ: '+e.message,true);return}
  if(!local.cards.length){status('Thiết bị này chưa có bộ từ cần chuyển.');return}
  const accepted=window.confirm('Chuyển '+local.count+' từ ('+local.learnedCount+' đã nhớ) từ trình duyệt lên tài khoản? Từ trùng trên tài khoản sẽ được giữ nguyên, không ghi đè. Dữ liệu trong trình duyệt không bị xóa.');
  if(!accepted)return;
  setBusy(true);let completed=0,duplicates=0;
  try{
    for(let i=0;i<local.cards.length;i+=10){
      const session=await learningApi('auth/me');
      if(session.actor?.role!=='player'||session.actor.id!==userId)throw Error('Phiên đăng nhập đã thay đổi; dừng nhập để bảo vệ dữ liệu.');
      const response=await learningApi('learning/personal-vocabulary/import',{
        method:'POST',body:{expected_actor_id:userId,cards:local.cards.slice(i,i+10)}
      });
      if(response.scope!=='personal-account'||!Number.isInteger(response.inserted))throw Error('Máy chủ không xác nhận kết quả nhập');
      completed+=response.inserted;duplicates+=response.already_existing;
    }
    await readCloud();
    status('Đã chuyển '+completed+' từ mới lên tài khoản; '+duplicates+' từ đã tồn tại được giữ nguyên. Bộ từ trên trình duyệt vẫn còn.');
  }catch(e){
    await readCloud().catch(()=>{});
    status('Đã xác nhận '+completed+' từ mới. Đồng bộ chưa hoàn tất: '+e.message+'. Có thể thử lại, các từ đã lưu sẽ không bị ghi đè.',true);
  }finally{setBusy(false)}
};
async function start(){
  let local;
  try{local=readLocalDeck();$('ws17Local').textContent='Thiết bị hiện có '+local.count+' từ cá nhân ('+local.learnedCount+' đã nhớ).';}
  catch(e){$('ws17Local').textContent='Bộ từ trình duyệt đang lỗi: '+e.message;status('Không nhập dữ liệu lỗi lên tài khoản.',true);}
  try{await requireSession();await readCloud();if(local?.count)$('ws17Import').disabled=false;status('Đã tải bộ từ cá nhân theo tài khoản.')}
  catch(e){status(e.message,true);$('ws17Auth').textContent='Chưa thể sử dụng dữ liệu tài khoản.';}
}
start();
