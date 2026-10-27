import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareSrsShadowRows} from '../lib/srs-diagnostics.js';
import {rebuildSrsProjection} from '../lib/srs-projection.js';

const shared='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',personal='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const e=(id,remembered,reviewed_at,word_id=shared)=>({id,remembered,reviewed_at,word_id});
const initial=e('11111111-1111-4111-8111-111111111111',true,'2026-10-27T00:00:00Z');
const second=e('22222222-2222-4222-8222-222222222222',false,'2026-10-28T00:00:00Z');
function materialize(history,source='shared',word_id=shared){
 const projection=rebuildSrsProjection(history);
 return {...projection,source,word_id};
}
test('UX24D parity matches persisted schedules to full account-owned event history',()=>{
 const history=[initial,second],s=materialize(history);
 const result=compareSrsShadowRows([s],history,[]);
 assert.deepEqual(result,{status:'complete',history_words:1,materialized:1,
   matched:1,mismatched:0,missing:0,orphaned:0});
 assert.equal('events' in result,false);
 assert.equal('word_id' in result,false,'do not disclose raw study history or IDs');
});
test('UX24D marks historical unmaterialized cards partial rather than falsely complete',()=>{
 const history=[initial,e('33333333-3333-4333-8333-333333333333',
   true,'2026-10-27T01:00:00Z',personal)];
 const s=materialize([initial]);
 const r=compareSrsShadowRows([s],history.slice(0,1),
  [{...history[1],personal_word_id:personal}]);
 assert.equal(r.status,'partial');
 assert.equal(r.matched,1);
 assert.equal(r.history_words,2);
 assert.equal(r.missing,1);
});
test('UX24D catches corrupted due dates, changed version and orphan shadow rows',()=>{
 const s=materialize([initial]);
 assert.equal(compareSrsShadowRows([{...s,interval_days:30}],[initial],[]).mismatched,1);
 assert.equal(compareSrsShadowRows([{...s,policy_version:'stale'}],[initial],[]).status,'mismatch');
 assert.equal(compareSrsShadowRows([s],[],[]).orphaned,1);
});
test('UX24D endpoint stays Preview-gated, mustPlayer and returns only summary',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../lib/srs-diagnostics.js',import.meta.url),'utf8');
 assert.match(api,/if\(method==='GET'&&key==='learning\/srs\/diagnostics'\)/);
 assert.match(api,/getAccountSrsDiagnostics\(mustPlayer\(req\)\.id\)/);
 assert.match(service,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(service,/WHERE user_id=\$1 ORDER BY/);
 assert.match(service,/compareSrsShadowRows/);
 assert.doesNotMatch(service,/INSERT INTO|UPDATE ws_user|DELETE FROM/);
});
