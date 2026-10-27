/* Account personal Flashcards are server-owned and never write to browser-local
 * wordsky_learned or wordsky_server_learned_v1. */
import {learningApi,postUnifiedAccountReview} from './ux10-account-core.js';
const host=window.WordSkyFlashcardCatalog;
if(host){
 let loadedActorId=null;
 let sharedVersions=new Map(),personalVersions=new Map();
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
       loadedActorId=null;sharedVersions.clear();personalVersions.clear();host.clearAccountCatalog();host.setAccountMode(false);
       describe('Đăng nhập học viên để xem bộ từ cá nhân được lưu theo tài khoản.');
       return;
     }
     const id=auth.actor.id;
     // Clear prior account data before loading a new actor.
     if(loadedActorId && id!==loadedActorId)host.clearAccountCatalog();
     loadedActorId=id;
     const [data,shared]=await Promise.all([
       learningApi('learning/personal'),learningApi('learning/flashcards/progress')
     ]);
     if(data.scope!=='personal-account'||!Array.isArray(data.words)||!Array.isArray(data.progress)||
        shared.scope!=='account'||!Array.isArray(shared.words))
       throw Error('Dữ liệu từ vựng và tiến độ tài khoản không hợp lệ');
     const latest=await learningApi('auth/me');
     if(latest.actor?.role!=='player'||latest.actor.id!==id)
       throw Error('Phiên đăng nhập đã thay đổi khi tải dữ liệu học tập.');
     const pref=(()=>{try{return localStorage.getItem('wordsky_flashcard_source_v1')}catch{return null}})();
     host.setAccountCatalog(data,{activate:pref==='account'});
     host.setAccountSharedProgress(shared.words);
     sharedVersions=new Map(shared.words.map(x=>[x.word_id,x.review_count]));
     personalVersions=new Map(data.progress.map(x=>[x.personal_word_id,x.review_count]));
     host.setSharedReviewer(async wordId=>{
       const active=await learningApi('auth/me');
       if(active.actor?.role!=='player'||active.actor.id!==id)
         throw Error('Phiên đăng nhập đã thay đổi. Không ghi sang tài khoản khác.');
       let saved;
       try{
        saved=await postUnifiedAccountReview('shared',wordId,true,id,sharedVersions.get(wordId)??0);
       }catch(e){if(e.status===409)await sync();throw e;}
       sharedVersions.set(wordId,saved.version);
       if(saved.scope!=='account-review'||saved.source!=='shared'||saved.word_id!==wordId||saved.remembered!==true)
         throw Error('Máy chủ chưa xác nhận tiến độ từ chung');
       return saved;
     });
     host.setAccountReviewer(async wordId=>{
       // Re-check the identity immediately before the write.
       const active=await learningApi('auth/me');
       if(active.actor?.role!=='player'||active.actor.id!==id)
         throw Error('Phiên đăng nhập đã thay đổi. Không ghi sang tài khoản khác.');
       let saved;
       try{
        saved=await postUnifiedAccountReview('personal',wordId,true,id,personalVersions.get(wordId)??0);
       }catch(e){if(e.status===409)await sync();throw e;}
       personalVersions.set(wordId,saved.version);
       if(saved.scope!=='account-review'||saved.source!=='personal'||saved.word_id!==wordId||saved.remembered!==true)
         throw Error('Chưa xác nhận được trạng thái đã nhớ');
       return saved;
     });
     host.setAccountMode(true);
     describe('Đã đồng bộ kho từ chung và '+data.words.length+' thẻ của tôi theo tài khoản WordSky.');
   }catch(e){
     host.clearAccountCatalog();
     sharedVersions.clear();personalVersions.clear();
     if(loadedActorId)host.setAccountMode(true);
     describe('Chưa tải được tiến độ tài khoản: '+e.message+
       '. Dữ liệu trên thiết bị vẫn được giữ nguyên, nhưng không được tính là đã đồng bộ.',true);
   }finally{syncing=false}
 }
 window.addEventListener('focus',sync);
 sync();
}
