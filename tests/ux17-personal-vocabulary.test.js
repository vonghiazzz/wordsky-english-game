import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePersonalCard} from '../lib/personal-vocabulary.js';
const p={topic:'Food',english:'apple',meaning:'Quả táo',ipa:'',example:'',translation:''};
test('personal card normalizes and preserves all six fields',()=>{
 assert.deepEqual(normalizePersonalCard(p),p);
 assert.equal(normalizePersonalCard({...p,english:' apple '}).english,'apple');
});
test('malformed and overly long personal cards rejected',()=>{
 for(const x of [{...p,english:''},{...p,meaning:''},{...p,topic:'x'.repeat(81)},{...p,example:'e'.repeat(501)},{...p,english:42},null])
  assert.throws(()=>normalizePersonalCard(x));
});
test('personal API derives user scope from authenticated server session',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(api,/listPersonalVocabulary\(mustPlayer\(req\)\.id\)/);
 assert.match(api,/addPersonalCard\(mustPlayer\(req\)\.id,body\(req\)\)/);
 assert.match(api,/markPersonalCard\(mustPlayer\(req\)\.id,body\(req\)\)/);
 const migration=readFileSync(new URL('../db/migrations/20261026_ux17_personal_vocabulary.sql',import.meta.url),'utf8');
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/g);
 assert.match(migration,/FOREIGN KEY \(personal_word_id,user_id\)/);
 assert.doesNotMatch(migration,/\bDROP TABLE\b|\bTRUNCATE\b/);
});
