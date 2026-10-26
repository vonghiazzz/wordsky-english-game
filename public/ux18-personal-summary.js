import {learningApi} from './ux10-account-core.js';
const status=document.getElementById('ws18AccountSummary');
if(status){
 async function update(){
  try{
   const auth=await learningApi('auth/me');
   if(auth.actor?.role!=='player'){status.textContent='Đăng nhập để xem từ vựng cá nhân được lưu trong tài khoản.';return}
   const data=await learningApi('learning/personal');
   if(data.scope!=='personal-account'||!Array.isArray(data.words)||!Array.isArray(data.progress))throw Error('Dữ liệu không hợp lệ');
   const known=new Set(data.progress.filter(w=>w.remembered===true).map(w=>w.personal_word_id));
   const total=data.words.length,remembered=data.words.filter(w=>known.has(w.id)).length;
   status.textContent='Từ cá nhân trong tài khoản: '+remembered+' đã nhớ / '+total+' từ. Dữ liệu này theo tài khoản, không theo trình duyệt.';
  }catch(e){status.textContent='Từ cá nhân theo tài khoản chưa tải được: '+e.message+'. Tiến độ trên thiết bị vẫn được giữ nguyên.'}
 }
 update();window.addEventListener('focus',update);
}
