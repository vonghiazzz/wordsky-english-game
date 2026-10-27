import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {srsQuery,srsReviewCards} from '../public/ux24-srs-panel.js';

const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const word='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('UX24C queue URL safely encodes topic and pagination',()=>{
 assert.equal(srsQuery({status:'due',topic:'Daily Life',page:1,size:20}),
  'learning/srs/queue?status=due&topic=Daily+Life&page=1&size=20');
 assert.equal(srsQuery({topic:'Food & Drinks'}).includes('Food+%26+Drinks'),true);
});
test('UX24C rejects a mismatched actor and invalid version without personal data leakage',()=>{
 const data={scope:'account-srs',actor_id:user,total:1,topics:['Daily Life'],words:[
  {source:'shared',id:word,topic:'Daily Life',english:'wake',status:'due',review_count:1}
 ]};
 assert.equal(srsReviewCards(data,user),data);
 assert.throws(()=>srsReviewCards(data,'other-actor'),/không hợp lệ/);
 assert.throws(()=>srsReviewCards({...data,words:[{...data.words[0],review_count:-1}]},user),/không hợp lệ/);
});
test('UX24C My Learning includes a Preview-gated SRS panel with due/new/upcoming controls',()=>{
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/ux24-srs-panel.js',import.meta.url),'utf8');
 const existing=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../lib/srs-queue.js',import.meta.url),'utf8');
 assert.match(html,/id="ws24Srs"[^>]*hidden/);
 assert.match(html,/id="ws24Status"/);
 assert.match(html,/value="due"/);
 assert.match(html,/value="upcoming"/);
 assert.match(html,/value="new"/);
 assert.match(html,/id="ws24Topic"/);
 assert.match(html,/id="ws24Prev"/);
 assert.match(html,/id="ws24Next"/);
 assert.match(ui,/postUnifiedAccountReview\(word\.source,word\.id,remembered,actorId,word\.review_count\)/);
 assert.match(ui,/if\(error\.status===409\)/);
 assert.match(ui,/panel\.hidden=error\.status===404/);
 assert.match(ui,/wordsky:srs-review-saved/);
 assert.match(existing,/wordsky:my-learning-review-saved/);
 assert.match(existing,/wordsky:srs-review-saved/);
 assert.match(backend,/const rows=topic\?queue\[status\]\.filter\(card=>card\.topic===topic\)/);
 assert.match(backend,/total:rows\.length/);
});
test('UX24C legacy writers update shadow only after accepted progress in a single DB transaction',()=>{
 const names=['learning-progress.js','personal-vocabulary.js','legacy-learning-import.js'];
 for(const n of names){
  const src=readFileSync(new URL('../lib/'+n,import.meta.url),'utf8');
  assert.match(src,/srsShadowEnabled/);
  assert.match(src,/await writeSrsShadowSchedule\(db,/);
 }
 const legacy=readFileSync(new URL('../lib/legacy-learning-import.js',import.meta.url),'utf8');
 assert.match(legacy,/lockImportActor\(db,userId\)/);
 assert.match(legacy,/ON CONFLICT\(user_id,/);
});
