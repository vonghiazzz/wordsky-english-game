import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const learn=read('learn.html'),sync=read('ux18-flash-sync.js'),
  progress=read('progress.html'),personal=read('personal.html');
test('UX20 authenticated learners have two source choices; legacy local is disabled',()=>{
 assert.ok(learn.includes('legacy.hidden=ACCOUNT_SESSION;legacy.disabled=ACCOUNT_SESSION'));
 assert.ok(learn.includes("Kho từ chung ("));
 assert.ok(learn.includes("Từ của tôi ("));
 assert.ok(learn.includes("if(ACCOUNT_SESSION&&which==='local')return"));
 assert.ok(learn.includes("if(ACCOUNT_SESSION&&flashSource==='local')"));
 assert.ok(learn.includes("location.hash==='#manage'"));
 assert.ok(progress.includes('href="/personal.html">Quản lý từ của tôi'));
 assert.ok(!progress.includes('href="/learn.html#manage">Quản lý bộ từ'));
});
test('UX20 server-account reviews wait for PostgreSQL success before showing known',()=>{
 assert.ok(learn.includes('if(accountSharedMode()){'));
 assert.ok(learn.includes('await sharedReviewer(id)'));
 assert.ok(learn.includes('ACCOUNT_SHARED_PROGRESS[id]=true'));
 assert.ok(learn.includes("if(accountMode()||accountSharedMode())"));
 assert.ok(sync.includes("learning/flashcards/progress"));
 assert.ok(sync.includes("postUnifiedAccountReview('shared',wordId,true,id,"));
 assert.ok(sync.includes('latest.actor.id!==id'));
});
test('UX20 data archive accessible without modifying old browser Flashcards',()=>{
 assert.ok(personal.includes('<details id="legacyImportDetails">'));
 assert.ok(personal.includes('href="/learn.html?legacy=1#manage"'));
 assert.ok(personal.includes('id="personalImportButton"'));
 assert.ok(learn.includes("const STORE='wordsky_vocab_v2'"));
 assert.ok(learn.includes("const PROGRESS='wordsky_learned'"));
 assert.ok(learn.includes('function saveServerLearned()'));
});
test('UX20 unavailable public catalog disables the proper option, not account',()=>{
 assert.ok(learn.includes('querySelector(\'option[value="server"]\').disabled=true'));
 assert.ok(learn.includes('ACCOUNT_SHARED_PROGRESS===null'));
 assert.ok(sync.includes('host.clearAccountCatalog()'));
});
