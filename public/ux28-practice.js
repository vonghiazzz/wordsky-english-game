import {learningApi,postUnifiedAccountReview} from './ux10-account-core.js';
import {
 gradeRecall,practiceSelectionFromUrl,reviewGroupLabel,selectPracticeQueue
} from './ux28-practice-core.js';

// UX28.1: one My Learning entry. The selected SRS group is the source of
// questions; server-accepted reviews remain the only durable learning record.
const $=id=>document.getElementById(id);
let actorId=null,quiz=[],index=0,correctCount=0,confirmedCount=0;
let pendingAttempt=null,saving=false,loading=0,selection=null;
const MAX_CARDS=10;
const rowText=(value)=>String(value??'');

function notice(value,kind='info'){
 $('ws28Notice').textContent=value;
 $('ws28Notice').dataset.kind=kind;
}
function view(name){
 for(const key of ['Guest','Setup','Play','Done'])
  $('ws28'+key).hidden=key!==name;
}
function text(tag,value,cls){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 el.textContent=rowText(value);
 return el;
}
function groupName(){
 if(!selection)return 'Nhóm ôn';
 return reviewGroupLabel(selection.status)+(selection.topic?' · '+selection.topic:'');
}
async function loadAccount(message=''){
 const ticket=++loading;
 actorId=null;quiz=[];index=0;pendingAttempt=null;saving=false;
 correctCount=0;confirmedCount=0;
 view('');
 $('ws28ActorState').textContent='Đang xác minh tài khoản';
 notice('Đang tải Nhóm ôn từ My Learning…');
 try{
  selection=practiceSelectionFromUrl(window.location.search);
  $('ws28GroupTitle').textContent='Luyện từ · '+groupName();
  const auth=await learningApi('auth/me');
  if(ticket!==loading)return;
  const id=auth.actor?.role==='player'?auth.actor.id:null;
  if(!id){
   $('ws28ActorState').textContent='Chưa đăng nhập';
   view('Guest');notice('Cần đăng nhập học viên để sử dụng lịch ôn theo tài khoản.');
   return;
  }
  const params=new URLSearchParams({
   status:selection.status,topic:selection.topic,page:'0',size:'100'
  });
  const data=await learningApi('learning/srs/queue?'+params.toString());
  const words=selectPracticeQueue(data,id,selection,MAX_CARDS);
  const confirm=await learningApi('auth/me');
  if(ticket!==loading)return;
  if(confirm.actor?.role!=='player'||confirm.actor.id!==id)
   throw Error('Tài khoản đã thay đổi; không hiển thị từ của người khác.');
  actorId=id;quiz=words;
  $('ws28ActorState').textContent='✓ Tài khoản đã xác thực';
  if(!quiz.length){
   view('Setup');
   notice('Không có từ có nghĩa tiếng Việt để luyện trong nhóm '+groupName()+'.');
   return;
  }
  view('Play');
  renderQuestion();
  if(message)notice(message,'success');
 }catch(error){
  if(ticket!==loading)return;
  actorId=null;quiz=[];view('Setup');
  $('ws28ActorState').textContent='Không tải được Nhóm ôn';
  notice(error.message||'Không tải được lịch ôn từ My Learning.','error');
 }
}
function renderQuestion(){
 if(index>=quiz.length){showSummary();return;}
 const word=quiz[index];
 pendingAttempt=null;saving=false;
 $('ws28Position').textContent=(index+1)+' / '+quiz.length;
 $('ws28Progress').setAttribute('aria-valuemax',String(quiz.length));
 $('ws28Progress').setAttribute('aria-valuenow',String(index));
 $('ws28ProgressFill').style.width=(100*index/quiz.length)+'%';
 $('ws28Meaning').textContent=word.meaning;
 $('ws28Tags').replaceChildren(
  text('span',word.topic||'Chủ đề chung'),
  text('span',word.source==='personal'?'Từ cá nhân':'Kho từ chung'),
  text('span',reviewGroupLabel(selection?.status))
 );
 $('ws28Answer').value='';
 $('ws28Answer').disabled=false;
 $('ws28Check').disabled=false;
 $('ws28Skip').disabled=false;
 $('ws28Feedback').hidden=true;
 $('ws28After').hidden=true;
 $('ws28Retry').hidden=true;
 $('ws28Next').hidden=true;
 $('ws28Exit').disabled=false;
 notice('Câu '+(index+1)+'/'+quiz.length+' · '+groupName()+'. Gõ từ hoặc chọn Không nhớ.');
 $('ws28Answer').focus({preventScroll:true});
}
function showFeedback(attempt){
 const word=attempt.word,box=$('ws28Feedback');
 box.hidden=false;box.dataset.correct=String(attempt.correct);
 $('ws28Verdict').textContent=attempt.correct?'✓ Chính xác!':'↻ Chưa chính xác · tiếp tục luyện nhé';
 $('ws28CorrectWord').textContent='Đáp án: '+word.english+(word.ipa?' · '+word.ipa:'');
 $('ws28Example').textContent=word.example?'Ví dụ: '+word.example:'';
}
async function saveAttempt(){
 if(!pendingAttempt||pendingAttempt.confirmed||saving||!actorId)return;
 saving=true;
 const attempt=pendingAttempt,activeActor=actorId;
 $('ws28Check').disabled=true;
 $('ws28Skip').disabled=true;
 $('ws28Answer').disabled=true;
 $('ws28Retry').disabled=true;
 $('ws28Exit').disabled=true;
 notice('Đang lưu lượt ôn vào tài khoản…');
 try{
  const auth=await learningApi('auth/me');
  if(auth.actor?.role!=='player'||auth.actor.id!==activeActor)
   throw Object.assign(Error('Tài khoản đã thay đổi; dữ liệu chưa được gửi.'),{status:409});
  const response=await postUnifiedAccountReview(
   attempt.word.source,attempt.word.word_id,attempt.correct,activeActor,attempt.word.review_count
  );
  if(actorId!==activeActor||pendingAttempt!==attempt)return;
  attempt.confirmed=true;
  confirmedCount++;
  attempt.word.review_count++;
  if(attempt.correct)correctCount++;
  $('ws28After').hidden=false;
  $('ws28Next').hidden=false;
  $('ws28Retry').hidden=true;
  showFeedback(attempt);
  notice(response.replayed?'Máy chủ đã xác nhận lượt ôn trước đó; không ghi trùng.':
   attempt.word.status==='scheduled'&&attempt.correct
    ?'Đã ghi nhận ôn sớm · lịch đến hạn vẫn giữ nguyên.'
    :'Đã lưu vào My Learning · '+(attempt.correct?'Đã nhớ':'Cần ôn'),'success');
 }catch(error){
  if(actorId!==activeActor||pendingAttempt!==attempt)return;
  if([401,403,404,409].includes(error.status)){
   await loadAccount();
   notice('Lịch ôn hoặc tài khoản đã đổi. Đã tải lại để tránh ghi đè.','error');
   return;
  }
  showFeedback(attempt);
  $('ws28After').hidden=false;
  $('ws28Next').hidden=true;
  $('ws28Retry').hidden=false;
  notice('Chưa xác nhận lưu được. Bấm “Thử lưu kết quả” để gửi lại đúng một lệnh. '+
   (error.message||''),'error');
 }finally{
  if(pendingAttempt===attempt){
   saving=false;
   $('ws28Exit').disabled=false;
   $('ws28Retry').disabled=false;
  }
 }
}
function submit(typed,skipped=false){
 if(saving||pendingAttempt||index>=quiz.length||!actorId)return;
 const word=quiz[index];
 if(!skipped&&!rowText(typed).trim()){
  notice('Hãy nhập từ tiếng Anh hoặc chọn “Không nhớ”.','error');
  $('ws28Answer').focus();return;
 }
 const result=gradeRecall(typed,word.english);
 pendingAttempt={word,correct:skipped?false:result.correct,confirmed:false};
 saveAttempt();
}
function showSummary(partial=false){
 view('Done');
 $('ws28CorrectCount').textContent=String(correctCount);
 $('ws28DoneTotal').textContent=String(confirmedCount);
 $('ws28DoneTitle').textContent=partial?'Đã lưu kết quả những từ vừa luyện':'Bạn đã hoàn thành phiên luyện!';
 $('ws28DoneMessage').textContent=partial
  ?'Bạn có thể luyện tiếp từ My Learning. Các lượt đã lưu được giữ nguyên.'
  :'Đã lưu '+confirmedCount+' lượt ôn vào PostgreSQL. Đúng '+correctCount+
   ', cần luyện thêm '+(confirmedCount-correctCount)+'. Mở My Learning để xem lịch mới.';
 notice('Đã đồng bộ tiến độ ôn theo tài khoản.','success');
}
async function validateIdentity(){
 if(!actorId||document.hidden)return;
 try{
  const response=await learningApi('auth/me');
  if(response.actor?.role!=='player'||response.actor.id!==actorId){
   await loadAccount();
   notice('Tài khoản thay đổi; đã tải lại đúng Nhóm ôn.','error');
  }
 }catch{
  // A transient connection failure must not erase an answer being typed.
 }
}
function boot(){
 $('ws28AnswerForm').addEventListener('submit',event=>{
  event.preventDefault();submit($('ws28Answer').value);
 });
 $('ws28Skip').addEventListener('click',()=>submit('',true));
 $('ws28Retry').addEventListener('click',saveAttempt);
 $('ws28Next').addEventListener('click',()=>{
  if(!pendingAttempt?.confirmed||saving)return;
  index++;renderQuestion();
 });
 $('ws28Exit').addEventListener('click',()=>{
  if(saving||(pendingAttempt&&!pendingAttempt.confirmed))return;
  showSummary(true);
 });
 $('ws28Again').addEventListener('click',()=>{
  window.location.assign('/practice.html'+window.location.search);
 });
 window.addEventListener('focus',validateIdentity);
 window.addEventListener('pageshow',event=>{if(event.persisted)validateIdentity()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)validateIdentity()});
 loadAccount();
}
if(document.readyState==='loading')
 document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
