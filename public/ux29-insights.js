import {learningApi} from './ux10-account-core.js';

// UX29: Insights are ephemeral client projections of server-owned review history.
// Never persist client progress or infer mastery scores from review decisions.
const $=id=>document.getElementById(id);
let days=7,sequence=0,actorId=null;
const num=value=>Number.isSafeInteger(value)&&value>=0;

export function validateInsightsResponse(data,actor,requestedDays){
 if(!data||data.scope!=='account-learning-insights'||data.actor_id!==actor||
   data.time_zone!=='Asia/Ho_Chi_Minh'||data.days!==requestedDays||
   !data.summary||!Array.isArray(data.daily)||data.daily.length!==requestedDays||
   !Array.isArray(data.focus_words)||!Array.isArray(data.solo_modes))
  throw Error('Dữ liệu thống kê không thuộc tài khoản hiện tại.');
 const s=data.summary;
 for(const field of ['reviews','marked_remembered','marked_need_review','active_days',
                      'solo_runs','current_known','current_need_review'])
  if(!num(s[field]))throw Error('Chỉ số học tập không hợp lệ.');
 if(s.remembered_mark_rate!==null&&
    (typeof s.remembered_mark_rate!=='number'||
     s.remembered_mark_rate<0||s.remembered_mark_rate>100))
  throw Error('Tỷ lệ đánh dấu nhớ không hợp lệ.');
 if(s.marked_remembered+s.marked_need_review!==s.reviews||
    s.active_days>requestedDays)
  throw Error('Lịch sử thống kê không nhất quán.');
 for(const day of data.daily)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day.day)||!num(day.reviews)||
     !num(day.solo_runs)||!num(day.marked_remembered)||
     !num(day.marked_need_review)||day.marked_remembered+day.marked_need_review!==day.reviews)
   throw Error('Dữ liệu biểu đồ không hợp lệ.');
 for(const word of data.focus_words){
  if(!word||!['shared','personal'].includes(word.source)||
     typeof word.english!=='string'||typeof word.meaning!=='string'||
     typeof word.topic!=='string'||!num(word.need_review_marks)||
     !num(word.review_events))throw Error('Từ cần chú ý không hợp lệ.');
 }
 return data;
}
const el=(tag,cls='',value='')=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 node.textContent=String(value??'');
 return node;
};
const displayDay=date=>{
 const [year,month,day]=String(date).split('-');
 return day+'/'+month+'/'+year;
};
const shortDay=date=>{
 const parts=String(date).split('-');
 return parts[2]+'/'+parts[1];
};
function renderChart(rows,range){
 const chart=$('ws29Chart');
 chart.replaceChildren();
 chart.classList.toggle('is-month',range===30);
 const max=Math.max(1,...rows.flatMap(row=>[row.reviews,row.solo_runs]));
 for(const row of rows){
  const day=el('div','ws29-day');
  day.setAttribute('role','listitem');
  const label=displayDay(row.day)+': '+row.reviews+' lượt ôn ('+
   row.marked_remembered+' đã nhớ, '+row.marked_need_review+
   ' cần ôn), '+row.solo_runs+' trận Solo';
  day.setAttribute('aria-label',label);
  day.title=label;
  const bars=el('div','ws29-bars');
  for(const [kind,value] of [['reviews',row.reviews],['solo',row.solo_runs]]){
   const bar=el('span','ws29-bar ws29-bar-'+kind);
   bar.setAttribute('aria-hidden','true');
   bar.style.height=value===0?'0':Math.max(3,Math.round(value*100/max))+'%';
   bars.append(bar);
  }
  day.append(bars,el('span','ws29-day-label',shortDay(row.day)));
  chart.append(day);
 }
 $('ws29Range').textContent=displayDay(rows[0].day)+' – '+
  displayDay(rows.at(-1).day)+' · múi giờ Việt Nam';
}
function renderFocus(words){
 const list=$('ws29Words');
 list.replaceChildren();
 $('ws29Empty').hidden=words.length>0;
 for(const word of words){
  const card=el('article','ws29-word');
  const content=el('div','ws29-word-copy');
  content.append(
   el('strong','',word.english),
   el('span','',word.meaning),
   el('span','',word.topic+' · '+(word.source==='personal'?'Từ cá nhân':'Kho từ chung'))
  );
  const count=el('span','ws29-word-count',word.need_review_marks+' lượt cần ôn');
  card.append(content,count);
  list.append(card);
 }
}
function render(data){
 const s=data.summary;
 $('ws29Reviews').textContent=s.reviews.toLocaleString('vi-VN');
 $('ws29Remembered').textContent=s.remembered_mark_rate===null?
  '—':s.remembered_mark_rate.toLocaleString('vi-VN')+'%';
 $('ws29RememberedHint').textContent=s.marked_remembered+' / '+s.reviews+
  ' lượt được chọn “Đã nhớ”';
 $('ws29ActiveDays').textContent=s.active_days+'/'+data.days;
 $('ws29ActiveHint').textContent='Ngày có ôn hoặc chơi Solo';
 $('ws29CurrentNeed').textContent=s.current_need_review.toLocaleString('vi-VN');
 renderChart(data.daily,data.days);
 const mode=Object.fromEntries(data.solo_modes.map(row=>[row.mode,row.runs]));
 $('ws29SoloModes').textContent='Trận Solo trong kỳ: MATCH '+(mode.MATCH||0)+
  ' · BOMB '+(mode.BOMB||0)+' · CAR '+(mode.CAR||0);
 renderFocus(data.focus_words);
 $('ws29Content').hidden=false;
 $('ws29Status').dataset.kind='success';
 const ts=new Date(data.as_of).toLocaleString('vi-VN',{
  timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'
 });
 $('ws29Status').textContent='Đã cập nhật '+ts+' (GMT+7) · Dữ liệu từ tài khoản WordSky.';
}
function periodButtons(){
 for(const n of [7,30]){
  const button=$('ws29Days'+n);
  const active=n===days;
  button.classList.toggle('is-active',active);
  button.setAttribute('aria-pressed',String(active));
 }
}
async function refresh(){
 const ticket=++sequence;
 actorId=null;
 const panel=$('ws29Insights');
 // Fail closed during an account transition: never leave another actor's
 // private learning statistics visible while auth/me is re-checked.
 panel.hidden=true;
 $('ws29Content').hidden=true;
 periodButtons();
 $('ws29Status').dataset.kind='info';
 $('ws29Status').textContent='Đang tải báo cáo học tập…';
 try{
  const auth=await learningApi('auth/me');
  if(ticket!==sequence)return;
  const id=auth.actor?.role==='player'?auth.actor.id:null;
  if(!id)return; // Guests see no account analytics panel.
  const result=validateInsightsResponse(
   await learningApi('learning/insights?days='+days),id,days
  );
  const confirm=await learningApi('auth/me');
  if(ticket!==sequence)return;
  if(confirm.actor?.role!=='player'||confirm.actor.id!==id)
   throw Error('Tài khoản đã thay đổi; đã dừng hiển thị số liệu.');
  actorId=id;
  render(result);
  panel.hidden=false;
 }catch(error){
  if(ticket!==sequence)return;
  $('ws29Content').hidden=true;
  // An authorization error hides rather than retaining another user's data.
  if([401,403].includes(error.status))return;
  $('ws29Status').dataset.kind='error';
  $('ws29Status').textContent='Chưa tải được Learning Insights: '+
   (error.message||'vui lòng mở lại My Learning.');
  panel.hidden=false;
 }
}
function boot(){
 if(!$('ws29Insights'))return;
 for(const n of [7,30])$('ws29Days'+n).addEventListener('click',()=>{
  if(days===n)return;
  days=n;refresh();
 });
 window.addEventListener('wordsky:my-learning-review-saved',refresh);
 window.addEventListener('wordsky:srs-review-saved',refresh);
 window.addEventListener('focus',refresh);
 window.addEventListener('pageshow',event=>{if(event.persisted)refresh()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 refresh();
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
}
