import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUnifiedReview} from '../lib/unified-review.js';
import {buildUnifiedAccountView} from '../public/ux19-unified-account.js';
const rid='11111111-1111-4111-8111-111111111111',word='22222222-2222-4222-8222-222222222222';
test('UX23C requires per-word expected_version as a nonnegative integer',()=>{
 const card={request_id:rid,word_id:word,source:'shared',remembered:true};
 assert.throws(()=>validateUnifiedReview(card));
 for(const bad of [-1,1.2,'0',null,Infinity])assert.throws(
  ()=>validateUnifiedReview({...card,expected_version:bad}));
 assert.equal(validateUnifiedReview({...card,expected_version:0}).expected_version,0);
 assert.equal(validateUnifiedReview({...card,expected_version:5}).expected_version,5);
});
test('UX23C summary exposes authoritative version 0 for unseen and review_count for reviewed',()=>{
 const summary={total:2,known:1,review:1,reviewed:1,
  shared:{total:1,known:1,review:0,reviewed:1},
  personal:{total:1,known:0,review:1,reviewed:0}};
 const c=(source,id,version,remembered,reviewed)=>({
  source,id,topic:'Food',english:'apple',meaning:'Táo',ipa:'',
  example:'',translation:'',version,remembered,reviewed
 });
 const r={scope:'unified-account',actor_id:rid,summary,
  words:[c('shared',word,5,true,true),
   c('personal',rid,0,false,false)]};
 const v=buildUnifiedAccountView(r,rid);
 assert.equal(v.words[0].version,5);assert.equal(v.words[1].version,0);
 assert.throws(()=>buildUnifiedAccountView({...r,words:[
  c('shared',word,0,true,true),r.words[1]]},rid));
});
test('UX23C SQL uses compare-and-swap with rollback before history for stale version',()=>{
 const src=readFileSync(new URL('../lib/unified-review.js',import.meta.url),'utf8');
 assert.match(src,/SELECT review_count FROM /);
 assert.match(src,/FOR UPDATE/);
 assert.match(src,/if\(actual!==request\.expected_version\)/);
 assert.match(src,/WHERE '\+progressTable\+'\.review_count=\$5 RETURNING review_count/);
 assert.match(src,/if\(savedProgress\.rows\.length!==1\)/);
 assert.match(src,/result_version=\$3/);
 assert.match(src,/saved\.expected_version!==request\.expected_version/);
 assert.match(src,/result_version/);
 const sql=readFileSync(new URL('../db/migrations/20261027_ux23c_review_version.sql',import.meta.url),'utf8');
 assert.match(sql,/ADD COLUMN IF NOT EXISTS expected_version integer/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS result_version integer/);
 assert.doesNotMatch(sql,/\bDROP\b|\bTRUNCATE\b|\bDELETE FROM\b/);
});
test('UX23C all main account surfaces forward a captured version',()=>{
 const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
 const summary=read('lib/unified-learning.js'),browser=read('public/ux10-account-core.js');
 const dashboard=read('public/ux10-progress.js');
 const flash=read('public/ux18-flash-sync.js'),manager=read('public/ux18-personal.js');
 assert.match(summary,/version:row\.review_count\?\?0/);
 assert.match(browser,/expected_version:command\.expected_version/);
 assert.match(browser,/result\.version!==command\.expected_version\+1/);
 assert.match(dashboard,/remembered,actorId,card\.version/);
 assert.match(flash,/sharedVersions\.get\(wordId\)\?\?0/);
 assert.match(flash,/personalVersions\.get\(wordId\)\?\?0/);
 assert.match(manager,/progress\?\.review_count\?\?0/);
});
