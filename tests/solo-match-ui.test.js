import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../public/shared-nav.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('MATCH Solo is reachable from home, shared navigation and direct hash routing',()=>{
 assert.match(html,/id="screen-solo"/);
 assert.match(html,/data-screen="solo"/);
 assert.match(nav,/key:'solo'.*arena:'solo'/);
 assert.match(app,/\['home','solo','solo-bomb','solo-car','rooms','attendance','rank','admin'\]/);
 assert.match(html,/Chơi thử/);
});

test('Solo setup exposes topic, difficulty, pair count and duration controls',()=>{
 assert.match(app,/soloBombSetupForm/);assert.match(app,/soloSetupForm/);
 for(const field of ['topic_id','difficulty','question_count','duration_seconds'])assert.match(app,new RegExp(`name="${field}"`));
 assert.match(app,/Easy · không có nghĩa nhiễu/);
 assert.match(app,/Hard · thêm 4 nghĩa nhiễu/);
 assert.match(app,/value="EASY" selected/);
 assert.match(app,/name="question_count"[^>]+value="\$\{bomb\?8:6\}"/);
 assert.match(app,/name="duration_seconds"[^>]+value="90"/);
 assert.match(app,/không cộng XP/);
});

test('Solo UI uses dedicated API lifecycle and server-issued public state',()=>{
 assert.match(app,/api\(`solo\/\$\{mode\.toLowerCase\(\)\}\/start`/);
 assert.match(app,/includeWords\?'admin\/topics':'topics'/);
  assert.match(app,/api\(`solo\/runs\/\$\{pending\.runId\}\/answer`/);
 assert.match(app,/data-solo-pair-left/);
 assert.match(app,/data-solo-pair-right/);
 assert.match(app,/wordsky_solo_run/);
 assert.match(app,/attemptId:crypto\.randomUUID\(\)/);
 assert.match(app,/soloBombHome/);assert.match(app,/soloHome/);
 assert.match(app,/soloBombTopicsRetry/);assert.match(app,/soloTopicsRetry/);
 assert.match(app,/stateClass/);
 assert.match(css,/Phase 2\.1 — MATCH Solo/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});

test('uncertain Solo answers preserve one attempt across retry and reload',()=>{
 assert.match(app,/wordsky_solo_pending/);
 assert.match(app,/rememberSoloPending\(\{runId:soloGame\.runId,attemptId:crypto\.randomUUID\(\),mode:soloGame\.game\.mode,\.\.\.payload\}\)/);
 assert.match(app,/attempts\/\$\{pending\.attemptId\}/);
 assert.match(app,/\{attemptId:pending\.attemptId,leftId:pending\.leftId,rightId:pending\.rightId\}/);
 assert.match(app,/if\(!soloGame\|\|soloBusy\|\|soloPending/);
 assert.match(app,/if\(soloPending\)await resolveSoloPending\(\)/);
 assert.match(app,/method!=='GET'&&resp\.status>=500/);
 assert.match(app,/soloBombPendingRetry/);assert.match(app,/soloPendingRetry/);
 assert.doesNotMatch(app,/localStorage/);
});

test('topic compatibility keeps public summaries and loads full words for Admin editors',()=>{
 assert.match(app,/includeWords\?'admin\/topics':'topics'/);
 assert.match(app,/await loadTopics\(false,true\)/);
 assert.match(app,/topics\.flatMap\(t=>t\.words\|\|\[\]\)/);
 assert.match(app,/t\.word_count\?\?t\.words\?\.length/);
});
