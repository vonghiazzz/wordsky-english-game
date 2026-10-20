import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';

async function request(method, path, {body, origin} = {}) {
  const result={status:0,headers:{},body:null};
  const req={method,url:'/api/'+path,query:{rest:path},body:body||{},headers:{ ...(origin?{origin}:{}) },socket:{remoteAddress:'127.0.0.1'}};
  const res={statusCode:200,setHeader(k,v){result.headers[k]=v;},end(t){result.status=this.statusCode;result.body=JSON.parse(t);}};
  await handler(req,res);
  return result;
}

test('unauthenticated admin routes refuse access without touching DB',async()=>{
  for(const [method,path] of [['GET','admin/features'],['GET','admin/events'],['POST','admin/topics'],['PATCH','admin/features/CAR']]){
    const out=await request(method,path,{body: { title:'Test',enabled:false }});
    assert.equal(out.status,401,method+' '+path);
  }
});
test('API refuses foreign-origin POST',async()=>{
  const orig=process.env.APP_ORIGIN;
  process.env.APP_ORIGIN='https://branch-preview.vercel.app';
  try { const r=await request('POST','auth/logout',{origin:'https://untrusted.example'});assert.equal(r.status,403); }
  finally { if(orig===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=orig; }
});
test('GET /api/auth/me unauthenticated returns no actor',async()=>{
  const r=await request('GET','auth/me');assert.equal(r.status,200);assert.equal(r.body.actor,null);
});
test('invalid paths return 404',async()=>{
  const r=await request('GET','does-not-exist');assert.equal(r.status,404);
});
