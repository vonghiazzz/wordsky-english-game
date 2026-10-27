import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSrsQueueQuery} from '../lib/srs-queue.js';

test('UX24 queue pagination defaults and category filters are strictly validated',()=>{
 assert.deepEqual(parseSrsQueueQuery({}),{status:'due',page:0,size:20});
 assert.deepEqual(parseSrsQueueQuery({status:'new',page:'2',size:'100'}),
  {status:'new',page:2,size:100});
 assert.deepEqual(parseSrsQueueQuery({status:'upcoming',page:'0',size:'1'}),
  {status:'upcoming',page:0,size:1});
 for(const input of [
  {status:'all'},{status:''},{status:['due']},{page:'-1'},
  {page:'1.2'},{page:'10001'},{page:' 2'},{size:'0'},
  {size:'101'},{size:'Infinity'},{size:['10']},{page:1}
 ]){
  assert.throws(()=>parseSrsQueueQuery(input),error=>error.status===400);
 }
});

test('UX24 queue is a single repeatable-read account snapshot, never a write operation',()=>{
 const src=readFileSync(new URL('../lib/srs-queue.js',import.meta.url),'utf8');
 assert.match(src,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(src,/SELECT transaction_timestamp\(\) AS as_of/);
 assert.match(src,/FROM ws_learning_flashcard_reviews /);
 assert.match(src,/FROM ws_personal_card_reviews /);
 assert.match(src,/WHERE user_id=\$1 ORDER BY reviewed_at,id LIMIT 50001/);
 assert.match(src,/FROM ws_personal_cards WHERE user_id=\$1 AND deleted_at IS NULL/);
 assert.match(src,/buildSrsQueue\(cards,historyByWord,\{now:asOf\}\)/);
 assert.match(src,/words:rows\.slice\(start,start\+size\)/);
 assert.doesNotMatch(src,/\bINSERT INTO\b|\bUPDATE\s+ws_|\bDELETE FROM\b|\bTRUNCATE\b/);
});

test('UX24 requires explicit Production release gates and remains session scoped',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/method==='GET'&&key==='learning\/srs\/queue'/);
 const gates=readFileSync(new URL('../lib/srs-release-gates.js',import.meta.url),'utf8');
 assert.match(api,/if\(!srsEnabled\(\)\)/);
 assert.match(gates,/env\.VERCEL_ENV==='production'/);
 assert.match(gates,/WORDSKY_SRS_PRODUCTION_ENABLED==='true'/);
 assert.match(gates,/WORDSKY_SRS_PRODUCTION_SHADOW_ENABLED==='true'/);
 assert.match(api,/const userId=mustPlayer\(req\)\.id/);
 assert.match(api,/getAccountSrsQueue\(userId,req\.query\|\|\{\}\)/);
});
