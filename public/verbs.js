import {findVerbEntries,listVerbEntries} from './verb-dictionary.js';
import {paginateVerbs,createVerbQuiz,isVerbAnswerCorrect} from './verb-practice-core.js';
import {buildVerbMistakeSummary,buildVerbRetryQuestions} from './verb-mistake-retry.js';
import {learningApi} from './ux10-account-core.js';
const $=id=>document.getElementById(id);
const rows=$('ws47Rows'),search=$('ws47Search'),kind=$('ws47Type');
let page=1,questions=[],questionIndex=0,score=0,answered=false,attempts=[];
let actorId=null,quizActorId=null,pendingSave=null,quizMode='full';
function text(tag,value,cls){
 const element=document.createElement(tag);
 if(cls)element.className=cls;
 element.textContent=value;
 return element;
}
function render(){
 const filtered=findVerbEntries(search.value,kind.value);
 const result=paginateVerbs(filtered,page);
 page=result.page;
 $('ws47Count').textContent=filtered.length+' / '+listVerbEntries().length+' động từ';
 rows.replaceChildren();
 for(const v of result.items){
  const tr=document.createElement('tr');tr.className='ws47-row';
  for(const value of [v.v1,v.v2,v.v3]){
   const td=document.createElement('td');td.append(text('strong',value));tr.append(td);
  }
  const meaning=document.createElement('td');meaning.append(text('span',v.meaning));tr.append(meaning);
  rows.append(tr);
 }
 $('ws47Showing').textContent=result.total?'Trang '+page+' / '+result.pages+' · '+result.total+' động từ':'Không có động từ';
 $('ws47Empty').hidden=result.total!==0;
 $('ws48Prev').disabled=page<=1;
 $('ws48Next').disabled=page>=result.pages;
}
search.addEventListener('input',()=>{page=1;render()});
kind.addEventListener('change',()=>{page=1;render()});
$('ws48Prev').addEventListener('click',()=>{page--;render()});
$('ws48Next').addEventListener('click',()=>{page++;render()});
function showQuestion(){
 const q=questions[questionIndex];
 answered=false;
 $('ws48Progress').textContent='Câu '+(questionIndex+1)+' / '+questions.length;
 $('ws48Score').textContent='Đúng: '+score;
 $('ws48Question').textContent=(q.target==='v1'?'V2: '+q.v2:'V1: '+q.v1)+' → '+q.target.toUpperCase()+' là gì?';
 $('ws48Meaning').textContent='Nghĩa: '+q.meaning;
 $('ws48Answer').value='';
 $('ws48Answer').disabled=false;
 $('ws48Submit').disabled=false;
 $('ws48Form').hidden=false;
 $('ws48Feedback').textContent='';
 $('ws48NextQuestion').hidden=true;
 $('ws48Answer').focus();
}
function beginQuestions(items,mode='full'){
 questions=items;score=0;questionIndex=0;answered=false;attempts=[];
 quizActorId=actorId;quizMode=mode;pendingSave=null;
 $('ws51SaveStatus').textContent='';$('ws51RetrySave').hidden=true;
 $('ws50Results').hidden=true;
 $('ws50Retry').hidden=true;
 $('ws50Missed').replaceChildren();
 $('ws48Quiz').hidden=false;
 showQuestion();
}
function startQuiz(){
 beginQuestions(createVerbQuiz({kind:$('ws48Kind').value}));
 $('ws48Start').textContent='Làm bài mới 10 câu';
}
$('ws48Start').addEventListener('click',startQuiz);
$('ws48Form').addEventListener('submit',e=>{
 e.preventDefault();if(answered)return;
 const q=questions[questionIndex];
 const given=$('ws48Answer').value;
 const correct=isVerbAnswerCorrect(given,q[q.target]);
 attempts.push({given,correct});
 if(correct)score++;
 answered=true;
 $('ws48Feedback').textContent=(correct?'✓ Chính xác. ':'✗ Chưa đúng. ')+'Đáp án: '+q.v1+' – '+q.v2+' – '+q.v3;
 $('ws48Score').textContent='Đúng: '+score;
 $('ws48Answer').disabled=true;
 $('ws48Submit').disabled=true;
 $('ws48NextQuestion').hidden=false;
 $('ws48NextQuestion').textContent=questionIndex===questions.length-1?'Xem kết quả':'Câu tiếp theo →';
});
$('ws48NextQuestion').addEventListener('click',()=>{
 if(!answered)return;
 questionIndex++;
 if(questionIndex<questions.length){showQuestion();return}
 $('ws48Form').hidden=true;
 $('ws48Progress').textContent='Hoàn thành';
 $('ws48Question').textContent='Kết quả: '+score+'/'+questions.length+' câu đúng';
 $('ws48Meaning').textContent='Bấm “Làm lại 10 câu” để luyện tập lượt mới.';
 $('ws48Feedback').textContent='';
 $('ws48NextQuestion').hidden=true;
 void persistCompletedQuiz();
 const summary=buildVerbMistakeSummary(questions,attempts);
 $('ws50Results').hidden=false;
 $('ws50Summary').textContent=summary.correct+' / '+summary.total+' đúng · '+summary.incorrect+' câu sai.';
 const container=$('ws50Missed');
 container.replaceChildren();
 for(const mistake of summary.missed){
  const entry=text('article','', 'ws50-mistake');
  entry.append(text('strong',mistake.v1+' – '+mistake.v2+' – '+mistake.v3),
    text('span',mistake.meaning),
    text('small','Cần điền '+mistake.target.toUpperCase()+' · Bạn trả lời: '+(mistake.given||'(trống)')));
  container.append(entry);
 }
 if(summary.incorrect){
  $('ws50Retry').hidden=false;
  $('ws50Retry').onclick=()=>beginQuestions(buildVerbRetryQuestions(summary.missed),'retry');
 }else{
  container.append(text('p','Bạn đã trả lời đúng tất cả câu hỏi.','ws50-perfect'));
 }
});

// Account history is separate from SRS and only displayed after server authentication.
async function loadVerbHistory(){
 try{
  const me=await learningApi('auth/me');
  actorId=me.actor?.role==='player'?me.actor.id:null;
  if(!actorId){
   $('ws51Stats').hidden=true;
   $('ws51Status').textContent='Đăng nhập để lưu và đồng bộ kết quả giữa các thiết bị. Khách vẫn có thể luyện tập.';
   return;
  }
  const current=actorId;
  const history=await learningApi('learning/verbs/history');
  if(current!==actorId)return;
  if(history.scope!=='account-verb-practice')throw Error('Báo cáo không hợp lệ');
  $('ws51Stats').hidden=false;
  $('ws51Status').textContent='Đã đồng bộ lịch sử theo tài khoản.';
  $('ws51Totals').textContent=(history.summary.runs||0)+' lượt · '+(history.summary.correct||0)+'/'+(history.summary.questions||0)+' câu đúng';
  const weak=Array.isArray(history.weak_forms)?history.weak_forms:[];
  $('ws51Weak').textContent=weak.length?'Hay sai: '+weak.map(row=>row.v1+' ('+row.form.toUpperCase()+') '+row.mistakes+' lần').join(' · '):'Chưa có dạng động từ sai trong lịch sử.';
  const list=$('ws51Recent');list.replaceChildren();
  for(const run of history.recent.slice(0,5)){
   const item=text('li',(run.mode==='retry'?'Luyện lại':'Bài mới')+' · '+run.correct+'/'+run.total+' · '+new Date(run.completed_at).toLocaleString('vi-VN'));
   list.append(item);
  }
 }catch(error){
  $('ws51Stats').hidden=true;
  $('ws51Status').textContent='Chưa tải được tiến độ: '+error.message;
 }
}
async function persistCompletedQuiz(){
 if(!quizActorId){
  $('ws51SaveStatus').textContent='Kết quả lượt này chỉ hiển thị tại đây (chưa đăng nhập lúc bắt đầu).';
  return;
 }
 const input=pendingSave||{
  request_id:crypto.randomUUID(),expected_actor_id:quizActorId,mode:quizMode,
  answers:questions.map((q,i)=>({v1:q.v1,target:q.target,given:attempts[i].given}))
 };
 pendingSave=input;
 $('ws51SaveStatus').textContent='Đang lưu kết quả…';
 $('ws51RetrySave').hidden=true;
 try{
  const current=await learningApi('auth/me');
  if(current.actor?.id!==quizActorId||current.actor?.role!=='player')
   throw Error('Phiên đăng nhập đã thay đổi; không thể lưu vào tài khoản khác');
  const saved=await learningApi('learning/verbs/attempts',{method:'POST',body:input});
  if(saved.scope!=='account-verb-practice'||saved.request_id!==input.request_id)
   throw Error('Máy chủ chưa xác nhận lượt luyện');
  pendingSave=null;
  $('ws51SaveStatus').textContent='Đã lưu kết quả theo tài khoản.';
  await loadVerbHistory();
 }catch(error){
  $('ws51SaveStatus').textContent='Chưa lưu được: '+error.message;
  $('ws51RetrySave').hidden=false;
 }
}
$('ws51Refresh').addEventListener('click',()=>void loadVerbHistory());
$('ws51RetrySave').addEventListener('click',()=>void persistCompletedQuiz());
void loadVerbHistory();

render();
