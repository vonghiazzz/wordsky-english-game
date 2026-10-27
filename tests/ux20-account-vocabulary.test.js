import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
const sync=readFileSync(new URL('../public/ux18-flash-sync.js',import.meta.url),'utf8');
const progress=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
const personal=readFileSync(new URL('../public/personal.html',import.meta.url),'utf8');
test('UX20 signed-in learner sees only two account-scoped learning sources',()=>{
 assert.match(html,/legacy.hidden=ACCOUNT_SESSION;legacy.disabled=ACCOUNT_SESSION/);
 assert.match(html,/Kho từ chung \\('/);
 assert.match(html,/Từ của tôi \\('/);
 assert.match(html,/if\\(ACCOUNT_SESSION&&which==='local'\\)return/);
 assert.match(html,/if\\(ACCOUNT_SESSION&&flashSource==='local'\\)/);
 assert.match(html,/if\\(ACCOUNT_SESSION&&location.hash==='#manage'/);
 assert.match(progress,/href="\\/personal.html">Quản lý từ của tôi/);
 assert.doesNotMatch(progress,/href="\\/learn.html#manage">Quản lý bộ từ/);
});
test('UX20 signed-in shared Flashcard progress never writes browser-only known marks',()=>{
 assert.match(html,/if\\(accountSharedMode\\(\\)\\)\\{/);
 assert.match(html,/await sharedReviewer\\(id\\)/);
 assert.match(html,/ACCOUNT_SHARED_PROGRESS\\[id\\]=true/);
 assert.match(html,/if\\(accountMode\\(\\)\\|\\|accountSharedMode\\(\\)\\)/);
 assert.match(sync,/learning\\/'+'flashcards\\/progress/);
 assert.match(sync,/postAccountReview\\(wordId,true,id\\)/);
 assert.match(sync,/latest.actor.id!==id/);
});
test('UX20 explicit legacy archive is accessible without replacing current personal vocabulary',()=>{
 assert.match(personal,/<details id="legacyImportDetails">/);
 assert.match(personal,/href="\\/learn.html\\?legacy=1#manage"/);
 assert.match(personal,/id="personalImportButton"/);
 assert.match(html,/const STORE='wordsky_vocab_v2'/);
 assert.match(html,/const PROGRESS='wordsky_learned'/);
 assert.match(html,/function saveServerLearned\\(\\)/);
 assert.match(html,/serverProgressMode\\(\\)/);
});
test('UX20 unavailable shared source disables only server option, not account option',()=>{
 assert.match(html,/\\$\\('flashSource'\\)\\.querySelector\\('option\\[value="server"\\]'\\)\\.disabled=true/);
 assert.match(html,/ACCOUNT_SHARED_PROGRESS===null/);
 assert.match(sync,/host.clearAccountCatalog\\(\\)/);
});
