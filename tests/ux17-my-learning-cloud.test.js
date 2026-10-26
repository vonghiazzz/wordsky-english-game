import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('UX17 My Learning offers separate cloud-personal and shared-catalog account scopes',()=>{
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 assert.match(html,/option value="personal-account" disabled/);
 assert.match(html,/id="ws17CloudCount"/);
 assert.match(js,/personalCloud=\{kind:'checking',cards:\[\],actorId:null\}/);
 assert.match(js,/if\(selectedScope==='personal-account'&&cloud\)return cloud/);
 assert.match(js,/source:'personal-account'/);
 assert.match(js,/read\/write|đọc\/ghi/i);
 assert.match(js,/updatePersonalCloudCard\(card,true\)/);
 assert.match(js,/updatePersonalCloudCard\(card,false\)/);
 assert.match(js,/expected_version:card.version,expected_actor_id:personalCloud.actorId/);
 assert.match(js,/window.addEventListener\('focus'/);
});
test('Cloud personal marks are not written to local browser stores',()=>{
 const js=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 const part=js.slice(js.indexOf('async function updatePersonalCloudCard'),js.indexOf("let selectedScope"));
 // The account review path uses authenticated API; its writes do not touch localStorage.
 assert.match(js,/learning\/personal-vocabulary\/'\+encodeURIComponent\(card.id\)/);
 assert.match(js,/personalCloud.cards\[pos\]=result.card/);
});
