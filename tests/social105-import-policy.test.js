import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseReviewCsv,planSocialBatch,hashCard} from '../lib/social1000-import-policy.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const batch=JSON.parse(read('vocab/social-life-batches/SOCIAL-01.json'));
const queue=parseReviewCsv(read('vocab/editorial/SOCIAL-1000-review-queue.csv'));
test('SOCIAL-105 default dry-run finds 100 pending entries, zero release eligible',()=>{
 const plan=planSocialBatch(batch,queue,{requireEditorial:false});
 assert.equal(plan.total,100);assert.equal(plan.eligible.length,0);assert.equal(plan.pending.length,100);
 assert.throws(()=>planSocialBatch(batch,queue),/Editorial gate BLOCKED/);
});
test('SOCIAL-105 full editorial gate requires reviewer and review note, without inventing CEFR proof',()=>{
 const copies=queue.map(x=>({...x}));
 const q=copies[0];q.cefr_review_status='APPROVED';q.bilingual_review='APPROVED';q.sense_review='APPROVED';
 q.reviewer='verified-editor';q.reviewed_at='2026-11-17T00:00:00Z';q.review_notes='Contextual A2 estimate reviewed; not Oxford-certified.';
 const plan=planSocialBatch(batch,copies,{requireEditorial:false});
 assert.equal(plan.eligible.length,1);assert.equal(plan.pending.length,99);
 assert.equal(plan.eligible[0].content_sha256,hashCard(batch.records[0]));
 assert.equal(plan.eligible[0].review_status,'PROVISIONAL');
 const stale=copies.map(x=>({...x}));stale[0].english='changed phrase';
 assert.throws(()=>planSocialBatch(batch,stale,{requireEditorial:false}),/Editorial\/source data mismatch/);
});
test('SOCIAL-105 importer cannot connect to production and never writes without a batch flag',()=>{
 const code=read('scripts/import-social1000.mjs');
 assert.match(code,/--write-local-test/);
 assert.match(code,/wordsky_v6_test/);
 assert.match(code,/localhost/);
 assert.doesNotMatch(code,/--write-production|--write-preview/);
 assert.match(code,/if\(!write\)/);
 assert.match(code,/plan.pending.length/);
 assert.match(code,/ROLLBACK/);
});
