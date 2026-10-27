import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importLegacyBatch,LEGACY_BATCH_SIZE} from '../lib/legacy-learning-import.js';
import {planThreeWayLegacyImport} from '../public/ux21-legacy-reconciliation.js';

const local=(i,known=true)=>({
 topic:'Bulk Import',english:'test-word-'+i,ipa:'',meaning:'Nghĩa '+i,
 example:'',translation:'',known
});
const sum={scope:'unified-account',actor_id:'test-account',words:[]};
test('UX22 user can reconcile 260 local cards in one review without losing a card',()=>{
 const original=Array.from({length:260},(_,i)=>local(i));
 const plan=planThreeWayLegacyImport({words:original,error:null},sum);
 assert.equal(plan.error,null);
 assert.equal(plan.entries.length,260);
 assert.equal(plan.counts.newCards,260);
 const chunks=[];for(let i=0;i<plan.entries.length;i+=LEGACY_BATCH_SIZE)
   chunks.push(plan.entries.slice(i,i+LEGACY_BATCH_SIZE));
 assert.equal(chunks.length,13);
 assert.ok(chunks.every(c=>c.length===20));
 assert.deepEqual(chunks.flat().map(x=>x.word.english),
   original.map(x=>x.english));
});
test('UX22 batch import rejects invalid and oversized payloads before DB access',async()=>{
 const valid={card:local(1),known:true};
 for(const payload of [
  null,{}, {cards:[]},{cards:Array.from({length:21},()=>valid)},
  {cards:[{card:local(1),known:'yes'}]},
  {cards:[{card:{...local(1),english:''},known:true}]},
  {cards:[null]}
 ]){
  await assert.rejects(()=>importLegacyBatch('invalid-user',payload));
 }
});
test('UX22 server executes all 20 cards under one owner-scoped transaction',()=>{
 const service=readFileSync(new URL('../lib/legacy-learning-import.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(service,/export const LEGACY_BATCH_SIZE=20/);
 assert.match(service,/return transaction\(async db=>\{\s*await lockImportActor\(db,userId\);\s*const counts/);
 assert.match(service,/await importLegacyCard\(db,userId,card\)/);
 assert.match(service,/SELECT id FROM ws_users WHERE id=\$1 FOR UPDATE/);
 assert.match(service,/ON CONFLICT\(user_id,/);
 assert.match(service,/DO NOTHING/);
 assert.match(api,/key==='learning\/import\/legacy\/batch'/);
 assert.match(api,/input.expected_actor_id!==undefined&&input.expected_actor_id!==userId/);
 assert.match(api,/body\(req,96000\)/);
 assert.match(api,/importLegacyBatch\(userId,input\)/);
});
test('UX22 one confirmation automatically processes all chunks and reports progress',()=>{
 const html=readFileSync(new URL('../public/personal.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ux18-personal.js',import.meta.url),'utf8');
 assert.match(html,/Đồng bộ toàn bộ từ hợp lệ/);
 assert.match(html,/id="personalImportProgress"/);
 assert.match(html,/id="personalImportLive"/);
 assert.match(js,/window.confirm\('Đồng bộ TẤT CẢ '/);
 assert.match(js,/for\(let offset=0;offset<total;offset\+=20\)/);
 assert.match(js,/all.slice\(offset,offset\+20\)/);
 assert.match(js,/learning\/import\/legacy\/batch/);
 assert.match(js,/progress.value=completed/);
 assert.match(js,/signature\(latest.entries\)!==signature\(all\)/);
 assert.match(js,/deviceSignature/);
 assert.doesNotMatch(js,/localStorage.setItem/);
});
