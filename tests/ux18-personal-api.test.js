import test from 'node:test';
import assert from 'node:assert/strict';
import {issueSession} from '../lib/security.js';
import handler from '../api/index.js';

const secret='ux18-actor-pinning-sandbox-test-secret-2026',before=process.env.SESSION_SECRET;
process.env.SESSION_SECRET=secret;
const current='00000000-0000-4000-8000-000000000101',other='00000000-0000-4000-8000-000000000102';
async function request(method,path,body,role='player'){
 const req={method,query:{rest:path},url:'/api/'+path,
  headers:{cookie:'ws_auth='+issueSession({role,id:current},secret)},body,
  socket:{}};
 const result={};
 const res={statusCode:200,setHeader(){},end(value){result.status=this.statusCode;result.body=JSON.parse(value)}};
 await handler(req,res);return result;
}
test('UX18 rejects stale actor PIN for create and review before touching DB',async()=>{
 const body={expected_actor_id:other,topic:'Food',english:'apple',meaning:'Quả táo'};
 const a=await request('POST','learning/personal',body);
 assert.equal(a.status,409);assert.match(a.body.error,/Tài khoản đã thay đổi/);
 const b=await request('POST','learning/personal/reviews',{expected_actor_id:other,remembered:true,personal_word_id:current});
 assert.equal(b.status,409);
});
test('UX18 rejects stale account PATCH and DELETE before DB operations',async()=>{
 const a=await request('PATCH','learning/personal/'+current,{revision:1,expected_actor_id:other});
 assert.equal(a.status,409);
 const b=await request('DELETE','learning/personal/'+current,{revision:1,expected_actor_id:other});
 assert.equal(b.status,409);
});
test('UX18 guest user cannot access personal cards',async()=>{
 const r=await request('GET','learning/personal',{},'guest');
 assert.equal(r.status,401);
});
test.after(()=>{if(before===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=before});
