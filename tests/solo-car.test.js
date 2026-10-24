import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import handler from '../api/index.js';

const runId='11111111-1111-4111-8111-111111111111';
const topicId='22222222-2222-4222-8222-222222222222';
const words=[];
for(const [tier,level] of [['A2','A1'],['BONUS','B1'],['DOUBLE','C1']]){
 for(let i=0;i<60;i++)words.push({id:`${tier}-${i}`,english:`${tier.toLowerCase()}term${i}`,meaning:`${tier} nghĩa ${i}`,cefr_level:level,tier});
}
const savedEnv={DATABASE_URL:process.env.DATABASE_URL,SESSION_SECRET:process.env.SESSION_SECRET,APP_ORIGIN:process.env.APP_ORIGIN};
process.env.DATABASE_URL='postgres://test:test@127.0.0.1:5432/test';
process.env.SESSION_SECRET='car-solo-test-secret-must-be-long-123456789';
delete process.env.APP_ORIGIN;
const originalConnect=pg.Pool.prototype.connect,originalQuery=pg.Pool.prototype.query;
let record=null,stock={A2:60,BONUS:60,DOUBLE:60},queryLog=[],featureEnabled=true,rateCount=0;
const attempt=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
function reset(){record=null;stock={A2:60,BONUS:60,DOUBLE:60};queryLog=[];featureEnabled=true;rateCount=0}
pg.Pool.prototype.connect=async function(){return {async query(text,params=[]){
 queryLog.push(text);
 if(text.startsWith('SELECT enabled FROM ws_features WHERE feature_key='))return {rows:[{enabled:featureEnabled}]};
 if(text.startsWith('SELECT id FROM ws_topics'))return {rows:[{id:topicId}]};
 if(text.includes("tier='A2'")){
  const rows=[];
  for(const [tier,need] of [['A2',params[1]],['BONUS',params[2]],['DOUBLE',params[3]]])
   rows.push(...words.filter(w=>w.tier===tier).slice(0,Math.min(need,stock[tier])));
  return {rows};
 }
 if(text.startsWith('SELECT count(*)::int AS n FROM ws_solo_runs'))return {rows:[{n:rateCount}]};
 if(text.startsWith('INSERT INTO ws_solo_runs')){record={id:runId,user_id:params[0],access_token_hash:params[1],mode:params[3],topic_id:params[4],difficulty:params[5],duration_seconds:params[6],question_count:params[7],points_per_correct:params[8],penalty:params[9],state:JSON.parse(params[15])};return {rows:[{id:runId}]};}
 if(text.startsWith('SELECT id,user_id,access_token_hash'))return {rows:record?[structuredClone(record)]:[]};
 if(text.startsWith('UPDATE ws_solo_runs SET state=')){record.state=JSON.parse(params[0]);return {rows:[],rowCount:1};}
 return {rows:[],rowCount:1};
 },release(){}};};
pg.Pool.prototype.query=async function(text,params=[]){const c=await this.connect();try{return await c.query(text,params)}finally{c.release()}};
async function request(method,path,{body={},cookie}={}){
 const result={headers:{}};
 const req={method,url:'/api/'+path,query:{rest:path},body,headers:cookie?{cookie}:{},socket:{remoteAddress:'127.0.0.1'}};
 const res={statusCode:200,setHeader(k,v){result.headers[k.toLowerCase()]=v},end(raw){result.status=this.statusCode;result.data=JSON.parse(raw)}};
 await handler(req,res);return result;
}
const start=async (input={})=>{
 const response=await request('POST','solo/car/start',{body:{topic_id:topicId,difficulty:'EASY',question_count:3,duration_seconds:90,...input}});
 return {response,cookie:response.headers['set-cookie']?.split(';')[0]};
};
function markReady(){record.state.stepStartedAt=Date.now()-2000}
function safeLane(kind){return record.state.levels[record.state.index].lanes.findIndex(l=>l.kind===kind)}
const answer=(cookie,lane,english,id)=>request('POST',`solo/runs/${runId}/answer`,{cookie,body:{attemptId:attempt(id),lane,answer:english}});

test('CAR Solo starts with approved CEFR-only pools, hides English, keeps signing and defaults',async()=>{
 reset();const {response,cookie}=await start();
 assert.equal(response.status,201,JSON.stringify(response.data));assert.match(cookie,/^ws_solo=/);
 assert.equal(response.data.round.mode,'CAR');assert.equal(response.data.round.car_step_seconds,8);
 assert.equal(response.data.game.mode,'CAR');assert.equal(response.data.game.level.lanes.length,5);
 assert.ok(response.data.game.level.lanes.every(l=>!('english' in l)));
 assert.equal(response.data.game.health,3);assert.equal(response.data.game.index,0);
 assert.ok(queryLog.some(s=>s.includes("cefr_review_status='APPROVED'")));
 assert.ok(queryLog.some(s=>s.includes('DISTINCT ON (lower(w.english))')));
 const denied=await request('GET',`solo/runs/${runId}`);assert.equal(denied.status,401);
 const restored=await request('GET',`solo/runs/${runId}`,{cookie});assert.equal(restored.status,200);
 assert.equal(restored.data.game.mode,'CAR');
});

test('EASY NORMAL HARD lane distributions use the existing engine without fallback',async()=>{
 for(const [difficulty,blocked,double] of [['EASY',1,0],['NORMAL',2,1],['HARD',2,2]]){
  reset();const {response}=await start({difficulty});assert.equal(response.status,201,JSON.stringify(response.data));
  const lanes=response.data.game.level.lanes;
  assert.equal(lanes.filter(l=>l.kind==='BLOCKED').length,blocked);
  assert.equal(lanes.filter(l=>l.kind==='DOUBLE').length,double);
 }
});

test('insufficient CEFR stock returns 409 and does not insert a run',async()=>{
 reset();stock.DOUBLE=0;
 const {response}=await start({difficulty:'HARD'});
 assert.equal(response.status,409);assert.match(response.data.error,/CEFR APPROVED|C1/);
 assert.equal(record,null);assert.ok(!queryLog.some(s=>s.startsWith('INSERT INTO ws_solo_runs')));
});

test('CAR invalid duration, feature gate and durable rate limit are respected',async()=>{
 reset();let x=await start({difficulty:'NORMAL',duration_seconds:20});assert.equal(x.response.status,400);
 reset();featureEnabled=false;x=await start();assert.equal(x.response.status,403);
 reset();rateCount=30;x=await start();assert.equal(x.response.status,429);
});

test('early answer is refused; wrong translation does not advance; DOUBLE is worth 200',async()=>{
 reset();const {cookie,response}=await start({difficulty:'NORMAL'});assert.equal(response.status,201);
 const lane=safeLane('DOUBLE'),word=record.state.levels[0].lanes[lane].english;
 const early=await answer(cookie,lane,word,1);assert.equal(early.status,409);
 markReady();const wrong=await answer(cookie,lane,'not-the-word',2);
 assert.equal(wrong.status,200);assert.equal(wrong.data.result.wordCorrect,false);assert.equal(wrong.data.game.index,0);
 assert.equal(wrong.data.game.score,0);
 const good=await answer(cookie,lane,word,3);
 assert.equal(good.status,200,JSON.stringify(good.data));assert.equal(good.data.result.awarded,200);
 assert.equal(good.data.game.index,1);assert.equal(good.data.game.correct,1);assert.equal(good.data.game.score,200);
 assert.equal(good.data.game.carLane,lane);
});

test('BONUS is 150, NORMAL is 100 and obstacle penalties are enforced',async()=>{
 for(const [kind,expected] of [['BONUS',150],['NORMAL',100]]){
  reset();const {cookie}=await start({difficulty:'EASY'});markReady();
  const lane=safeLane(kind),word=record.state.levels[0].lanes[lane].english;
  const out=await answer(cookie,lane,word,4);assert.equal(out.status,200);assert.equal(out.data.result.awarded,expected);
 }
 reset();const {cookie}=await start({difficulty:'EASY'});markReady();
 const lane=safeLane('BLOCKED');const result=await answer(cookie,lane,'',5);
 assert.equal(result.status,200);assert.equal(result.data.result.laneSafe,false);assert.equal(result.data.game.health,2);assert.equal(result.data.game.index,1);
});

test('JSONB field reordering permits one retry, prevents tampering and preserves exactly-once points',async()=>{
 reset();const {cookie}=await start({difficulty:'NORMAL'});markReady();
 const lane=safeLane('DOUBLE'),word=record.state.levels[0].lanes[lane].english;
 const first=await answer(cookie,lane,word,6);assert.equal(first.status,200);
 const receipt=record.state.answerReceipts[attempt(6)];receipt.content={answer:receipt.content.answer,lane:receipt.content.lane};
 const retry=await answer(cookie,lane,word,6);assert.equal(retry.status,200);assert.equal(retry.data.duplicate,true);
 assert.equal(retry.data.game.score,200);assert.equal(retry.data.game.index,1);
 const changed=await answer(cookie,lane,'another-word',6);assert.equal(changed.status,409);
 assert.equal(record.state.score,200);assert.ok(queryLog.some(s=>s.includes('FOR UPDATE')));
});

test('timeouts reconcile against server clock, end run after three missed steps',async()=>{
 reset();const {cookie}=await start();assert.equal(record.state.status,'PLAYING');
 record.state.stepStartedAt=Date.now()-27000; // three 8-second stages
 const result=await request('GET',`solo/runs/${runId}`,{cookie});
 assert.equal(result.status,200);assert.equal(result.data.game.status,'FAILED');
 assert.equal(result.data.game.health,0);assert.equal(result.data.game.index,3);
});

test('invalid lane or forged guest cannot mutate CAR Solo',async()=>{
 reset();const {cookie}=await start();markReady();
 const missing=await answer(null,0,'foo',7);assert.equal(missing.status,401);
 for(const lane of [-1,5,0.5]){
  const out=await answer(cookie,lane,'foo',8);assert.equal(out.status,400);
 }
 assert.equal(record.state.index,0);
});

test.after(()=>{
 pg.Pool.prototype.connect=originalConnect;pg.Pool.prototype.query=originalQuery;
 for(const [k,v] of Object.entries(savedEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
