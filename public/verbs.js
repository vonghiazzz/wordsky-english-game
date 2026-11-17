import {findVerbEntries,listVerbEntries} from './verb-dictionary.js';
const $=id=>document.getElementById(id);
const rows=$('ws47Rows'),search=$('ws47Search'),kind=$('ws47Type');
let pageSize=35;
function text(tag,value,cls){
 const element=document.createElement(tag);
 if(cls)element.className=cls;
 element.textContent=value;
 return element;
}
function render(){
 const filtered=findVerbEntries(search.value,kind.value);
 $('ws47Count').textContent=filtered.length+' / '+listVerbEntries().length+' động từ';
 rows.replaceChildren();
 for(const v of filtered.slice(0,pageSize)){
  const tr=document.createElement('tr');
  tr.className='ws47-row';
  for(const value of [v.v1,v.v2,v.v3]){
   const td=document.createElement('td');
   td.append(text('strong',value));
   tr.append(td);
  }
  const meaning=document.createElement('td');
  meaning.append(text('span',v.meaning));
  tr.append(meaning);
  rows.append(tr);
 }
 $('ws47Showing').textContent='Hiển thị '+Math.min(filtered.length,pageSize)+' / '+filtered.length;
 $('ws47Empty').hidden=filtered.length!==0;
 $('ws47More').hidden=filtered.length<=pageSize;
}
search.addEventListener('input',()=>{pageSize=35;render()});
kind.addEventListener('change',()=>{pageSize=35;render()});
$('ws47More').addEventListener('click',()=>{pageSize+=50;render()});
render();
