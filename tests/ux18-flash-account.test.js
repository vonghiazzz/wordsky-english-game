import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const learn=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
const module=readFileSync(new URL('../public/ux18-flash-sync.js',import.meta.url),'utf8');
const server=readFileSync(new URL('../public/ux13-vocab-sync.js',import.meta.url),'utf8');
test('UX18 account personal Flashcards use distinct source and PostgreSQL identity',()=>{
 assert.match(learn,/<option value="account" disabled>/);
 assert.match(learn,/ACCOUNT_WORD_IDS/);
 assert.match(learn,/ACCOUNT_REMEMBERED/);
 assert.match(learn,/flashSource==='account'&&ACCOUNT_DATA!==null/);
 assert.match(learn,/await accountReviewer\(id\)/);
 assert.match(learn,/ACCOUNT_REMEMBERED\[id\]=true/);
 assert.match(learn,/if\(account\)\{\$\('resetProgress'\)\.disabled=true/);
});
test('UX18 login switching fails closed and cannot mark local progress',()=>{
 assert.match(module,/active.actor.id!==id/);
 assert.match(module,/postUnifiedAccountReview\('personal',wordId,true,id,/);
 assert.match(module,/host.clearAccountCatalog\(\)/);
 assert.match(module,/postUnifiedAccountReview\('shared',wordId,true,id,/);
 assert.match(learn,/if\(accountMode\(\)\)\{/);
 assert.match(learn,/return;\s*\}\s*const server=serverProgressMode\(\)/);
});
test('UX18 live server catalog cannot override active account source',()=>{
 assert.match(learn,/activate&&flashSource!=='account'/);
 assert.match(server,/priorSource==='local'\|\|priorSource==='account'/);
 assert.match(learn,/<script type="module" src="\/ux18-flash-sync.js"><\/script>/);
});
