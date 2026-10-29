import test from 'node:test';
import assert from 'node:assert/strict';
import {issueSession} from '../lib/security.js';
import pg from 'pg';
import handler from '../api/index.js';

const priorDatabase=process.env.DATABASE_URL;
const priorQuery=pg.Pool.prototype.query;
process.env.DATABASE_URL='postgresql://wordsky_test:wordsky_test@127.0.0.1:5432/ux11_isolated';
pg.Pool.prototype.query=async(sql)=>{
 if(sql.startsWith('SELECT session_version FROM public.ws_users'))return {rows:[{session_version:0}]};
 throw Error('UX11 request tried database operation before actor pin rejection');
};
const original=process.env.SESSION_SECRET;
const secret='ux11-security-test-very-long-secret-2026';
process.env.SESSION_SECRET=secret;
const me='00000000-0000-4000-8000-000000000101';
const other='00000000-0000-4000-8000-000000000202';

test('UX11 rejects stale-account POST before any database write',async()=>{
 const request={method:'POST',url:'/api/learning/flashcards/reviews',
  query:{rest:'learning/flashcards/reviews'},
  headers:{cookie:'ws_auth='+issueSession({role:'player',id:me,session_version:0},secret)},
  body:{word_id:'00000000-0000-4000-8000-000000000111',remembered:true,expected_actor_id:other},socket:{}};
 const result={};
 const response={statusCode:200,setHeader(){},end(json){result.status=this.statusCode;result.body=JSON.parse(json)}};
 await handler(request,response);
 assert.equal(result.status,409);
 assert.match(result.body.error,/Tài khoản đã thay đổi/);
});

test.after(()=>{pg.Pool.prototype.query=priorQuery;if(priorDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=priorDatabase;if(original===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=original});
