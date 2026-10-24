import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import handler from '../api/index.js';
import {issueSession} from '../lib/security.js';

const runId='67676767-6767-4767-8767-676767676767';
const runB='67676767-6767-4767-8767-676767676768';
const runC='67676767-6767-4767-8767-676767676769';
const topicId='32323232-3232-4323-8323-323232323232';
const secret='bomb-solo-test-secret-123456789012345678901';
const words=Array.from({length:40},(_,i)=>({id:`45454545-4545-4454-8454-${String(i).padStart(12,'0')}`,topic_id:topicId,english:'bombword'+i,meaning:'nghĩa bom '+i,ipa:'',example:'',translation:'',cefr_level:'A1',cefr_review_status:'APPROVED'}));
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
const attempt=n=>`89898989-8989-4898-8898-${String(n).padStart(12,'0')}`;
const resetHarness=(ids=[runId])=>{enabled=true;rateCount=0;stored=null;runs=new Map();insertIds=[...ids];log=[]};

pg.Pool.prototype.connect=async function(){
 return {async query(text,params=[]){
  log.push(text);
  if(text.startsWith('SELECT enabled FROM ws_features WHERE feature_key='))return {rows:[{enabled}]};
  if(text.startsWith('SELECT id FROM ws_topics'))return {rows:[{id:topicId}]};
  if(text.startsWith('SELECT id,english,meaning FROM ('))return {rows:words};
  if(text.startsWith('SELECT count(*)::int AS n FROM ws_solo_runs WHERE client_fingerprint_hash='))return {rows:[{n:rateCount}]};
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
pg.Pool.prototype.query=async function(text,params=[]){const client=await this.connect();try{return await client.query(text,params)}finally{client.release()}};

async function request(method,path,{body={},cookie}={}){
 const result={headers:{}};
 const req={method,url:'/api/'+path,query:{rest:path},body,headers:cookie?{cookie}:{},socket:{remoteAddress:'127.0.0.1'}};
 const res={statusCode:200,setHeader(k,v){result.headers[k.toLowerCase()]=v;},end(raw){result.status=this.statusCode;result.data=JSON.parse(raw);}};
 await handler(req,res);return result;
}
const start=async(body={topic_id:topicId,difficulty:'EASY',question_count:8,duration_seconds:90},{cookie,reset=true}={})=>{
 if(reset)resetHarness();
 const response=await request('POST','solo/bomb/start',{body,cookie});
 return {response,cookie:response.headers['set-cookie']?.split(';')[0]};
};
const cookiePayload=cookie=>{const value=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));return JSON.parse(Buffer.from(value.split('.')[0],'base64url').toString())};

test('guest starts BOMB defaults without login and never receives English answers',async()=>{
 const {response}=await start({});
 assert.equal(response.status,201);assert.equal(response.data.round.mode,'BOMB');assert.equal(response.data.round.difficulty,'EASY');
 assert.equal(response.data.round.question_count,8);assert.equal(response.data.round.duration_seconds,90);
 assert.deepEqual({fall:response.data.round.bomb_fall_seconds,batch:response.data.round.bomb_batch_size,interval:response.data.round.bomb_spawn_interval_seconds},{fall:20,batch:2,interval:10});
 assert.equal(response.data.game.mode,'BOMB');assert.equal(response.data.game.health,3);assert.equal(response.data.game.bombs.length,2);
 assert.ok(response.data.game.bombs.every(b=>!Object.hasOwn(b,'english')));
 assert.doesNotMatch(JSON.stringify(response.data),/bombword/i);
 assert.match(response.headers['set-cookie'],/^ws_solo=/);
 assert.doesNotMatch(response.headers['set-cookie'],/; Secure/);
});

test('EASY, NORMAL and HARD use engine presets, batch waves and valid total duration',async()=>{
 const cases={EASY:[20,2,10,50],NORMAL:[16,2,9,43],HARD:[10,3,6,22]};
 for(const [difficulty,[fall,batch,interval,minDuration]] of Object.entries(cases)){
  const {response}=await start({topic_id:topicId,difficulty,question_count:8,duration_seconds:90});
  assert.equal(response.status,201);assert.equal(response.data.round.bomb_fall_seconds,fall);assert.equal(response.data.round.bomb_batch_size,batch);assert.equal(response.data.round.bomb_spawn_interval_seconds,interval);
  const bombs=stored.state.bombs;assert.equal(bombs.length,8);assert.equal(bombs[0].spawnAt,bombs[batch-1].spawnAt);assert.equal(bombs[batch].spawnAt-bombs[0].spawnAt,interval*1000);
  assert.ok(90>=minDuration);assert.ok(bombs.every(b=>b.deadline-b.spawnAt===fall*1000));
 }
 const tooShort=await start({topic_id:topicId,difficulty:'HARD',question_count:8,duration_seconds:20});
 assert.equal(tooShort.response.status,400);assert.match(tooShort.response.data.error,/không đủ/);
});

test('partial or wrong auto input is not penalized, while a full active word scores 100',async()=>{
 const {cookie}=await start();
 const partial=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{attemptId:attempt(1),answer:'bomb',auto:true}});
 assert.equal(partial.status,200);assert.equal(partial.data.result.correct,false);assert.equal(partial.data.game.health,3);assert.equal(partial.data.game.score,0);assert.equal(partial.data.game.mistakes,0);
 runs.get(runId).state.lastBombAutoAt=0;
 const word=runs.get(runId).state.bombs.find(b=>b.spawnAt<=Date.now()).english;
 const correct=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{attemptId:attempt(2),answer:word.toUpperCase(),auto:true}});
 assert.equal(correct.status,200);assert.equal(correct.data.result.correct,true);assert.equal(correct.data.game.score,100);assert.equal(correct.data.game.correct,1);assert.equal(correct.data.game.health,3);
});

test('lost response, retry and concurrent double-submit apply one BOMB answer once',async()=>{
 const {cookie}=await start();const word=stored.state.bombs[0].english;
 const body={attemptId:attempt(3),answer:word,auto:true};
 const first=await request('POST',`solo/runs/${runId}/answer`,{cookie,body});
 assert.equal(first.status,200);assert.equal(first.data.game.score,100);
 const lookup=await request('GET',`solo/runs/${runId}/attempts/${body.attemptId}`,{cookie});
 assert.equal(lookup.status,200);assert.equal(lookup.data.attempt.applied,true);assert.equal(lookup.data.result.correct,true);
 const retry=await request('POST',`solo/runs/${runId}/answer`,{cookie,body});
 assert.equal(retry.status,200);assert.equal(retry.data.duplicate,true);assert.equal(retry.data.game.score,100);assert.equal(retry.data.game.correct,1);
 const changed=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{...body,answer:'different'}});
 assert.equal(changed.status,409);assert.equal(runs.get(runId).state.score,100);
 assert.ok(log.some(sql=>sql.includes('FOR UPDATE')));
});

test('BOMB retry survives JSONB key reordering',async()=>{
 const {cookie}=await start();
 const word=stored.state.bombs[0].english;
 const body={attemptId:attempt(7),answer:word,auto:true};
 const path=`solo/runs/${runId}/answer`;

 const first=await request('POST',path,{cookie,body});
 assert.equal(first.status,200);

 const receipt=runs.get(runId).state.answerReceipts[body.attemptId];
 receipt.content={auto:receipt.content.auto,answer:receipt.content.answer};

 const retry=await request('POST',path,{cookie,body});
 assert.equal(retry.status,200,JSON.stringify(retry.data));
 assert.equal(retry.data.duplicate,true);
 assert.equal(retry.data.game.score,100);
 assert.equal(retry.data.game.correct,1);

 const changed=await request('POST',path,{
  cookie,body:{...body,answer:'different'}
 });
 assert.equal(changed.status,409);
});

test('automatic input is throttled and cannot target a bomb by id',async()=>{
 const {cookie}=await start();
 const a=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{attemptId:attempt(4),answer:'guess-one',auto:true}});assert.equal(a.status,200);
 const fast=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{attemptId:attempt(5),answer:'guess-two',auto:true}});assert.equal(fast.status,429);
 runs.get(runId).state.lastBombAutoAt=0;
 const targeted=await request('POST',`solo/runs/${runId}/answer`,{cookie,body:{attemptId:attempt(6),answer:stored.state.bombs[0].english,auto:true,bombId:stored.state.bombs[0].id}});
 assert.equal(targeted.status,400);
});

test('reconcile produces FAILED, TIMEOUT and COMPLETED without trusting the client clock',async()=>{
 let started=await start({topic_id:topicId,difficulty:'EASY',question_count:3,duration_seconds:60});
 for(const bomb of runs.get(runId).state.bombs){bomb.spawnAt=Date.now()-2000;bomb.deadline=Date.now()-1}
 const failed=await request('GET',`solo/runs/${runId}`,{cookie:started.cookie});assert.equal(failed.status,200);assert.equal(failed.data.game.status,'FAILED');assert.equal(failed.data.game.health,0);assert.equal(failed.data.game.mistakes,3);

 started=await start({topic_id:topicId,difficulty:'EASY',question_count:3,duration_seconds:60});
 runs.get(runId).state.endsAt=Date.now()-1;for(const bomb of runs.get(runId).state.bombs)bomb.deadline=Date.now()+10000;
 const timeout=await request('GET',`solo/runs/${runId}`,{cookie:started.cookie});assert.equal(timeout.data.game.status,'TIMEOUT');

 started=await start({topic_id:topicId,difficulty:'EASY',question_count:3,duration_seconds:60});
 for(const bomb of runs.get(runId).state.bombs){bomb.spawnAt=Date.now()-100;bomb.deadline=Date.now()+10000}
 for(let i=0;i<3;i++){
  const live=runs.get(runId).state;live.lastBombAutoAt=0;const bomb=live.bombs.find(item=>item.status==='WAITING');
  const out=await request('POST',`solo/runs/${runId}/answer`,{cookie:started.cookie,body:{attemptId:attempt(20+i),answer:bomb.english,auto:true}});
  assert.equal(out.status,200);if(i===2){assert.equal(out.data.game.status,'COMPLETED');assert.equal(out.data.game.correct,3)}
 }
});

test('stable signed guest identity resumes multiple BOMB runs across tabs and rejects forgery or expiry',async()=>{
 resetHarness([runId,runB,runC]);
 const a=await start(undefined,{reset:false});const b=await start(undefined,{cookie:a.cookie,reset:false});
 assert.equal(cookiePayload(a.cookie).token,cookiePayload(b.cookie).token);
 assert.equal((await request('GET',`solo/runs/${runId}`,{cookie:b.cookie})).status,200);
 assert.equal((await request('GET',`solo/runs/${runB}`,{cookie:b.cookie})).status,200);
 const other=await start(undefined,{reset:false});assert.notEqual(cookiePayload(other.cookie).token,cookiePayload(a.cookie).token);
 assert.equal((await request('GET',`solo/runs/${runId}`,{cookie:other.cookie})).status,401);
 assert.equal((await request('GET',`solo/runs/${runId}`,{cookie:a.cookie+'x'})).status,401);
 const expired='ws_solo='+issueSession({role:'guest',scope:'solo',token:cookiePayload(a.cookie).token},secret,-1);
 assert.equal((await request('GET',`solo/runs/${runId}`,{cookie:expired})).status,401);
});

test('BOMB has its own feature gate and Solo persistence does not touch XP or leaderboard tables',async()=>{
 resetHarness();enabled=false;
 assert.equal((await request('POST','solo/bomb/start',{body:{difficulty:'EASY',question_count:8,duration_seconds:90}})).status,403);
 enabled=true;await start();
 const sqlText=log.join('\n');assert.doesNotMatch(sqlText,/INSERT INTO ws_runs|UPDATE ws_users|ws_checkins|ws_participants|total_score/i);
 assert.ok(log.some(sql=>sql.startsWith('INSERT INTO ws_solo_runs')));
});

test.after(()=>{
 pg.Pool.prototype.connect=originalConnect;pg.Pool.prototype.query=originalQuery;
 for(const [key,value] of Object.entries(originalEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
