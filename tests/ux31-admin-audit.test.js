import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAdminUsersService} from '../lib/admin-users-service.js';

const request={headers:{origin:'http://localhost:3000'}};
const goodActor={role:'admin',username:'owner',id:'owner'};
function fixture(actor=goodActor){
 const calls=[];
 const db={
  connect:async()=>({query:async()=>({rows:[]}),release(){}}),
  query:async (sql,params=[])=>{
   calls.push({sql,params});
   if(sql.includes('SELECT a.id::text AS id,a.admin_username'))
    return {rows:[{id:'a0',admin_username:'owner',target_username:'learner_31',
     created_at:'2026-10-30T06:00:00.000Z'}]};
   if(sql.includes('count(*)::int AS total FROM public.ws_admin_password_reset_audit'))
    return {rows:[{total:1}]};
   throw Error('Unexpected query: '+sql);
  }
 };
 const api=createAdminUsersService({
  db,requireAdmin:async()=>actor,verifyAdminPassword:async()=>true,
  hashPassword:()=>'',verifyPassword:()=>false,expectedOrigin:'http://localhost:3000'
 });
 return {api,calls};
}

test('UX31 Admin sees paginated audit history and safe whitelisted fields',async()=>{
 const {api,calls}=fixture();
 const result=await api.listResetHistory(request,{q:'learner_31',page:1,size:10});
 assert.equal(result.total,1);
 assert.equal(result.page,1);
 assert.equal(result.size,10);
 assert.equal(result.events[0].target_username,'learner_31');
 assert.equal(result.events[0].admin_username,'owner');
 assert.ok(result.events[0].created_at);
 assert.ok(calls[0].sql.includes('ORDER BY a.created_at DESC,a.id DESC'));
 assert.deepEqual(calls[0].params,['learner_31',10,10]);
 assert.deepEqual(calls[1].params,['learner_31']);
 assert.equal(calls.length,2);
 assert.doesNotMatch(calls[0].sql,/password_hash|session_version|SELECT \*/i);
 assert.doesNotMatch(JSON.stringify(result),/password_hash|new_password|admin_password|session_version/);
});
test('UX31 guest and learner cannot access history or query database',async()=>{
 for(const actor of [null,{role:'player',username:'learner_31'}]){
  const {api,calls}=fixture(actor);
  await assert.rejects(()=>api.listResetHistory(request),e=>e.status===403);
  assert.equal(calls.length,0);
 }
});
test('UX31 audit pagination and search parameters fail closed',async()=>{
 const {api,calls}=fixture();
 for(const filter of [
  {q:'x'.repeat(65)},{q:123},{page:-1},{page:10001},{page:1.5},
  {size:0},{size:51},{size:1.2}
 ])await assert.rejects(()=>api.listResetHistory(request,filter),e=>e.status===400);
 assert.equal(calls.length,0);
});
test('UX31 audit UI and API remain Admin-only; no sensitive local caching',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/admin-users.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/admin-users.html',import.meta.url),'utf8');
 const service=readFileSync(new URL('../lib/admin-users-service.js',import.meta.url),'utf8');
 assert.match(api,/key==='admin\/users\/reset-history'/);
 assert.match(api,/\.listResetHistory\(req,/);
 assert.match(service,/await authorize\(req\)/);
 assert.match(html,/id="auHistorySection"[^>]*hidden/);
 assert.match(html,/id="auHistorySearch"/);
 assert.match(ui,/listResetHistory\(\)/);
 assert.match(ui,/Asia\/Ho_Chi_Minh/);
 assert.doesNotMatch(ui,/innerHTML|localStorage|sessionStorage/);
});
