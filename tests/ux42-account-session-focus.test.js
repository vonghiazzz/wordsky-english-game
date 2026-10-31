import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const client=readFileSync(new URL('../public/account.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/account.html',import.meta.url),'utf8');
const e2e=readFileSync(new URL('../scripts/ux40-player-password-e2e.mjs',import.meta.url),'utf8');

test('UX42 resumes account session validation on focus, visibility and BFCache restore',()=>{
 assert.match(client,/window\.addEventListener\('focus',\(\)=>recheckVisibleSession\(\)\)/);
 assert.match(client,/document\.addEventListener\('visibilitychange',\(\)=>recheckVisibleSession\(\)\)/);
 assert.match(client,/window\.addEventListener\('pageshow',event=>/);
 assert.match(client,/if\(event\.persisted\)/);
 assert.match(client,/recheckVisibleSession\(true\)/);
 assert.match(client,/document\.visibilityState==='hidden'/);
 assert.match(client,/now-lastAuthCheckAt<750/);
 assert.doesNotMatch(client,/setInterval\(|navigator\.sendBeacon|localStorage|sessionStorage/);
});

test('UX42 invalid account is hidden, credentials cleared and stale GET responses discarded',()=>{
 assert.match(client,/let authCheckSeq=0/);
 assert.match(client,/const check=\+\+authCheckSeq/);
 assert.match(client,/if\(check!==authCheckSeq\|\|pending\)return/);
 assert.match(client,/if\(actorId&&actorId!==data\.actor\.id\)/);
 assert.match(client,/clearPasswords\(\)/);
 assert.match(client,/byId\('ws40Username'\)\.value=''/);
 assert.match(client,/showGuest\('Phiên đăng nhập không còn hiệu lực/);
 assert.match(client,/const securityActionComplete=\(\)=>!done\.hidden\|\|!byId\('ws41Done'\)\.hidden/);
 assert.equal((client.match(/\+\+authCheckSeq/g)||[]).length>=4,true);
});

test('UX42 does not disturb authenticated password-changing / session-revocation handlers',()=>{
 assert.match(client,/api\('auth\/change-password'/);
 assert.match(client,/api\('auth\/revoke-sessions'/);
 assert.match(client,/expected_actor_id:actorId/);
 assert.match(client,/confirm_revoke_all:true/);
 assert.match(client,/if\(pending\|\|securityActionComplete\(\)\)return/);
 for(const id of ['ws40Form','ws41Form','ws40Guest','ws40Done','ws41Done'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(e2e,/await stalePage\.locator\('#ws40Guest'\)\.waitFor\(\{state:'visible'\}\)/);
 assert.match(e2e,/await stalePage\.locator\('#ws40Current'\)\.inputValue\(\)/);
 assert.match(e2e,/await stalePage\.locator\('#ws40Form'\)\.waitFor\(\{state:'visible'\}\)/);
});
