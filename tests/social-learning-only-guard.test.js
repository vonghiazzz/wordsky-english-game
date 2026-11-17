import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('api/index.js');
const guard="COALESCE((to_jsonb(w)->>'learning_only')::boolean,false)=false";

test('SOCIAL phrase safety: game question selectors and capacity exclude learning-only',()=>{
 const segments=[
  ['approvedCarWordCounts','selectApprovedCarWords'],
  ['selectApprovedCarWords','selectMatchWords'],
  ['selectMatchWords','selectMatrixWords'],
  ['selectMatrixWords','ensureVocabulary'],
  ['ensureVocabulary','ensureTopicNotLive']
 ];
 for(const [start,end] of segments){
  const i=source.indexOf('async function '+start+'('),j=source.indexOf('async function '+end+'(');
  assert.ok(i>=0&&j>i,start+' function boundaries');
  const body=source.slice(i,j);
  assert.ok(body.includes(guard),start+' must filter learning-only phrases');
 }
});

test('SOCIAL phrase safety: My Learning still sees all enabled shared cards',()=>{
 const learning=read('lib/unified-learning.js');
 assert.match(learning,/FROM ws_words w JOIN ws_topics t/);
 assert.doesNotMatch(learning,/learning_only/);
 assert.match(source,/to_jsonb\(w\)->>'learning_only'/);
});

test('SOCIAL phrase safety: migration is additive and defaults old cards to game-eligible',()=>{
 const migration=read('db/migrations/20261117_social_learning_only.sql');
 assert.match(migration,/ADD COLUMN IF NOT EXISTS learning_only boolean NOT NULL DEFAULT false/);
 assert.match(read('db/schema.sql'),/learning_only boolean NOT NULL DEFAULT false/);
});
