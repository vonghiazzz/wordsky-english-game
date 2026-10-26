/* UX-17: account-owned Flashcards. No automatic writes to browser personal deck.
 * Account session determines owner; every save uses optimistic card version. */
import {learningApi} from './ux10-account-core.js';
const host=window.WordSkyFlashcardCatalog;
let actorId=null,rows=[],inflight=false;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function validate(rows){
 if(!Array.isArray(rows)||rows.length>5000)throw Error('Danh sách từ tài khoản không hợp lệ');
 const seen=new Set();
 for(const r of rows){
  if(!r||!UUID.test(r.id)||!Number.isInteger(r.version)||r.version<1||
     typeof r.remembered!=='boolean'||['topic','english','ipa','meaning','example','translation'].some(k=>typeof r[k]!=='string'))
    throw Error('Một thẻ từ tài khoản không hợp lệ');
  const key=r.topic+'\u0000'+r.english.toLocaleLowerCase('en');
  if(seen.has(key))throw Error('Bộ từ tài khoản có từ trùng');
  seen.add(key);
 }
 return rows;
}
async function refresh(){
 if(!host)return;
 try{
  const auth=await learningApi('auth/me');
  if(auth.actor?.role!=='player'||!auth.actor?.id){
    actorId=null;rows=[];host.clearAccountCatalog();return;
  }
  if(actorId && actorId!==auth.actor.id)host.clearAccountCatalog();
  actorId=auth.actor.id;
  const data=await learningApi('learning/personal-vocabulary');
  if(data.scope!=='personal-account')throw Error('Dữ liệu không đúng phạm vi tài khoản');
  rows=validate(data.cards);
  host.setAccountCatalog(rows);
 }catch(e){
  console.warn('Không thể tải bộ từ tài khoản:',e.message);
  actorId=null;rows=[];host.clearAccountCatalog();
 }
}
window.WordSkyCloudFlashcards={
 async saveRemembered(card,remembered){
  if(inflight)throw Error('Một thay đổi đang được lưu. Hãy thử lại.');
  if(!actorId||!card||!rows.some(r=>r.id===card.id))throw Error('Không có phiên học viên hợp lệ');
  inflight=true;
  try{
   const auth=await learningApi('auth/me');
   if(auth.actor?.role!=='player'||auth.actor.id!==actorId)
    throw Error('Phiên đăng nhập đã thay đổi.');
   const result=await learningApi('learning/personal-vocabulary/'+encodeURIComponent(card.id),{
    method:'PATCH',body:{topic:card.topic,english:card.english,ipa:card.ipa,meaning:card.meaning,
      example:card.example,translation:card.translation,remembered,
      expected_version:card.version,expected_actor_id:actorId}
   });
   if(result.scope!=='personal-account'||result.card?.id!==card.id)
    throw Error('Máy chủ chưa xác nhận kết quả');
   const next=result.card;
   const at=rows.findIndex(r=>r.id===card.id);
   if(at>=0)rows[at]=next;
   host.updateAccountCard(next);
   return next;
  }finally{inflight=false}
 }
};
window.addEventListener('focus',()=>{if(!inflight)refresh()});
refresh();
