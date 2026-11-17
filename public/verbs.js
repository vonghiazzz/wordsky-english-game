import {findVerbEntries,listVerbEntries} from './verb-dictionary.js';
import {paginateVerbs,createVerbQuiz,isVerbAnswerCorrect} from './verb-practice-core.js';
const $=id=>document.getElementById(id);
const rows=$('ws47Rows'),search=$('ws47Search'),kind=$('ws47Type');
let page=1,questions=[],questionIndex=0,score=0,answered=false;
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
 $('ws48Question').textContent='V1: '+q.v1+' → '+q.target.toUpperCase()+' là gì?';
 $('ws48Meaning').textContent='Nghĩa: '+q.meaning;
 $('ws48Answer').value='';
 $('ws48Answer').disabled=false;
 $('ws48Submit').disabled=false;
 $('ws48Form').hidden=false;
 $('ws48Feedback').textContent='';
 $('ws48NextQuestion').hidden=true;
 $('ws48Answer').focus();
}
function startQuiz(){
 questions=createVerbQuiz({kind:$('ws48Kind').value});
 score=0;questionIndex=0;
 $('ws48Quiz').hidden=false;
 $('ws48Start').textContent='Làm lại 10 câu';
 showQuestion();
}
$('ws48Start').addEventListener('click',startQuiz);
$('ws48Form').addEventListener('submit',e=>{
 e.preventDefault();if(answered)return;
 const q=questions[questionIndex];
 const correct=isVerbAnswerCorrect($('ws48Answer').value,q[q.target]);
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
});
render();
