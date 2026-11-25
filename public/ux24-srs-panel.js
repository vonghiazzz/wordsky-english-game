import {learningApi,postUnifiedAccountReview} from './ux10-account-core.js';
import {dailyPlanFromSrsQueue,validateDailyActivity} from './ux58-daily-plan-core.js';

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
 // Render below dereferences summary even if the daily card is hidden.
 // Reject absent, inconsistent, or cross-account totals before committing
 // the response to UI state; never leave a partial My Learning view.
 dailyPlanFromSrsQueue(payload,actorId);
 srsDueBreakdown(payload);
 return payload;
}
// UX59.3: labels only. Do not infer a new due date or change SRS state.
export function srsDueLabel(word){
 if(!word||typeof word!=='object')return '';
 if(word.status==='new')return 'Từ mới';
 if(word.status==='scheduled')return 'Sắp đến hạn';
 if(word.status!=='due')return '';
 const days=word.overdue_days;
 if(Number.isSafeInteger(days)&&days>0)return 'Quá hạn '+days+' ngày';
 return 'Đến hạn';
}

// Optional for compatibility with pre-UX59.4 previews. Never derive account
// totals from a single paginated page or retain another actor's breakdown.
export function srsDueBreakdown(payload){
 const b=payload?.due_breakdown;
 if(b===undefined)return null;
 if(!b||!Number.isSafeInteger(b.overdue)||b.overdue<0||
    !Number.isSafeInteger(b.today)||b.today<0)
  throw Error('Thống kê lịch ôn quá hạn không hợp lệ.');
 const dueTotal=payload.topic?payload.status==='due'?payload.total:null:
  payload.summary?.due;
 if(dueTotal!==null&&b.overdue+b.today!==dueTotal)
  throw Error('Thống kê lịch ôn quá hạn không nhất quán.');
 return b;
}

// UX59.5: never show a cached actor's rows during auth refresh or logout.
export function srsVisibleRows(data,actorId,pending){
 return !pending&&actorId&&Array.isArray(data?.words)?data.words:[];
}

export function srsActionLabels(status){
 if(status==='scheduled')return [
  ['↻ Cần ôn ngay',false],
  ['✓ Ôn sớm (giữ nguyên lịch)',true]
 ];
 return [['✓ Đã nhớ',true],['↻ Cần ôn',false]];
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
 const practice=document.getElementById('ws24Practice');
 const audit=document.getElementById('ws24Audit');
 const auditResult=document.getElementById('ws24AuditResult');
 const summary=document.getElementById('ws24Summary');
 const daily=document.getElementById('ws58DailyPlan');
 const dailyDue=document.getElementById('ws58DailyDue');
 const dailyNew=document.getElementById('ws58DailyNew');
 const dailyUpcoming=document.getElementById('ws58DailyUpcoming');
 const dailyTotal=document.getElementById('ws58DailyTotal');
 const dailyMessage=document.getElementById('ws58DailyMessage');
 const activityBox=document.getElementById('ws58Activity');
 const reviewsToday=document.getElementById('ws58ReviewsToday');
 const uniqueToday=document.getElementById('ws58UniqueToday');
 const streak=document.getElementById('ws58Streak');
 const activityNotice=document.getElementById('ws58ActivityNotice');
 let actorId=null,requested=0,pending=false,page=0,received=null,activity=null,activityError='';
 const showMessage=(message,error=false)=>{notice.textContent=message;notice.dataset.error=String(error);};
 const render=()=>{
  const data=received;
  const rows=srsVisibleRows(data,actorId,pending);
  list.replaceChildren();
  count.textContent=data&&actorId&&!pending?data.total+' từ trong nhóm':'—';
  const dueBreakdown=data&&actorId&&!pending&&data.status==='due'?
   srsDueBreakdown(data):null;
  if(dueBreakdown)
   count.textContent+=' · '+dueBreakdown.overdue+' quá hạn · '+dueBreakdown.today+' đến hạn';
  pageText.textContent=data&&actorId&&!pending?'Trang '+(page+1)+' / '+Math.max(1,data.total_pages):'';
  prev.disabled=pending||!data||page===0;
  next.disabled=pending||!data||page+1>=data.total_pages;
  reload.disabled=pending;
  practice.disabled=pending||!data||!actorId||data.total===0;
  practice.title=!data||!actorId?'Chờ xác nhận lịch ôn':data.total===0?
    'Nhóm ôn hiện tại chưa có từ để luyện':'Luyện các từ trong nhóm ôn đang chọn';
  // Do not show a previous account's daily totals during auth refresh,
  // logout, account switch, or a failed SRS response.
  daily.hidden=true;
  activityBox.hidden=true;
  activityNotice.textContent='';
  if(!data||pending||!actorId)return;
  try{
   const plan=dailyPlanFromSrsQueue(data,actorId);
   dailyDue.textContent=String(plan.tasks[0].available);
   dailyNew.textContent=String(plan.tasks[1].available);
   dailyUpcoming.textContent=String(plan.upcoming);
   dailyTotal.textContent='Gợi ý hôm nay: '+plan.tasks[0].planned+' từ cần ôn + '+plan.tasks[1].planned+' từ mới';
   dailyMessage.textContent=plan.hasWork
    ?'Chọn nhóm từ bên dưới rồi bấm Luyện từ để bắt đầu.'
    :'Không có từ cần ôn hoặc từ mới trong lịch hiện tại.';
   if(activity){
    try{
     const verified=validateDailyActivity(activity,actorId);
     reviewsToday.textContent=String(verified.reviews_today);
     uniqueToday.textContent=String(verified.unique_words_today);
     streak.textContent=String(verified.streak_days)+(verified.streak_capped?'+':'');
     activityBox.hidden=false;
     activityNotice.textContent=verified.streak_days&&verified.streak_ends_on!==verified.day
      ?'Chuỗi ngày được giữ từ hôm qua. Ôn một từ hôm nay để tiếp tục.'
      :'Lượt ôn đã xác nhận trên máy chủ, tính theo giờ Việt Nam.';
    }catch{
     activityBox.hidden=true;
     activityNotice.textContent='Chưa xác minh được hoạt động học.';
    }
   }else{
    activityNotice.textContent=activityError||'Chưa có dữ liệu hoạt động học được xác nhận.';
   }
   daily.hidden=false;
  }catch{
   // Invalid actor/summary: hide the entire suggestion, not stale counts.
  }
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
   content.append(heading,subtitle,meaning);
   const dueLabel=srsDueLabel(word);
   if(dueLabel&&word.status==='due')
    content.append(make('small',dueLabel,'ws59-due-label'));
   const details=make('details',undefined,'ws60-word-details');
   const detailTitle=make('summary','Xem lịch của từ');
   details.append(detailTitle,due);
   content.append(details);
   if(word.status==='scheduled')
    content.append(make('small',
     'Ôn sớm ghi nhận lượt nhớ nhưng không đổi ngày ôn tiếp theo.',
     'ws24-early-hint'));
   const buttons=make('div',undefined,'ws24-card-buttons');
   for(const [title,remembered] of srsActionLabels(word.status)){
    const button=make('button',title,'ws24-action');
    button.type='button';button.disabled=pending;
    button.setAttribute('aria-label',title+': '+word.english);
    button.addEventListener('click',()=>reviewWord(word,remembered));
    buttons.append(button);
   }
   card.append(content,buttons);
   list.append(card);
  }
  if(!pending&&actorId&&data&&!rows.length)
   list.append(make('p','Không có từ phù hợp trong nhóm này.','ws24-empty'));
 };
 const refresh=async({keepMessage=false}={})=>{
  const seq=++requested;
  activity=null;activityError='';
  pending=true;
  if(!keepMessage)showMessage('Đang đồng bộ lịch ôn từ tài khoản…');
  render();
  try{
   const auth=await learningApi('auth/me');
   if(auth.actor?.role!=='player'||!auth.actor.id)
    throw Error('Đăng nhập học viên để xem lịch ôn.');
   if(seq!==requested)return;
   if(actorId&&actorId!==auth.actor.id){
    received=null;page=0;topic.value='';auditResult.textContent='';
   }
   actorId=auth.actor.id;
   const data=srsReviewCards(await learningApi(srsQuery({
    status:status.value,topic:topic.value,page
   })),actorId);
   if(seq!==requested)return;
   received=data;
   panel.hidden=false;
   const oldTopic=topic.value;
   topic.replaceChildren(make('option','Tất cả chủ đề'));
   topic.firstChild.value='';
   for(const name of data.topics){
    const option=make('option',name);option.value=name;topic.append(option);
   }
   topic.value=data.topics.includes(oldTopic)?oldTopic:'';
   if(oldTopic&&!data.topics.includes(oldTopic)){page=0;await refresh();return;}
   if(page>0&&page>=data.total_pages){page=Math.max(0,data.total_pages-1);await refresh();return;}
   // Activity read is independent from queue availability: a failed request
   // must not block SRS cards or silently show another account's last streak.
   try{
    const result=await learningApi('learning/daily-activity');
    if(seq!==requested)return;
    activity=validateDailyActivity(result,actorId);
   }catch(error){
    if(seq!==requested)return;
    activity=null;activityError='Chưa tải được hoạt động hôm nay. Hãy làm mới lịch ôn.';
   }
   if(!keepMessage)showMessage('Lịch ôn được đọc từ PostgreSQL theo tài khoản.');
  }catch(error){
   if(seq!==requested)return;
   received=null;actorId=null;
   // Never show the experimental UI on Production or when the preview flag is off.
   panel.hidden=error.status===404;
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
   auditResult.textContent='Đã có lượt học mới; bấm Kiểm tra đồng bộ để đối chiếu.';
   // Existing My Learning filters are preserved by its soft account refresh.
   window.dispatchEvent(new CustomEvent('wordsky:srs-review-saved',{detail:{actorId}}));
   showMessage(word.status==='scheduled'&&remembered
    ? 'Đã ghi nhận ôn sớm từ “'+word.english+'”. Ngày ôn tiếp theo được giữ nguyên.'
    : 'Đã lưu từ “'+word.english+'”. Lịch ôn đã được cập nhật.');
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
 practice.addEventListener('click',()=>{
   if(pending||!actorId||!received?.total)return;
   const params=new URLSearchParams({status:status.value,topic:topic.value});
   window.location.assign('/practice.html?'+params.toString());
 });
 audit.addEventListener('click',async()=>{
  const clickedActor=actorId,clickedRequest=requested;
  if(!clickedActor)return;
  audit.disabled=true;
  auditResult.textContent='Đang đối chiếu lịch ôn với lịch sử trên PostgreSQL…';
  const stillCurrent=()=>actorId===clickedActor&&requested===clickedRequest;
  try{
   const data=await learningApi('learning/srs/diagnostics');
   // The server may correctly return A after the tab has switched to B.
   // The old response must never update B's UI, even if actor validation
   // against the originally clicked account succeeds.
   if(!stillCurrent())return;
   if(data.scope!=='account-srs-diagnostics'||data.actor_id!==clickedActor)
    throw Error('Phiên đăng nhập đã thay đổi; không hiển thị kết quả tài khoản khác.');
   const matched=data.matched+'/'+data.materialized+' lịch đã lưu khớp';
   auditResult.textContent=matched+
     (data.missing?' · '+data.missing+' từ đã học chưa được tạo lịch lưu':'')+
     (data.mismatched||data.orphaned?' · '+(data.mismatched+data.orphaned)+' lịch sai lệch':'')+
     (data.status==='complete'?' · Hoàn tất':' · Tiếp tục theo dõi');
  }catch(error){
   if(stillCurrent())auditResult.textContent='Chưa kiểm tra được lịch: '+error.message;
  }finally{audit.disabled=false;}
 });
 window.addEventListener('wordsky:my-learning-review-saved',()=>refresh());
 window.addEventListener('focus',()=>refresh());
 refresh();
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSrs,{once:true});
 else initSrs();
}
