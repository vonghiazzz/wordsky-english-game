import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePersonalCard,validatePersonalBatch,validatePersonalUpdate} from '../lib/personal-vocabulary-core.js';
const card={topic:'Sports',english:'badminton',ipa:'/ˈbædmɪntən/',meaning:'Cầu lông',example:'I play badminton.',translation:'Tôi chơi cầu lông.',remembered:true};
test('UX17 normalizes and validates personal vocabulary per card',()=>{
 const row=validatePersonalCard(card);
 assert.equal(row.import_key,'sports:badminton');
 assert.deepEqual([row.topic,row.english,row.remembered],['Sports','badminton',true]);
 assert.equal(validatePersonalCard({...card,topic:'  Sports ',english:' BADMINTON '}).import_key,'sports:badminton');
});
test('UX17 rejects invalid content and malformed remembered flags',()=>{
 for(const row of [{...card,english:'<script>'},{...card,meaning:''},{...card,remembered:'true'},
  {...card,topic:'x'.repeat(81)},{...card,ipa:null},[card],null])
    assert.throws(()=>validatePersonalCard(row));
});
test('UX17 import is bounded and does not accept collisions',()=>{
 assert.equal(validatePersonalBatch({cards:[card]}).length,1);
 assert.throws(()=>validatePersonalBatch({cards:[]}));
 assert.throws(()=>validatePersonalBatch({cards:Array(21).fill(card)}));
 assert.throws(()=>validatePersonalBatch({cards:[card,{...card,english:'BADMINTON'}]}));
});
test('UX17 editing requires optimistic concurrency version',()=>{
 const result=validatePersonalUpdate({...card,expected_version:2});
 assert.equal(result.expected_version,2);
 for(const version of [0,-1,1.3,'3',undefined])
  assert.throws(()=>validatePersonalUpdate({...card,expected_version:version}));
});
test('UX17 server keeps account identity from session, not user-supplied owner',()=>{
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 const service=readFileSync(new URL('../lib/personal-vocabulary.js',import.meta.url),'utf8');
 assert.match(api,/key==='learning\/personal-vocabulary\/import'/);
 assert.match(api,/payload\.expected_actor_id!==userId/);
 assert.match(api,/listPersonalVocabulary\(mustPlayer\(req\)\.id\)/);
 assert.match(api,/updatePersonalVocabulary\(userId,r\[2\],payload\)/);
 assert.match(service,/ON CONFLICT\(user_id,import_key\) DO NOTHING/);
 assert.match(service,/WHERE user_id=\$1 AND id=\$2 AND version=\$10/);
 assert.match(service,/LIMIT 5001/);
});
test('UX17 browser cloud import uses explicit consent, keeps localStorage intact and supports editing',()=>{
 const page=readFileSync(new URL('../public/personal.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../public/ux17-personal-account.js',import.meta.url),'utf8');
 assert.match(page,/id="ws17Import"/);
 assert.match(page,/id="ws17Form"/);
 assert.match(code,/window\.confirm\('Chuyển '/);
 assert.match(code,/localStorage\.getItem\('wordsky_vocab_v2'\)/);
 assert.match(code,/localStorage\.getItem\('wordsky_learned'\)/);
 assert.match(code,/expected_actor_id:userId/);
 assert.match(code,/i\+=10/);
 assert.match(code,/method:'PATCH'/);
 assert.doesNotMatch(code,/localStorage\.clear\(|localStorage\.removeItem\(/);
});
test('UX17 schema uses private RLS table and prevents overwrite on duplicate import',()=>{
 const sql=readFileSync(new URL('../db/migrations/20261026_ux17_personal_vocabulary.sql',import.meta.url),'utf8');
 assert.match(sql,/user_id uuid NOT NULL REFERENCES public\.ws_users/);
 assert.match(sql,/UNIQUE \(user_id, import_key\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON public\.ws_user_vocabulary FROM PUBLIC/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test('UX17 account-sourced Flashcards read and write private cloud cards',()=>{
 const html=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
 const cloud=readFileSync(new URL('../public/ux17-cloud-flashcards.js',import.meta.url),'utf8');
 assert.match(html,/option value="account" disabled/);
 assert.match(html,/function accountProgressMode\(\)/);
 assert.match(html,/accountCardRow\(topic,x\)/);
 assert.match(html,/window\.WordSkyCloudFlashcards\.saveRemembered\(card,true\)/);
 assert.match(html,/setAccountCatalog\(rows\)/);
 assert.match(html,/if\(account\)\$\('resetProgress'\)\.disabled=true/);
 assert.match(cloud,/learning\/personal-vocabulary/);
 assert.match(cloud,/expected_version:card\.version,expected_actor_id:actorId/);
 assert.match(cloud,/window\.addEventListener\('focus'/);
 assert.doesNotMatch(cloud,/localStorage\.setItem\(/);
});
