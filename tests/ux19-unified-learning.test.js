import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildUnifiedAccountView} from '../public/ux19-unified-account.js';
import {summarize,filterWords} from '../public/ux10-progress.js';
const id1='00000000-0000-4000-8000-000000000001',id2='00000000-0000-4000-8000-000000000002';
const card=(source,id,remembered,reviewed)=>({source,id,topic:'Food',english:'apple',
  ipa:'',meaning:'Táo',example:'',translation:'',remembered,reviewed,
  review_count:reviewed?1:0});
const data={scope:'unified-account',actor_id:'user-A',
  words:[card('shared',id1,true,true),card('personal',id2,false,true),
    card('personal',id1,false,false)],
  summary:{total:3,known:1,review:2,reviewed:2,
    shared:{total:1,known:1,review:0,reviewed:1},
    personal:{total:2,known:0,review:2,reviewed:1}}};
test('UX19 one account snapshot combines common and personal totals by source + UUID',()=>{
 const view=buildUnifiedAccountView(data,'user-A');
 assert.equal(view.source,'unified');
 assert.deepEqual(summarize(view.words,view.learned),{total:3,known:1,review:2,percent:33.3});
 assert.equal(view.words[0].key,'shared:'+id1);
 assert.equal(view.words[1].key,'personal:'+id2);
 assert.equal(view.words[2].key,'personal:'+id1,'same UUID in different sources is distinct');
 assert.deepEqual(filterWords(view.words,view.learned,{status:'known'}).map(x=>x.source),['shared']);
 assert.equal(view.summary.reviewed,2,'reviewed:false is not unreviewed');
});
test('UX19 never accepts a different account or malformed/inconsistent totals',()=>{
 assert.throws(()=>buildUnifiedAccountView(data,'user-B'),/không hợp lệ/);
 assert.throws(()=>buildUnifiedAccountView({...data,summary:{...data.summary,known:2}},'user-A'),/nhất quán/);
 assert.throws(()=>buildUnifiedAccountView({...data,words:[...data.words,data.words[0]]},'user-A'),/lặp/);
 assert.throws(()=>buildUnifiedAccountView({...data,words:[card('shared',id1,true,false)]},'user-A'),/không hợp lệ/);
});
test('UX19 server is scoped to mustPlayer and single repeatable-read database snapshot',()=>{
 const service=readFileSync(new URL('../lib/unified-learning.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/getUnifiedLearningSummary\(mustPlayer\(req\)\.id\)/);
 assert.match(service,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(service,/p\.user_id=\$1/);
 assert.match(service,/w\.user_id=\$1 AND w\.deleted_at IS NULL/);
 assert.match(service,/w\.enabled=true AND t\.enabled=true/);
 assert.match(service,/scope:'unified-account'/);
});
test('UX19 UI treats unified account as one source, not local/browser views',()=>{
 const ui=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 assert.match(ui,/buildUnifiedAccountView\(payload,actorId\)/);
 assert.match(ui,/if\(unified\.kind==='ready'\)return unified\.view/);
 assert.match(ui,/if\(unified\.kind==='error'/);
 assert.match(ui,/learning\/me\/summary/);
 assert.match(ui,/updateUnifiedCard\(card, true\)/);
 assert.match(ui,/card\.source==='shared'\?card\.word_id:card\.personal_word_id/);
 assert.match(ui,/postUnifiedAccountReview\(card\.source,/);
 assert.match(html,/id="ws19AccountStatus"/);
});
