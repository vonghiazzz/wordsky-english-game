import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import handler from '../api/index.js';

const runId='77777777-7777-4777-8777-777777777780';
const secret='ux33-matrix-solo-test-secret-1234567890123456';
const originalConnect=pg.Pool.prototype.connect;
const originalQuery=pg.Pool.prototype.query;
const env={DATABASE_URL:process.env.DATABASE_URL,SESSION_SECRET:process.env.SESSION_SECRET};
process.env.DATABASE_URL='postgres://test:test@localhost:5432/test';
process.env.SESSION_SECRET=secret;
let game=null,enabled=true,words=[];
const fixture=count=>Array.from({length:count},(_,i)=>({
 id:`44444444-4444-4444-8444-${String(i).padStart(12,'0')}`,
 english:'word'+i,meaning:'nghĩa'+i
}));
const reset=()=>{game=null;enabled=true;words=fixture(361)};
const attempt=n=>`99999999-9999-4999-8999-${String(n).padStart(12,'0')}`;
pg.Pool.prototype.connect=async function(){
 return {
  async query(sql,params=[]){
   if(sql.startsWith('SELECT enabled FROM ws_features WHERE feature_key='))return {rows:[{enabled}]};
   if(sql.startsWith('SELECT count(*)::int AS n FROM ws_solo_runs WHERE client_fingerprint_hash='))return {rows:[{n:0}]};
   if(sql.startsWith('SELECT id,english,meaning FROM ('))return {rows:words.slice(0,params[0])};
   if(sql.startsWith('INSERT INTO ws_solo_runs')){
    game={id:runId,user_id:params[0],access_token_hash:params[1],
     mode:params[3],topic_id:params[4],difficulty:params[5],
     duration_seconds:params[6],question_count:params[7],
     points_per_correct:params[8],penalty:params[9],state:JSON.parse(params[15])};
    return {rows:[{id:runId}]};
   }
   if(sql.startsWith('SELECT id,user_id,access_token_hash')){
    return {rows:game?[structuredClone(game)]:[]};
   }
   if(sql.startsWith('UPDATE ws_solo_runs SET state=')){
    if(game){game.state=JSON.parse(params[0]);return {rows:[],rowCount:1}}
    return {rows:[],rowCount:0};
   }
   if(sql.includes('SELECT w.id::text AS word_id'))return {rows:[]};
   return {rows:[],rowCount:1};
  },release(){}
 };
};
pg.Pool.prototype.query=async function(sql,params=[]){
 const client=await this.connect();
 try{return await client.query(sql,params)}finally{client.release()}
};
after(()=>{
 pg.Pool.prototype.connect=originalConnect;
 pg.Pool.prototype.query=originalQuery;
 for(const key of Object.keys(env)) {
  if(env[key]===undefined)delete process.env[key];
  else process.env[key]=env[key];
 }
});
async function api(method,path,options={}){
 const capture={headers:{}};
 const req={method,url:'/api/'+path,
  query:{rest:path},body:options.body??{},
  headers:options.cookie?{cookie:options.cookie}: {},
  socket:{remoteAddress:'127.0.0.33'}
 };
 const res={statusCode:200,setHeader(key,value){capture.headers[key.toLowerCase()]=value},
  end(raw){capture.status=this.statusCode;capture.data=JSON.parse(raw)}
 };
 await handler(req,res);
 return capture;
}
const start=async size=>{
 const res=await api('POST','solo/matrix/start',{body:{grid_size:size}});
 return {res,cookie:res.headers['set-cookie']?.split(';')[0]};
};
test('UX33 no database feature flag means fail closed, and invalid size fails early',async()=>{
 reset();enabled=false;
 const off=await start(8);
 assert.equal(off.res.status,403);
 assert.equal(game,null);
 enabled=true;
 const wrong=await start(9);
 assert.equal(wrong.res.status,400);
 assert.equal(game,null);
});
test('UX33 starting from available vocabulary gives exactly 256 safely anonymized cards',async()=>{
 reset();
 const {res,cookie}=await start(16);
 assert.equal(res.status,201);
 assert.match(cookie,/^ws_solo=/);
 assert.equal(res.data.round.mode,'MATRIX');
 assert.equal(res.data.round.question_count,128);
 assert.equal(res.data.round.duration_seconds,1800);
 assert.equal(res.data.game.cards.length,256);
 assert.equal(game.mode,'MATRIX');
 assert.equal(game.state.pairs.length,128);
 assert.ok(res.data.game.cards.every(c=>!Object.hasOwn(c,'wordId')&&!Object.hasOwn(c,'pairId')));
 assert.equal(Object.hasOwn(res.data.game,'pairs'),false);
 const read=await api('GET','solo/runs/'+runId,{cookie});
 assert.equal(read.status,200);
 assert.equal(read.data.game.cards.length,256);
});
test('UX33 missing unique pairs returns 400 without creating run',async()=>{
 reset();words=fixture(31);
 const {res}=await start(8);
 assert.equal(res.status,400);
 assert.match(res.data.error,/cần 32 từ/);
 assert.equal(game,null);
});
test('UX33 POST answer is server-graded and receipt retry is idempotent',async()=>{
 reset();
 const {res,cookie}=await start(8);
 assert.equal(res.status,201);
 const first=game.state.pairs[0],second=game.state.pairs[1];
 const correct={attemptId:attempt(1),firstId:first.enId,secondId:first.viId};
 const a=await api('POST','solo/runs/'+runId+'/answer',{body:correct,cookie});
 assert.equal(a.status,200);
 assert.equal(a.data.game.score,100);
 assert.equal(a.data.game.correct,1);
 const replay=await api('POST','solo/runs/'+runId+'/answer',{body:correct,cookie});
 assert.equal(replay.status,200);
 assert.equal(replay.data.duplicate,true);
 assert.equal(replay.data.game.score,100);
 const altered=await api('POST','solo/runs/'+runId+'/answer',{body:{...correct,secondId:second.viId},cookie});
 assert.equal(altered.status,409);
 const wrong={attemptId:attempt(2),firstId:second.enId,secondId:game.state.pairs[2].viId};
 const b=await api('POST','solo/runs/'+runId+'/answer',{body:wrong,cookie});
 assert.equal(b.status,200);
 assert.equal(b.data.game.score,75);
 assert.equal(b.data.game.health,2);
 assert.equal(game.state.wrongWordIds.length,2);
 assert.ok(!('wrongWordIds' in b.data.game));
});
