// True PostgreSQL + API smoke, but ONLY with fixed localhost:5547 test database.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn} from 'node:child_process';
import pg from 'pg';
import {hashPassword} from '../../lib/security.js';
const url=process.env.DATABASE_URL;
if(!url)throw Error('DATABASE_URL is required');
const dbUrl=new URL(url);
assert.ok(['localhost','127.0.0.1'].includes(dbUrl.hostname));
assert.equal(dbUrl.port,'5547');
assert.equal(dbUrl.pathname,'/wordsky_v6_test');
assert.equal(dbUrl.username,'wordsky_test');
const db=new pg.Client({connectionString:url});
const serverPort=await new Promise((resolve,reject)=>{
 const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});
});
const origin='http://localhost:'+serverPort;
const password='test-'+crypto.randomBytes(18).toString('hex');
const child=spawn(process.execPath,['scripts/local-server.js'],{
 cwd:process.cwd(),
 env:{...process.env,PORT:String(serverPort),APP_ORIGIN:origin,ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:hashPassword(password),SESSION_SECRET:crypto.randomBytes(40).toString('hex')},
 stdio:['ignore','pipe','pipe']
});
let serverErr=''; child.stderr.on('data',d=>serverErr+=String(d).slice(0,1000));
const sleep=t=>new Promise(r=>setTimeout(r,t));
const request=async(route,{method='GET',body,cookie}={})=>{
 const response=await fetch(origin+route,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(method==='GET'?{}:{origin}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(9000)});
 let json;try{json=await response.json()}catch{throw Error('Bad JSON '+response.status+' '+route)}
 return {status:response.status,json,cookie:response.headers.get('set-cookie')?.split(';')[0]};
};
let createdId=null;
try{
 await db.connect();
 const counts=await db.query(`SELECT (SELECT count(*)::int FROM ws_topics) topics,
   (SELECT count(*)::int FROM ws_words) words,
   (SELECT count(*)::int FROM ws_words WHERE cefr_review_status='APPROVED') approved,
   (SELECT count(*)::int FROM ws_topics WHERE title='WordSky CEFR - Reviewed') bogus`);
 assert.equal(counts.rows[0].topics,26,'Never create a 27th topic');
 assert.equal(counts.rows[0].approved,12,'Local simulated fixture should insert 12 approved words');
 assert.equal(counts.rows[0].words,272,'Keep all original 260 words and add exactly 12');
 assert.equal(counts.rows[0].bogus,0);
 const topics=await db.query('SELECT title,id FROM ws_topics');
 const school=topics.rows.find(x=>x.title==='School - Trường học');
 assert.ok(school);
 const tiers=await db.query(`SELECT cefr_level,count(*)::int n FROM ws_words WHERE topic_id=$1 AND cefr_review_status='APPROVED' GROUP BY cefr_level`,[school.id]);
 const A2=tiers.rows.filter(x=>x.cefr_level==='A2').reduce((s,x)=>s+x.n,0);
 const B=tiers.rows.filter(x=>['B1','B2'].includes(x.cefr_level)).reduce((s,x)=>s+x.n,0);
 const C=tiers.rows.filter(x=>['C1','C2'].includes(x.cefr_level)).reduce((s,x)=>s+x.n,0);
 assert.deepEqual([A2,B,C],[3,3,3]);
 let ready=false;
 for(let i=0;i<50;i++){
  if(child.exitCode!==null)throw Error('Server exited unexpectedly '+serverErr);
  try{const r=await request('/api/health');if(r.status===200){ready=true;break}}catch{}
  await sleep(100);
 }
 assert.ok(ready,'Server did not become ready: '+serverErr);
 const topicResponse=await request('/api/topics');
 assert.equal(topicResponse.status,200,JSON.stringify(topicResponse.json));
 assert.equal(topicResponse.json.topics.length,26);
 const auth=await request('/api/auth/login',{method:'POST',body:{username:'owner',password}});
 assert.equal(auth.status,200,JSON.stringify(auth.json));
 const adminCookie=auth.cookie;assert.ok(adminCookie?.startsWith('ws_auth='));
 const config={mode:'CAR',topic_id:school.id,difficulty:'NORMAL',duration_seconds:45,question_count:3,points_per_correct:100,penalty:25,weight:1};
 const insufficient=await request('/api/admin/events',{method:'POST',body:{title:'Insufficient CEFR Test',password:'local-game-pass-88',max_players:10,rounds:[{...config,question_count:4}]},cookie:adminCookie});
 assert.equal(insufficient.status,400,'Must reject missing per-topic stock');
 assert.match(insufficient.json.error,/CEFR|từ/i);
 const created=await request('/api/admin/events',{method:'POST',body:{title:'WordSky V6 DB Local Test',password:'local-game-pass-88',max_players:10,rounds:[config]},cookie:adminCookie});
 assert.equal(created.status,201,JSON.stringify(created.json));
 const code=created.json.join_code;assert.ok(code);
 const lookup=await db.query('SELECT id FROM ws_events WHERE join_code=$1',[code]);createdId=lookup.rows[0].id;
 const open=await request(`/api/admin/events/${createdId}/open`,{method:'POST',body:{},cookie:adminCookie});
 assert.equal(open.status,200,JSON.stringify(open.json));
 const guest=await request(`/api/events/${code}/join`,{method:'POST',body:{password:'local-game-pass-88',name:'Local V6 Test Player'}});
 assert.equal(guest.status,200,JSON.stringify(guest.json));const guestCookie=guest.cookie;assert.ok(guestCookie);
 const start=await request(`/api/admin/events/${createdId}/start`,{method:'POST',body:{},cookie:adminCookie});
 assert.equal(start.status,200,JSON.stringify(start.json));
 const room=await request(`/api/rooms/${code}`,{cookie:guestCookie});
 assert.equal(room.status,200,JSON.stringify(room.json));
 const roundId=room.json.event.rounds[0].id;
 const run=await request(`/api/rooms/${code}/rounds/${roundId}/start`,{method:'POST',body:{},cookie:guestCookie});
 assert.equal(run.status,200,JSON.stringify(run.json));
 const game=run.json.game;
 assert.equal(game.mode,'CAR');assert.equal(game.level.lanes.length,5);
 assert.equal(game.level.lanes.filter(l=>l.kind==='BLOCKED').length,2);
 assert.ok(game.level.lanes.every(l=>!('english' in l)),'API must not leak English answers');
 const activeLane=game.level.lanes.findIndex(l=>l.kind==='DOUBLE');
 const lane=game.level.lanes[activeLane];assert.ok(lane);
 assert.ok(['C1','C2'].includes(lane.cefr));
 const translated=await db.query('SELECT english FROM ws_words WHERE topic_id=$1 AND meaning=$2 AND cefr_level=$3 AND cefr_review_status=$4',[school.id,lane.meaning,lane.cefr,'APPROVED']);
 assert.equal(translated.rows.length,1);
 const waitMs=Math.max(0,game.nextAllowedAt-Date.now()+100);
 await sleep(waitMs);
 const wrong=await request(`/api/rooms/${code}/runs/${run.json.runId}/answer`,{method:'POST',body:{lane:activeLane,answer:'wrong-answer'},cookie:guestCookie});
 assert.equal(wrong.status,200,JSON.stringify(wrong.json));assert.equal(wrong.json.game.index,0);assert.equal(wrong.json.result.wordCorrect,false);
 const good=await request(`/api/rooms/${code}/runs/${run.json.runId}/answer`,{method:'POST',body:{lane:activeLane,answer:translated.rows[0].english},cookie:guestCookie});
 assert.equal(good.status,200,JSON.stringify(good.json));assert.equal(good.json.result.correct,true);assert.equal(good.json.game.index,1);assert.equal(good.json.result.awarded,200);
 console.log('LOCAL E2E PASS: 26 topics, 272 words, 12 simulated approvals, no 27th topic, server login/admin room/join/start, C1/C2 x2 lane +200, wrong answer blocked.');
}catch(e){console.error('LOCAL E2E FAILED',e);process.exitCode=1}
finally{
 try{if(createdId)await db.query('DELETE FROM ws_events WHERE id=$1',[createdId])}catch(e){console.warn('Local fixture cleanup failed:',e.message)}
 await db.end().catch(()=>{});child.kill('SIGTERM');
}
