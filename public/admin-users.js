/* UX30: thin Admin UI. All authorization and password validation live on server. */
const $=id=>document.getElementById(id);
let page=0,total=0,selected=null,seq=0;
const SIZE=20;
async function api(path,options={}){
 const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...options});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'Yêu cầu thất bại ('+response.status+')');
 return payload;
}
function text(tag,value,cls){
 const el=document.createElement(tag);
 el.textContent=String(value??'');
 if(cls)el.className=cls;
 return el;
}
async function listUsers(){
 const ticket=++seq;
 $('auListStatus').textContent='Đang tải danh sách…';
 const filters=new URLSearchParams({q:$('auSearch').value.trim(),page:String(page),size:String(SIZE)});
 try{
  const data=await api('admin/users?'+filters);
  if(ticket!==seq)return;
  if(!Array.isArray(data.users)||!Number.isSafeInteger(data.total))
   throw Error('Dữ liệu tài khoản không hợp lệ');
  total=data.total;
  const host=$('auUsers');
  host.replaceChildren();
  for(const user of data.users){
   const line=text('article','','au-user');
   const info=text('div','');
   info.append(text('strong',user.username),text('small',user.display_name));
   const action=text('button','Đặt lại mật khẩu');
   action.type='button';
   action.addEventListener('click',()=>openReset(user));
   line.append(info,action);host.append(line);
  }
  if(!data.users.length)host.append(text('p','Không tìm thấy tài khoản phù hợp.'));
  $('auListStatus').textContent=total+' tài khoản';
  $('auPage').textContent=(page+1)+' / '+Math.max(1,Math.ceil(total/SIZE));
  $('auPrev').disabled=page===0;
  $('auNext').disabled=(page+1)*SIZE>=total;
 }catch(error){
  if(ticket!==seq)return;
  $('auUsers').replaceChildren();
  $('auListStatus').textContent='Không tải được danh sách: '+error.message;
 }
}
function openReset(user){
 if(typeof user.id!=='string'||typeof user.username!=='string')return;
 selected={id:user.id,username:user.username};
 $('auResetForm').reset();
 $('auSelected').textContent='Tài khoản: '+selected.username;
 $('auResetStatus').textContent='';
 $('auDialog').showModal();
 $('auConfirmUsername').focus();
}
$('auSearchForm').addEventListener('submit',event=>{
 event.preventDefault();page=0;listUsers();
});
$('auPrev').addEventListener('click',()=>{if(page>0){page--;listUsers()}});
$('auNext').addEventListener('click',()=>{if((page+1)*SIZE<total){page++;listUsers()}});
$('auCancel').addEventListener('click',()=>$('auDialog').close());
$('auDialog').addEventListener('close',()=>{
 selected=null;$('auResetForm').reset();$('auResetStatus').textContent='';
});
$('auResetForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!selected)return;
 const password=$('auNewPassword').value;
 const confirmation=$('auConfirmPassword').value;
 const username=$('auConfirmUsername').value;
 if(password!==confirmation){$('auResetStatus').textContent='Hai mật khẩu chưa trùng khớp.';return}
 if(username!==selected.username){$('auResetStatus').textContent='Tên tài khoản xác nhận không đúng.';return}
 if(password.length<12||password.length>128||!/[a-z]/i.test(password)||!/[0-9]/.test(password)){
  $('auResetStatus').textContent='Mật khẩu cần 12–128 ký tự và có cả chữ, số.';return;
 }
 const submit=$('auSubmit');
 submit.disabled=true;
 $('auCancel').disabled=true;
 $('auResetStatus').textContent='Đang xác nhận và lưu thay đổi…';
 try{
  const result=await api('admin/users/'+encodeURIComponent(selected.id)+'/reset-password',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({
    confirm_username:username,
    new_password:password,
    confirm_password:confirmation,
    admin_password:$('auAdminPassword').value
   })
  });
  const name=result.username;
  $('auDialog').close();
  $('auListStatus').textContent='Đã đặt lại mật khẩu cho '+name+'; phiên đăng nhập cũ không còn hợp lệ.';
  await listUsers();
  $('auListStatus').textContent='Đã đặt lại mật khẩu cho '+name+'; phiên đăng nhập cũ không còn hợp lệ.';
 }catch(error){$('auResetStatus').textContent='Chưa thay đổi mật khẩu: '+error.message}
 finally{submit.disabled=false;$('auCancel').disabled=false;$('auAdminPassword').value='';}
});
(async()=>{
 try{
  const auth=await api('auth/me');
  if(auth.actor?.role!=='admin'){
   $('auAuth').dataset.error='true';
   $('auAuth').textContent='Bạn cần đăng nhập tài khoản quản trị trong WordSky trước khi mở trang này.';
   return;
  }
  $('auAuth').hidden=true;$('auApp').hidden=false;await listUsers();
 }catch(error){
  $('auAuth').dataset.error='true';
  $('auAuth').textContent='Không xác minh được quyền quản trị: '+error.message;
 }
})();
