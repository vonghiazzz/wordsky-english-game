import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
const sync=readFileSync(new URL('../public/ux13-vocab-sync.js',import.meta.url),'utf8');

test('UX14 server Flashcards track UUIDs in a separate browser key',()=>{
  assert.match(html,/const SERVER_PROGRESS='wordsky_server_learned_v1'/);
  assert.match(html,/let SERVER_WORD_IDS=new Map\(\)/);
  assert.match(html,/serverProgressId\(t,card\)/);
  assert.match(html,/SERVER_WORD_IDS=new Map\(parsed\.words\.map/);
  assert.match(html,/const mark=server\?serverProgressId\(topic,cards\[cardIndex\]\):key\(topic,cards\[cardIndex\]\[0\]\)/);
  assert.match(html,/const progress=server\?serverLearned:learned/);
  assert.match(html,/server\?saveServerLearned\(\):saveLearned\(\)/);
  assert.match(html,/serverLearned\?\.\[serverProgressId\(topic,x\)\]/);
  assert.match(html,/Kho từ máy chủ: trạng thái trên thiết bị theo UUID/);
});
test('UX14 original legacy progress keys and personal manager remain untouched by server learning',()=>{
  assert.match(html,/const STORE='wordsky_vocab_v2'/);
  assert.match(html,/const PROGRESS='wordsky_learned'/);
  assert.match(html,/function saveLearned\(\)/);
  assert.match(html,/function saveServerLearned\(\)/);
  assert.match(html,/\$\('managerTopic'\)\.replaceChildren\(\.\.\.Object\.keys\(DATA\)/);
  assert.match(html,/\$\('gameTopic'\)\.replaceChildren\(makeOption\('__all'/);
  assert.match(sync,/saveCachedServerCatalog\(localStorage,payload\)/);
});
test('UX14 server resets are local-only and preserve account review history',()=>{
  assert.match(html,/const marks=cards\.map\(c=>server\?serverProgressId\(topic,c\):key\(topic,c\[0\]\)\)/);
  assert.match(html,/Đã ôn lại từ đầu trên thiết bị\. Tiến độ tài khoản không bị thay đổi/);
  assert.match(html,/if\(server && serverLearned===null\)/);
  assert.doesNotMatch(html,/DELETE FROM ws_learning_word_progress/);
});
test('UX14 refuses to rewrite malformed existing server progress',()=>{
  assert.match(html,/serverLearned=null/);
  assert.match(html,/Không đọc được trạng thái ghi nhớ kho máy chủ/);
  assert.match(html,/if\(server&&serverLearned===null\)return/);
  assert.match(html,/if\(!safeStorage\.write\(SERVER_PROGRESS,JSON\.stringify\(serverLearned\)\)\)/);
});
