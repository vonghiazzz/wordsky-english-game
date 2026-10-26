/* Account personal Flashcards are server-owned and never write to browser-local
 * wordsky_learned or wordsky_server_learned_v1. */
import {learningApi} from './ux10-account-core.js';
const host=window.WordSkyFlashcardCatalog;
if(host){
 let loadedActorId=null;
 let syncing=false;
 const notice=document.getElementById('flashAccountStatus');
 const describe=(message,warning=false)=>{
   if(notice){notice.textContent=message;notice.dataset.warning=String(warning)}
 };
 async function sync(){
   if(syncing)return;
   syncing=true;
   try{
     const auth=await learningApi('auth/me');
     if(auth.actor?.role!=='player'||!auth.actor?.id){
       loadedActorId=null;host.clearAccountCatalog();
       describe('Đăng nhập học viên để xem bộ từ cá nhân được lưu theo tài khoản.');
       return;
     }
     const id=auth.actor.id;
     // Clear prior account data before loading a new actor.
     if(loadedActorId && id!==loadedActorId)host.clearAccountCatalog();
     loadedActorId=id;
     const data=await learningApi('learning/personal');
     if(data.scope!=='personal-account'||!Array.isArray(data.words)||!Array.isArray(data.progress))
       throw Error('Dữ liệu từ cá nhân không hợp lệ');
     const pref=(()=>{try{return localStorage.getItem('wordsky_flashcard_source_v1')}catch{return null}})();
     host.setAccountCatalog(data,{activate:pref==='account'||pref===null});
     host.setAccountReviewer(async wordId=>{
       // Re-check the identity immediately before the write.
       const active=await learningApi('auth/me');
       if(active.actor?.role!=='player'||active.actor.id!==id)
         throw Error('Phiên đăng nhập đã thay đổi. Không ghi sang tài khoản khác.');
       const saved=await learningApi('learning/personal/reviews',{
         method:'POST',body:{personal_word_id:wordId,remembered:true,expected_actor_id:id}
       });
       if(saved.scope!=='personal-account'||saved.personal_word_id!==wordId||saved.remembered!==true)
         throw Error('Chưa xác nhận được trạng thái đã nhớ');
       return saved;
     });
     describe('Đã tải '+data.words.length+' thẻ cá nhân từ PostgreSQL theo tài khoản WordSky.');
   }catch(e){
     host.clearAccountCatalog();
     describe('Chưa tải được từ cá nhân theo tài khoản: '+e.message+
       '. Kho từ trên thiết bị vẫn được giữ nguyên.',true);
   }finally{syncing=false}
 }
 window.addEventListener('focus',sync);
 sync();
}
