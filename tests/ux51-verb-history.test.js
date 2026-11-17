import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateVerbAttempt} from '../lib/verb-practice-history.js';
const id='d6575337-e237-4a33-aecf-95b449aa8741';
const full=Array.from({length:10},(_,i)=>({
 v1:['go','eat','write','have','make','study','play','see','do','come'][i],
 target:['v1','v2','v3'][i%3],
 given:['go','ate','written','have','made','studied','play','saw','done','come'][i]
}));
test('UX51 server independently grades V1 V2 V3 with 10 bounded answers',()=>{
 const out=evaluateVerbAttempt({request_id:id,mode:'full',answers:full});
 assert.equal(out.total,10);
 assert.equal(out.correct,10);
 assert.ok(out.answers.every(row=>row.correct===true));
 const wrong=full.map(row=>({...row}));
 wrong[1].given='eated';
 const result=evaluateVerbAttempt({request_id:id,mode:'full',answers:wrong});
 assert.equal(result.correct,9);
 assert.equal(result.answers[1].correct,false);
});
test('UX51 reject arbitrary verb, duplicate target, oversized, invalid request and missing form',()=>{
 const base={request_id:id,mode:'full',answers:full};
 for(const candidate of [
  {...base,answers:full.slice(0,9)},
  {...base,answers:[...full,full[0]]},
  {...base,answers:full.map((x,i)=>i===0?{...x,v1:'unknownverb'}:x)},
  {...base,answers:full.map((x,i)=>i===0?{...x,target:'invalid'}:x)},
  {...base,request_id:'bad'},
  {...base,mode:'external'}
 ]) assert.throws(()=>evaluateVerbAttempt(candidate));
 assert.equal(evaluateVerbAttempt({request_id:id,mode:'retry',answers:[{v1:'go',target:'v2',given:'went'}]}).correct,1);
});
test('UX51 API pins authenticated actor and does not access SRS tables',async()=>{
 const fs=await import('node:fs');
 const api=fs.readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const service=fs.readFileSync(new URL('../lib/verb-practice-history.js',import.meta.url),'utf8');
 assert.match(api,/learning\/verbs\/history/);
 assert.match(api,/learning\/verbs\/attempts/);
 assert.match(api,/payload.expected_actor_id!==userId/);
 assert.doesNotMatch(service,/ws_user_srs_schedules|ws_learning_word_progress|writeSrsShadowSchedule/);
});
