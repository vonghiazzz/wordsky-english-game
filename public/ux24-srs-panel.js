import {learningApi,postUnifiedAccountReview} from './ux10-account-core.js';

// UX-24C: account-scoped SRS review UI. The SRS endpoint remains Preview-only.
// Keep topic/status/page stable across review updates and HTTP 409 refreshes.
export function srsQuery({status='due',topic='',page=0,size=20}={}){
 const params=new URLSearchParams({status,topic,page:String(page),size:String(size)});
 return 'learning/srs/queue?'+params.toString();
}
export function srsReviewCards(payload,actorId){
 if(!payload||payload.scope!=='account-srs'||payload.actor_id!==actorId||
    !Array.isArray(payload.words)||!Array.isArray(payload.topics)||
    !Number.isSafeInteger(payload.total)||payload.total<0)
  throw Error('Kết quả lịch ôn theo tài khoản không hợp lệ.');
 const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 for(const word of payload.words){
  if(!word||!uuid.test(word.id)||!['shared','personal'].includes(word.source)||
     !Number.isSafeInteger(word.review_count)||word.review_count<0||
     !['new','due','scheduled'].includes(word.status)||
     typeof word.english!=='string'||typeof word.topic!=='string')
   throw Error('Dữ liệu thẻ SRS không hợp lệ.');
 }
 return payload;
}
const make=(tag,text,classname)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(classname)el.className=classname;return el;};
function initSrs(){
 const panel=document.getElementById('ws24Srs');
 if(!panel)return;
 const status=document.getElementById('ws24Status');
 const topic=document.getElementById('ws24Topic');
 const count=document.getElementById('ws24Count');
 const notice=document.getElementById('ws24Notice');
 const list=document.getElementById('ws24List');
 const pageText=document.getElementById('ws24Page');
 const prev=document.getElementById('ws24Prev');
 const next=document.getElementById('ws24Next');
 const reload=document.getElementById('ws24Reload');
 const summary=document.getElementById('ws24Summary');
 let actorId=null,requested=0,pending=false,page=0,received=null;
 const showMessage=(message,error=false)=>{notice.textContent=message;notice.dataset.error=String(error);};
 const render=()=>{
  const data=received;
  const rows=data?.words??[];
  list.replaceChildren();
  count.textContent=data?data.total+' từ phù hợp':'—';
  pageText.textContent=data?'Trang '+(page+1)+' / '+Math.max(1,data.total_pages):'';
  prev.disabled=pending||!data||page===0;
  next.disabled=pending||!data||page+1>=data.total_pages;
  reload.disabled=pending;
  if(!data)return;
  summary.textContent='Cần ôn '+data.summary.due+' · Sắp đến hạn '+data.summary.upcoming+
    ' · Từ mới '+data.summary.new+' · Tổng '+data.summary.total;
  for(const word of rows){
   const card=make('article',undefined,'ws24-card');
   const content=make('div',undefined,'ws24-card-body');
   const heading=make('strong',word.english);
   const subtitle=make('span',word.topic+' · '+(word.source==='personal'?'Từ cá nhân':'Kho chung'));
   const meaning=make('p',word.meaning||'');
   const due=make('small',word.due_at
    ? 'Đến hạn: '+new Date(word.due_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})
    : 'Từ chưa học');
   content.append(heading,subtitle,meaning,due);
   const buttons=make('div',undefined,'ws24-card-buttons');
   for(const [title,remembered] of [['✓ Đã nhớ',true],['↻ Cần ôn',false]]){
    const button=make('button',title,'ws24-action');
    button.type='button';button.disabled=pending;
    button.setAttribute('aria-label',title+': '+word.english);
    button.addEventListener('click',()=>reviewWord(word,remembered));
    buttons.append(button);
   }
   card.append(content,buttons);
   list.append(card);
  }
  if(!rows.length)list.append(make('p','Không có từ phù hợp trong nhóm này.','ws24-empty'));
 };
 const refresh=async({keepMessage=false}={})=>{
  const seq=++requested;
  pending=true;
  if(!keepMessage)showMessage('Đang đồng bộ lịch ôn từ tài khoản…');
  render();
  try{
   const auth=await learningApi('auth/me');
   if(auth.actor?.role!=='player'||!auth.actor.id)
    throw Error('Đăng nhập học viên để xem lịch ôn.');
   if(seq!==requested)return;
   if(actorId&&actorId!==auth.actor.id){received=null;page=0;topic.value='';}
   actorId=auth.actor.id;
   const data=srsReviewCards(await learningApi(srsQuery({
    status:status.value,topic:topic.value,page
   })),actorId);
   if(seq!==requested)return;
   received=data;
   const oldTopic=topic.value;
   topic.replaceChildren(make('option','Tất cả chủ đề'));
   topic.firstChild.value='';
   for(const name of data.topics){
    const option=make('option',name);option.value=name;topic.append(option);
   }
   topic.value=data.topics.includes(oldTopic)?oldTopic:'';
   if(oldTopic&&!data.topics.includes(oldTopic)){page=0;await refresh();return;}
   if(page>0&&page>=data.total_pages){page=Math.max(0,data.total_pages-1);await refresh();return;}
   if(!keepMessage)showMessage('Lịch ôn được đọc từ PostgreSQL theo tài khoản.');
  }catch(error){
   if(seq!==requested)return;
   received=null;
   if(error.status===404)showMessage('Lịch ôn thử nghiệm chưa được bật trên môi trường này.',true);
   else showMessage('Không tải được lịch ôn: '+error.message,true);
  }finally{
   if(seq===requested){pending=false;render();}
  }
 };
 const reviewWord=async(word,remembered)=>{
  if(pending||!actorId)return;
  pending=true;render();
  try{
   const auth=await learningApi('auth/me');
   if(auth.actor?.role!=='player'||auth.actor.id!==actorId)
    throw Error('Tài khoản đã thay đổi; hãy tải lại trước khi ôn.');
   await postUnifiedAccountReview(word.source,word.id,remembered,actorId,word.review_count);
   // Existing My Learning filters are preserved by its soft account refresh.
   window.dispatchEvent(new CustomEvent('wordsky:srs-review-saved',{detail:{actorId}}));
   showMessage('Đã lưu từ “'+word.english+'”. Lịch ôn đã được cập nhật.');
   pending=false;
   await refresh({keepMessage:true});
  }catch(error){
   pending=false;
   if(error.status===409){
    showMessage('Từ đã được cập nhật ở thiết bị khác. Đã tải trạng thái mới; hãy xác nhận lại.',true);
    await refresh({keepMessage:true});
   }else{
    showMessage('Chưa lưu được từ “'+word.english+'”: '+error.message,true);
    render();
   }
  }
 };
 status.addEventListener('change',()=>{page=0;refresh()});
 topic.addEventListener('change',()=>{page=0;refresh()});
 prev.addEventListener('click',()=>{if(page>0){page--;refresh()}});
 next.addEventListener('click',()=>{if(received&&page+1<received.total_pages){page++;refresh()}});
 reload.addEventListener('click',()=>refresh());
 window.addEventListener('wordsky:my-learning-review-saved',()=>refresh());
 window.addEventListener('focus',()=>refresh());
 refresh();
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSrs,{once:true});
 else initSrs();
}
