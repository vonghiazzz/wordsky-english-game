// UX51 rollback-only acceptance; isolated PostgreSQL in CI only.
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {saveVerbAttempt,getVerbPracticeHistory} from '../lib/verb-practice-history.js';
const url=new URL(process.env.DATABASE_URL||'');
assert.equal(url.hostname,'127.0.0.1');
assert.equal(url.port,'5547');
assert.equal(url.pathname,'/wordsky_v6_test');
const client=new pg.Client({connectionString:url.toString(),ssl:false});
await client.connect();
let active=false;
try{
 await client.query('BEGIN');active=true;
 const actor=randomUUID();
 await client.query('INSERT INTO ws_users(id,username,display_name,password_hash) VALUES($1,$2,$3,$4)',
  [actor,'ux51-fixture','Isolated QA','fixture-only']);
 const query=(sql,params)=>client.query(sql,params);
 const words=['go','eat','write','have','make','study','play','see','do','come'];
 const targets=['v1','v2','v3'];
 const guesses=['go','ate','written','have','made','studied','play','saw','done','come'];
 const answers=words.map((v1,i)=>({v1,target:targets[i%3],given:guesses[i]}));
 const request_id=randomUUID();
 const saved=await saveVerbAttempt(actor,{mode:'full',request_id,answers},query);
 assert.equal(saved.replayed,false);assert.equal(saved.correct,10);
 const duplicate=await saveVerbAttempt(actor,{mode:'full',request_id,answers},query);
 assert.equal(duplicate.replayed,true);
 await assert.rejects(saveVerbAttempt(actor,{mode:'full',request_id,
  answers:answers.map((v,i)=>i===0?{...v,given:'wrong'}:v)},query),e=>e.status===409);
 const retry=await saveVerbAttempt(actor,{mode:'retry',request_id:randomUUID(),
  answers:[{v1:'go',target:'v2',given:'incorrect'}]},query);
 assert.equal(retry.correct,0);
 const history=await getVerbPracticeHistory(actor,query);
 assert.deepEqual(history.summary,{runs:2,questions:11,correct:10});
 assert.equal(history.recent.length,2);
 assert.deepEqual(history.weak_forms,[{v1:'go',form:'v2',mistakes:1}]);
 assert.equal((await getVerbPracticeHistory(randomUUID(),query)).summary.runs,0);
 const rls=await client.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.ws_verb_practice_runs'::regclass");
 assert.equal(rls.rows[0].relrowsecurity,true);
 const progress=await client.query('SELECT count(*)::int n FROM ws_learning_word_progress WHERE user_id=$1',[actor]);
 assert.equal(progress.rows[0].n,0);
 await client.query('ROLLBACK');active=false;
 const remaining=await client.query("SELECT count(*)::int n FROM ws_users WHERE username='ux51-fixture'");
 assert.equal(remaining.rows[0].n,0);
 console.log('UX51 PASS: account isolated persistence, replay, tamper reject, aggregation, RLS and rollback');
}finally{
 if(active)await client.query('ROLLBACK');
 await client.end();
}
