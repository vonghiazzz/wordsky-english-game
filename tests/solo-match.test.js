import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import handler from '../api/index.js';
import {issueSession} from '../lib/security.js';

const runId='77777777-7777-4777-8777-777777777777';
const runB='77777777-7777-4777-8777-777777777778';
const runC='77777777-7777-4777-8777-777777777779';
const topicId='33333333-3333-4333-8333-333333333333';
const secret='solo-test-session-secret-12345678901234567890';
const words=Array.from({length:12},(_,i)=>({id:`44444444-4444-4444-8444-${String(i).padStart(12,'0')}`,topic_id:topicId,english:'word'+i,meaning:'nghĩa '+i,ipa:'',example:'',translation:'',cefr_level:'A1',cefr_review_status:'APPROVED'}));
const originalConnect=pg.Pool.prototype.connect;
const originalQuery=pg.Pool.prototype.query;
const originalEnv={DATABASE_URL:process.env.DATABASE_URL,SESSION_SECRET:process.env.SESSION_SECRET,APP_ORIGIN:process.env.APP_ORIGIN};
process.env.DATABASE_URL='postgres://test:test@localhost:5432/test';
process.env.SESSION_SECRET=secret;
delete process.env.APP_ORIGIN;

let enabled=true;
let stored=null;
let runs=new Map();
let insertIds=[runId];
let log=[];
let rateCount=0;
const attempt=n=>`99999999-9999-4999-8999-${String(n).padStart(12,'0')}`;
const resetHarness=(ids=[runId])=>{enabled=true;rateCount=0;stored=null;runs=new Map();insertIds=[...ids];log=[]};

pg.Pool.prototype.connect=async function(){
 return {async query(text,params=[]){
  log.push(text);
  if(text.startsWith('SELECT session_version FROM public.ws_users WHERE id='))return {rows:[{session_version:0}]};
  if(text.startsWith('SELECT enabled FROM ws_features WHERE feature_key='))return {rows:[{enabled}]};
  if(text.startsWith('SELECT t.id,t.title,t.enabled,'))return {rows:[{id:topicId,title:'School',enabled:true,word_count:12,approved_a2:12,approved_bonus:0,approved_double:0}]};
  if(text.startsWith('SELECT id,title,enabled FROM ws_topics'))return {rows:[{id:topicId,title:'School',enabled:true}]};
  if(text.startsWith('SELECT id,topic_id,english,meaning'))return {rows:words};
  if(text.startsWith('SELECT count(*)::int AS n FROM ws_solo_runs WHERE client_fingerprint_hash='))return {rows:[{n:rateCount}]};
  if(text.startsWith('SELECT id FROM ws_topics'))return {rows:[{id:topicId}]};
  if(text.startsWith('SELECT id,english,meaning FROM ('))return {rows:words};
  if(text.startsWith('INSERT INTO ws_solo_runs')){
   const id=insertIds.shift()||runId;
   const record={id,user_id:params[0],access_token_hash:params[1],client_fingerprint_hash:params[2],mode:params[3],topic_id:params[4],difficulty:params[5],duration_seconds:params[6],question_count:params[7],points_per_correct:params[8],penalty:params[9],state:JSON.parse(params[15])};
   runs.set(id,record);stored=record;return {rows:[{id}]};
  }
  if(text.startsWith('SELECT id,user_id,access_token_hash')){const record=runs.get(params[0]);return {rows:record?[structuredClone(record)]:[]};}
  if(text.startsWith('UPDATE ws_solo_runs SET state=')){const record=runs.get(params[6]);if(record)record.state=JSON.parse(params[0]);stored=record||stored;return {rows:[],rowCount:record?1:0};}
  return {rows:[],rowCount:1};
 },release(){}};
};
pg.Pool.prototype.query=async function(text,params=[]){
 const client=await this.connect();
 try{return await client.query(text,params)}finally{client.release()}
};

async function request(method,path,{body={},cookie}={}){
 const result={headers:{}};
 const req={method,url:'/api/'+path,query:{rest:path},body,headers:cookie?{cookie}:{},socket:{remoteAddress:'127.0.0.1'}};
 const res={statusCode:200,setHeader(k,v){result.headers[k.toLowerCase()]=v;},end(raw){result.status=this.statusCode;result.data=JSON.parse(raw);}};
 await handler(req,res);return result;
}
const start=async(body={topic_id:topicId,difficulty:'EASY',question_count:3,duration_seconds:60},{cookie,reset=true}={})=>{
 if(reset)resetHarness();
 const response=await request('POST','solo/match/start',{body,cookie});
 return {response,cookie:response.headers['set-cookie']?.split(';')[0]};
};
const cookiePayload=cookie=>{
 const tokenValue=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));
 return JSON.parse(Buffer.from(tokenValue.split('.')[0],'base64url').toString());
};

test('guest defaults to EASY, 6 pairs, 90 seconds and receives only public pair state',async()=>{
 const {response}=await start({});
 assert.equal(response.status,201);assert.equal(response.data.round.mode,'MATCH');assert.equal(response.data.round.difficulty,'EASY');
 assert.equal(response.data.round.question_count,6);assert.equal(response.data.round.duration_seconds,90);
 assert.equal(response.data.game.pairs.length,6);assert.equal(response.data.game.rightOptions.length,6);
 assert.ok(response.data.game.pairs.every(pair=>!Object.hasOwn(pair,'meaning')&&!Object.hasOwn(pair,'rightId')));
 assert.ok(response.data.game.rightOptions.every(option=>!Object.hasOwn(option,'english')));
 assert.match(response.headers['set-cookie'],/^ws_solo=/);assert.ok(log.some(sql=>sql.startsWith('INSERT INTO ws_solo_runs')));
});

test('public topics stay metadata-only while authenticated Admin gets full vocabulary',async()=>{
 resetHarness();
 const publicOut=await request('GET','topics');
 assert.equal(publicOut.status,200);assert.equal(publicOut.data.topics[0].word_count,12);assert.equal(Object.hasOwn(publicOut.data.topics[0],'words'),false);
 assert.equal((await request('GET','admin/topics')).status,401);
 const adminCookie='ws_auth='+issueSession({role:'admin',id:'owner'},secret,60);
 const adminOut=await request('GET','admin/topics',{cookie:adminCookie});
 assert.equal(adminOut.status,200);assert.equal(adminOut.data.topics[0].words.length,12);assert.equal(adminOut.data.topics[0].words[0].english.length>0,true);
});

test('EASY, NORMAL and HARD expose 0, 2 and 4 distractors',async()=>{
 for(const [difficulty,extra] of Object.entries({EASY:0,NORMAL:2,HARD:4})){
  const {response}=await start({topic_id:topicId,difficulty,question_count:6,duration_seconds:90});
  assert.equal(response.status,201);assert.equal(response.data.game.pairs.length,6);assert.equal(response.data.game.rightOptions.length,6+extra);
 }
});

test('lost response retry uses one receipt and never applies a second penalty',async()=>{
 const {cookie}=await start();const [left,other]=stored.state.pairs;
 const body={attemptId:attempt(1),leftId:left.id,rightId:other.rightId,score:999999,health:99,correct:99};
 const first=await request('POST',`solo/runs/${runId}/answer`,{cookie,body});
 assert.equal(first.status,200);assert.equal(first.data.game.health,2);assert.equal(first.data.game.mistakes,1);
 const lookup=await request('GET',`solo/runs/${runId}/attempts/${body.attemptId}`,{cookie});
 assert.equal(lookup.status,200);assert.equal(lookup.data.attempt.applied,true);assert.equal(lookup.data.result.correct,false);assert.equal(lookup.data.game.health,2);
 const retry=await request('POST',`solo/runs/${runId}/answer`,{cookie,body});
 assert.equal(retry.status,200);assert.equal(retry.data.duplicate,true);assert.equal(retry.data.game.health,2);assert.equal(retry.data.game.mistakes,1);
 assert.ok(log.some(sql=>sql.includes('FOR UPDATE')),'row lock is required for concurrent retries');
});

test('an attemptId cannot be replayed for a different intentional action',async()=>{
 const {cookie}=await start();const [left,other]=stored.state.pairs;
 const first={attemptId:attempt(2),leftId:left.id,rightId:other.rightId};
 assert.equal((await request('POST',`solo/runs/${runId}/answer`,{cookie,body:first})).data.game.health,2);
 const forged=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{...first,rightId:left.rightId}});
 assert.equal(forged.status,409);assert.match(forged.data.error,/thao tác khác/);assert.equal(runs.get(runId).state.health,2);
 const missing=await request('GET',`solo/runs/${runId}/attempts/${attempt(99)}`,{cookie});
 assert.equal(missing.status,200);assert.equal(missing.data.attempt.applied,false);assert.equal(missing.data.game.health,2);
});

test('three new intentional wrong attempts consume three lives and end the run',async()=>{
 const {cookie}=await start();const [left,other]=stored.state.pairs;
 for(let i=1;i<=3;i++){
  const out=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{attemptId:attempt(10+i),leftId:left.id,rightId:other.rightId}});
  assert.equal(out.data.game.health,3-i);if(i===3)assert.equal(out.data.game.status,'FAILED');
 }
});

test('matching every pair completes a run and GET reconciles an expired timer',async()=>{
 let started=await start();
 for(let i=0;i<3;i++){
  const pair=stored.state.pairs.find(p=>!p.matched);
  const out=await request('POST',`solo/runs/${runId}/answer`,{cookie:started.cookie,body:{attemptId:attempt(20+i),leftId:pair.id,rightId:pair.rightId}});
  if(i===2){assert.equal(out.data.game.status,'COMPLETED');assert.equal(out.data.game.correct,3)}
 }
 started=await start();stored.state.endsAt=Date.now()-1;
 const timedOut=await request('GET','solo/runs/'+runId,{cookie:started.cookie});
 assert.equal(timedOut.status,200);assert.equal(timedOut.data.game.status,'TIMEOUT');
});

test('stable guest cookie resumes old and new runs across tabs but rejects another guest',async()=>{
 resetHarness([runId,runB,runC]);
 const a=await start(undefined,{reset:false});const identityA=cookiePayload(a.cookie);
 const b=await start(undefined,{cookie:a.cookie,reset:false});const identityB=cookiePayload(b.cookie);
 assert.equal(identityA.token,identityB.token);assert.equal(Object.hasOwn(identityB,'id'),false);
 assert.equal((await request('GET','solo/runs/'+runId,{cookie:b.cookie})).status,200);
 assert.equal((await request('GET','solo/runs/'+runB,{cookie:b.cookie})).status,200);
 const other=await start(undefined,{reset:false});
 assert.notEqual(cookiePayload(other.cookie).token,identityA.token);
 assert.equal((await request('GET','solo/runs/'+runId,{cookie:other.cookie})).status,401);
 assert.equal((await request('GET','solo/runs/'+runC,{cookie:b.cookie})).status,401);
});

test('guest cookie is HttpOnly, SameSite Strict, Secure on HTTPS, tamper-proof and expiring',async()=>{
 const previous=process.env.APP_ORIGIN;process.env.APP_ORIGIN='https://preview.wordsky.example';
 try{
  const {response,cookie}=await start();const full=response.headers['set-cookie'];
  assert.match(full,/HttpOnly/);assert.match(full,/SameSite=Strict/);assert.match(full,/; Secure/);assert.match(full,/Max-Age=2592000/);
  assert.equal((await request('GET','solo/runs/'+runId,{cookie:cookie+'x'})).status,401);
  const payload=cookiePayload(cookie);
  const expired='ws_solo='+issueSession({role:'guest',scope:'solo',token:payload.token},secret,-1);
  assert.equal((await request('GET','solo/runs/'+runId,{cookie:expired})).status,401);
 }finally{if(previous===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previous}
});

test('signed-in player can resume without Solo cookie and auth session stays separate',async()=>{
 resetHarness();const playerId='88888888-8888-4888-8888-888888888888';
 const authCookie='ws_auth='+issueSession({role:'player',id:playerId,session_version:0},secret,60);
 const started=await request('POST','solo/match/start',{cookie:authCookie,body:{difficulty:'EASY',question_count:3,duration_seconds:60}});
 assert.equal(started.status,201);assert.equal(stored.user_id,playerId);assert.match(started.headers['set-cookie'],/^ws_solo=/);
 assert.equal((await request('GET','solo/runs/'+runId,{cookie:authCookie})).status,200);
 const soloCookie=started.headers['set-cookie'].split(';')[0];
 assert.equal((await request('GET','solo/runs/'+runId,{cookie:soloCookie})).status,401);
 const otherPlayer='ws_auth='+issueSession({role:'player',id:'88888888-8888-4888-8888-888888888889',session_version:0},secret,60);
 assert.equal((await request('GET','solo/runs/'+runId,{cookie:otherPlayer+'; '+soloCookie})).status,401);
});

test('feature gate, validation and durable start rate limit protect Solo',async()=>{
 resetHarness();enabled=false;
 assert.equal((await request('POST','solo/match/start',{body:{difficulty:'NORMAL',question_count:8,duration_seconds:90}})).status,403);
 enabled=true;assert.equal((await request('POST','solo/match/start',{body:{difficulty:'NORMAL',question_count:2,duration_seconds:90}})).status,400);
 rateCount=30;const limited=await request('POST','solo/match/start',{body:{difficulty:'EASY',question_count:6,duration_seconds:90}});
 assert.equal(limited.status,429);assert.match(limited.data.error,/15 phút/);assert.ok(log.some(sql=>sql.startsWith('SELECT pg_advisory_xact_lock')));
});

test('Solo persistence never writes tournament runs, XP, streak or leaderboards',async()=>{
 await start();const sqlText=log.join('\n');assert.doesNotMatch(sqlText,/INSERT INTO ws_runs|UPDATE ws_users|ws_checkins|ws_participants|total_score/i);
});

test.after(()=>{
 pg.Pool.prototype.connect=originalConnect;pg.Pool.prototype.query=originalQuery;
 for(const [key,value] of Object.entries(originalEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
