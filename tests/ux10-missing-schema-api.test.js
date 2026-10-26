import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import handler from '../api/index.js';
import {issueSession} from '../lib/security.js';

const secret='ux10-release-readiness-secret-at-least-32-characters';
const original={database:process.env.DATABASE_URL,session:process.env.SESSION_SECRET,vercelEnv:process.env.VERCEL_ENV};
const originalQuery=pg.Pool.prototype.query;
process.env.DATABASE_URL='postgresql://test:test@localhost:5432/ux10_schema_missing';
process.env.SESSION_SECRET=secret;
delete process.env.VERCEL_ENV;

function request(path,cookie) {
 const req={method:'GET',url:'/api/'+path,query:{rest:path},headers:{cookie},body:{},socket:{}};
 const output={status:null,body:null};
 const res={statusCode:200,setHeader(){},end(text){output.status=this.statusCode;output.body=JSON.parse(text)}};
 return handler(req,res).then(()=>output);
}
const missingTable=Object.assign(new Error('relation "ws_learning_word_progress" does not exist'),{code:'42P01'});
pg.Pool.prototype.query=async function(){throw missingTable};
test('Production missing UX10 progress table returns fail-closed HTTP 503, not ReferenceError',async()=>{
 const cookie='ws_auth='+issueSession({role:'player',id:'00000000-0000-4000-8000-000000000001'},secret);
 const result=await request('learning/flashcards/progress',cookie);
 assert.equal(result.status,503);
 assert.deepEqual(result.body,{error:'Đồng bộ tài khoản chưa được bật trên database này.'});
 assert.doesNotMatch(JSON.stringify(result.body),/relation|postgres|schema|internal/i);
});
test('Missing table outside learning route retains generic HTTP 500',async()=>{
 const cookie='ws_auth='+issueSession({role:'admin',id:'owner'},secret);
 const result=await request('admin/features',cookie);
 assert.equal(result.status,500);
 assert.match(result.body.error,/Lỗi máy chủ/);
});
test.after(()=>{
 pg.Pool.prototype.query=originalQuery;
 for(const [key,value] of Object.entries({DATABASE_URL:original.database,SESSION_SECRET:original.session,VERCEL_ENV:original.vercelEnv})){
  if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
