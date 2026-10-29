import {learningApi,postUnifiedAccountReview} from './ux10-account-core.js';
import {
  gradeRecall,validateMistakeNotebook,selectRecallWords
} from './ux28-practice-core.js';

// UX28: The server remains the only source of truth. The browser holds only
// transient questions, user input and in-flight idempotent commands.
const $=id=>document.getElementById(id);
let actorId=null,library=[],quiz=[],index=0,correctCount=0,confirmedCount=0;
let pendingAttempt=null,saving=false,loading=0;
const deepLink=new URLSearchParams(window.location.search).get('word')||'';

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
  el.textContent=String(value??'');
  return el;
}
function allFilters(){
  return {scope:$('ws28Scope').value,mode:$('ws28Mode').value,
    limit:Number($('ws28Limit').value),wordId:deepLink};
}
function countAvailable(){
  const candidates=library.filter(w=>w.remembered!==true);
  $('ws28Total').textContent=library.length;
  $('ws28Needed').textContent=candidates.length;
  $('ws28Start').disabled=library.length===0;
  $('ws28Synced').textContent='✓ PostgreSQL';
}
function noWords(message){
  $('ws28NoWords').hidden=false;
  if(message)$('ws28NoWords').querySelector('p').textContent=message;
}
async function loadAccount(message=''){
  const ticket=++loading;
  actorId=null;
  library=[];quiz=[];index=0;pendingAttempt=null;saving=false;correctCount=0;confirmedCount=0;
  view('');$('ws28ActorState').textContent='Đang xác minh tài khoản';
  notice('Đang lấy sổ từ sai từ PostgreSQL…');
  try{
    const auth=await learningApi('auth/me');
    if(ticket!==loading)return;
    const id=auth.actor?.role==='player'?auth.actor.id:null;
    if(!id){
      $('ws28ActorState').textContent='Chưa đăng nhập';
      view('Guest');notice('Cần đăng nhập học viên để luyện từ sai.');
      return;
    }
    let syncWarning='';
    try{
      const result=await learningApi('learning/game-mistakes/sync',{
        method:'POST',body:{expected_actor_id:id}
      });
      if(result.scope!=='account-game-mistakes'||result.actor_id!==id)
        throw Error('Kết quả đồng bộ không khớp tài khoản.');
    }catch(error){
      if([401,409].includes(error.status))throw error;
      syncWarning=error.message||'Chưa đồng bộ được các trận gần đây';
    }
    const data=validateMistakeNotebook(await learningApi('learning/game-mistakes'),id);
    const confirm=await learningApi('auth/me');
    if(ticket!==loading)return;
    if(confirm.actor?.role!=='player'||confirm.actor.id!==id)
      throw Error('Tài khoản đã thay đổi; đã dừng để bảo vệ dữ liệu.');
    actorId=id;library=data.words;
    $('ws28ActorState').textContent='✓ Tài khoản đã xác thực';
    if(deepLink){
      $('ws28Scope').value='all';
      $('ws28Limit').value='5';
      if(!library.some(w=>w.word_id===deepLink))
        noWords('Từ này không có trong Sổ từ cần ôn của tài khoản đang đăng nhập.');
    }
    countAvailable();
    if(!library.length)noWords('Chưa có từ sai trong tài khoản. Hãy chơi MATCH/BOMB/CAR Solo sau khi đăng nhập.');
    else if(!deepLink)$('ws28NoWords').hidden=true;
    view('Setup');
    notice(syncWarning?'Đã tải sổ từ. Đồng bộ trận trước còn lỗi: '+syncWarning:
      message||'Sẵn sàng luyện. Kết quả trả lời sẽ được lưu theo đúng tài khoản.',
      syncWarning?'error':'success');
  }catch(error){
    if(ticket!==loading)return;
    actorId=null;view('');
    $('ws28ActorState').textContent='Không tải được';
    notice(error.message||'Không truy cập được dữ liệu ôn từ.', 'error');
  }
}
function renderQuestion(){
  if(index>=quiz.length){
    showSummary();return;
  }
  const word=quiz[index];
  pendingAttempt=null;saving=false;
  $('ws28Position').textContent=(index+1)+' / '+quiz.length;
  $('ws28Progress').setAttribute('aria-valuemax',String(quiz.length));
  $('ws28Progress').setAttribute('aria-valuenow',String(index));
  $('ws28ProgressFill').style.width=(100*index/quiz.length)+'%';
  $('ws28Meaning').textContent=word.meaning;
  $('ws28Tags').replaceChildren(
    text('span',word.topic||'Chủ đề'),
    text('span',(word.modes||[]).join(' · ')),
    text('span',Number(word.mistake_runs||0)+' lượt gặp khó')
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
  notice('Câu '+(index+1)+'/'+quiz.length+': gõ từ rồi bấm Kiểm tra, hoặc chọn Không nhớ.');
  $('ws28Answer').focus({preventScroll:true});
}
function showFeedback(attempt){
  const word=attempt.word;
  const box=$('ws28Feedback');
  box.hidden=false;box.dataset.correct=String(attempt.correct);
  $('ws28Verdict').textContent=attempt.correct?'✓ Chính xác!':'↻ Chưa chính xác · tiếp tục luyện nhé';
  $('ws28CorrectWord').textContent='Đáp án: '+word.english+(word.ipa?' · '+word.ipa:'');
  $('ws28Example').textContent=word.example?'Ví dụ: '+word.example:'';
}
async function saveAttempt(){
  if(!pendingAttempt||pendingAttempt.confirmed||saving||!actorId)return;
  saving=true;
  const attempt=pendingAttempt;
  const activeActor=actorId;
  $('ws28Check').disabled=true;
  $('ws28Skip').disabled=true;
  $('ws28Answer').disabled=true;
  $('ws28Retry').disabled=true;
  $('ws28Exit').disabled=true;
  notice('Đang lưu lượt ôn vào tài khoản…');
  try{
    const auth=await learningApi('auth/me');
    if(auth.actor?.role!=='player'||auth.actor.id!==activeActor)
      throw Object.assign(Error('Tài khoản đã thay đổi; dữ liệu ôn chưa được gửi.'),{status:409});
    const response=await postUnifiedAccountReview(
      'shared',attempt.word.word_id,attempt.correct,activeActor,attempt.word.review_count
    );
    if(actorId!==activeActor||pendingAttempt!==attempt)return;
    // Only an acknowledged transaction counts toward the session result.
    attempt.confirmed=true;
    confirmedCount++;
    attempt.word.review_count++;
    attempt.word.remembered=attempt.correct;
    if(attempt.correct)correctCount++;
    $('ws28After').hidden=false;
    $('ws28Next').hidden=false;
    $('ws28Retry').hidden=true;
    showFeedback(attempt);
    notice(response.replayed?'Lượt ôn đã được máy chủ xác nhận trước đó; không ghi trùng.':
      'Đã lưu vào My Learning · '+(attempt.correct?'Đã nhớ':'Cần ôn'),'success');
  }catch(error){
    if(actorId!==activeActor||pendingAttempt!==attempt)return;
    if([401,403,404,409].includes(error.status)){
      await loadAccount('Lịch sử đã thay đổi trên thiết bị khác. Hãy bắt đầu phiên mới.');
      notice('Tiến độ hoặc tài khoản đã thay đổi. Đã dừng phiên cũ để tránh ghi đè.','error');
      return;
    }
    showFeedback(attempt);
    $('ws28After').hidden=false;
    $('ws28Next').hidden=true;
    $('ws28Retry').hidden=false;
    notice('Chưa xác nhận lưu được câu trả lời. Bấm “Thử lưu kết quả”; cùng một yêu cầu sẽ không ghi trùng. '+(error.message||''),'error');
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
  if(!skipped&&!String(typed).trim()){
    notice('Hãy nhập tiếng Anh hoặc chọn “Không nhớ · xem đáp án”.','error');
    $('ws28Answer').focus();
    return;
  }
  const grade=gradeRecall(typed,word.english);
  pendingAttempt={word,correct:skipped?false:grade.correct,confirmed:false};
  saveAttempt();
}
async function startPractice(){
  if(saving||!actorId)return;
  try{
    const auth=await learningApi('auth/me');
    if(auth.actor?.role!=='player'||auth.actor.id!==actorId){
      await loadAccount();
      notice('Tài khoản thay đổi. Hãy chọn phiên luyện mới.','error');return;
    }
    const settings=allFilters();
    quiz=selectRecallWords(library,settings);
    index=0;correctCount=0;confirmedCount=0;
    if(!quiz.length){
      noWords(deepLink?
        'Từ bạn chọn không có trong sổ của tài khoản hiện tại.':
        'Chưa có từ phù hợp. Thử nhóm “Tất cả từ từng sai” hoặc bỏ bộ lọc game.');
      notice('Chưa tìm thấy thẻ để mở phiên luyện.');
      return;
    }
    $('ws28NoWords').hidden=true;
    view('Play');
    renderQuestion();
  }catch(error){notice(error.message||'Chưa mở được phiên luyện.','error')}
}
function showSummary(partial=false){
  view('Done');
  $('ws28CorrectCount').textContent=String(correctCount);
  $('ws28DoneTotal').textContent=String(confirmedCount);
  $('ws28DoneTitle').textContent=partial?'Đã lưu kết quả những từ vừa luyện':'Bạn đã hoàn thành phiên luyện!';
  $('ws28DoneMessage').textContent=partial
    ?'Bạn có thể luyện tiếp bất kỳ lúc nào. Những lượt đã lưu không bị mất.'
    :'Đã lưu '+confirmedCount+' lượt ôn vào PostgreSQL. Nhớ đúng '+correctCount+' từ, còn '+
      (confirmedCount-correctCount)+' từ cần luyện thêm. Lịch My Learning lấy từ cùng lịch sử này.';
  notice('Phiên ôn đã kết thúc. Tiến độ được lưu theo tài khoản.','success');
}
async function validateIdentity(){
  if(!actorId||document.hidden)return;
  try{
    const response=await learningApi('auth/me');
    if(response.actor?.role!=='player'||response.actor.id!==actorId){
      await loadAccount();
      notice('Tài khoản đã thay đổi; đã làm mới phiên luyện.','error');
    }
  }catch{
    // Transient mobile network failures must not erase unsaved typed text.
  }
}
function boot(){
  $('ws28StartForm').addEventListener('submit',event=>{
    event.preventDefault();startPractice();
  });
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
    if(saving||pendingAttempt&&!pendingAttempt.confirmed)return;
    showSummary(true);
  });
  $('ws28Again').addEventListener('click',()=>{
    // A one-word deep link is a launch intent, not permanent session storage.
    if(deepLink)window.history.replaceState(null,'',window.location.pathname);
    window.location.assign('/practice.html');
  });
  window.addEventListener('focus',validateIdentity);
  window.addEventListener('pageshow',event=>{if(event.persisted)validateIdentity()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)validateIdentity()});
  loadAccount();
}
if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
