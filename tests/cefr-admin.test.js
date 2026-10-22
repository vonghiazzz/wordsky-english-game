import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import handler from '../api/index.js';
import {issueSession} from '../lib/security.js';

const id='44444444-4444-4444-8444-444444444444';
const topicId='33333333-3333-4333-8333-333333333333';
const secret='cefr-admin-test-session-secret-at-least-32-chars';
const oldEnv={DATABASE_URL:process.env.DATABASE_URL,SESSION_SECRET:process.env.SESSION_SECRET};
process.env.DATABASE_URL='postgres://test:test@localhost:5432/test';
process.env.SESSION_SECRET=secret;
const cookie='ws_auth='+issueSession({role:'admin',id:'owner'},secret);
const originalConnect=pg.Pool.prototype.connect;
const originalQuery=pg.Pool.prototype.query;
let active=false;
let calls=[];
let state={id,topic_id:topicId,english:'student',meaning:'Sinh viên',cefr_level:null,cefr_review_status:'UNREVIEWED'};
async function mockedQuery(query,params=[]){
  calls.push({query,params});
  if(query.startsWith('SELECT id,topic_id,english,meaning,cefr_level,cefr_review_status FROM ws_words'))return {rows:[{...state}]};
  if(query.startsWith('SELECT e.id FROM ws_events'))return {rows:active?[{id:'example'}]:[]};
  if(query.startsWith('UPDATE ws_words SET cefr_level=')){
   state={...state,cefr_level:params[0],cefr_review_status:params[1]};
   return {rows:[{id,...state}],rowCount:1};
  }
  if(query.startsWith('SELECT DISTINCT ON (entity_id)'))return {rows:[]};
  if(query.startsWith('SELECT topic_id FROM ws_words WHERE id=$1 FOR UPDATE'))return {rows:[{topic_id:topicId}]};
  if(query.startsWith('UPDATE ws_words SET english='))return {rows:[{id}],rowCount:1};
  return {rows:[],rowCount:1};
}
pg.Pool.prototype.connect=async function(){return {query:mockedQuery,release(){}}};
pg.Pool.prototype.query=mockedQuery;
async function request(method,path,body=null,cookieHeader=cookie){
 const result={};
 const req={method,url:'/api/'+path,query:{rest:path},headers:{cookie:cookieHeader},body:body||{},socket:{}};
 const res={statusCode:200,setHeader(){},end(str){result.status=this.statusCode;result.body=JSON.parse(str)}};
 await handler(req,res);return result;
}
const payload={cefr_level:'A2',cefr_review_status:'APPROVED',source_url:'https://dictionary.cambridge.org/dictionary/english/student'};
test('CEFR API requires admin session and cannot touch DB without it',async()=>{
 calls=[];const res=await request('PATCH','admin/words/'+id+'/cefr',payload,'');
 assert.equal(res.status,401);assert.equal(calls.length,0);
});
test('CEFR API validates level/status and source before database access',async()=>{
 calls=[];
 const badLevel=await request('PATCH','admin/words/'+id+'/cefr',{...payload,cefr_level:'C3'});
 assert.equal(badLevel.status,400);
 const badStatus=await request('PATCH','admin/words/'+id+'/cefr',{...payload,cefr_review_status:'PUBLISHED'});
 assert.equal(badStatus.status,400);
 const noSource=await request('PATCH','admin/words/'+id+'/cefr',{...payload,source_url:''});
 assert.equal(noSource.status,400);
 const noLevel=await request('PATCH','admin/words/'+id+'/cefr',{...payload,cefr_level:null});
 assert.equal(noLevel.status,400);
 const mismatched=await request('PATCH','admin/words/'+id+'/cefr',{...payload,cefr_review_status:'UNREVIEWED'});
 assert.equal(mismatched.status,400);
 assert.equal(calls.length,0);
});
test('CEFR APPROVED saves level and review audit in same DB transaction',async()=>{
 calls=[];active=false;
 const res=await request('PATCH','admin/words/'+id+'/cefr',payload);
 assert.equal(res.status,200);assert.equal(state.cefr_level,'A2');assert.equal(state.cefr_review_status,'APPROVED');
 const audit=calls.find(x=>x.query.startsWith('INSERT INTO ws_audit'));
 assert.ok(audit,'review must be audited');
 assert.ok(audit.params.some(x=>typeof x==='string'&&x.includes(payload.source_url)),'audit must contain source URL');
 assert.ok(calls.some(x=>x.query==='COMMIT'));
});
test('CEFR cannot be edited for a topic referenced by OPEN or LIVE events',async()=>{
 calls=[];active=true;
 const res=await request('PATCH','admin/words/'+id+'/cefr',{cefr_level:null,cefr_review_status:'UNREVIEWED'});
 assert.equal(res.status,409);
 assert.equal(calls.some(x=>x.query.startsWith('UPDATE ws_words SET cefr_level=')),false);
 assert.ok(calls.some(x=>x.query==='ROLLBACK'));
 active=false;
});
test('CEFR last review sources endpoint requires admin session',async()=>{
 calls=[];let res=await request('GET','admin/cefr/reviews',null,'');
 assert.equal(res.status,401);assert.equal(calls.length,0);
 res=await request('GET','admin/cefr/reviews');
 assert.equal(res.status,200);assert.deepEqual(res.body.reviews,[]);
});
test('editing word content invalidates old CEFR approval in SQL',async()=>{
 calls=[];active=false;
 const res=await request('PATCH','admin/words/'+id,{english:'student',meaning:'Người học',ipa:'',example:'',translation:''});
 assert.equal(res.status,200);
 const update=calls.find(x=>x.query.startsWith('UPDATE ws_words SET english='));
 assert.ok(update);
 assert.match(update.query,/cefr_level=CASE WHEN english IS DISTINCT FROM/);
 assert.match(update.query,/THEN 'UNREVIEWED' ELSE cefr_review_status/);
});
test.after(()=>{
 pg.Pool.prototype.connect=originalConnect;
 pg.Pool.prototype.query=originalQuery;
 for(const [key,value] of Object.entries(oldEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;
});
