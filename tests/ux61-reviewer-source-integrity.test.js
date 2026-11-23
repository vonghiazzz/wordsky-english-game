/* UX61.13: browser-side input pinning for accidental/stale/tampered forms.
 * The server-side UX61.9/61.10 comparison remains authoritative; this UI
 * integrity check is NOT a signed approval or proof of reviewer identity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBlindReviewTemplate} from '../lib/ux61-9-blind-review.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const evidence=JSON.parse(read('../docs/ux61-8-editorial-evidence.json'));
const forms=['REVIEWER_A','REVIEWER_B'].map(code=>JSON.parse(
 read('../docs/ux61-9-review-templates/ux61-9-'+code+'.json')));
const pages=[read('../public/editorial-reviewer.html'),
 read('../tools/ux61-11-reviewer-form.html')];
const manifest=evidence.cards.map(c=>({
 word_id:c.word_id,english:c.english,topic:c.topic,
 meaning:c.existing_meaning,example:c.original_example,
 translation:c.original_translation,source_url:c.source_url
}));
test('UX61.13 pins the exact live-audited six-card source and review template revision',()=>{
 for(const form of forms){
  const pristine=createBlindReviewTemplate(evidence,form.review_code);
  assert.deepEqual(form,pristine,'Published blind template drift');
 }
 assert.equal(forms[0].source_snapshot_sha256,forms[1].source_snapshot_sha256);
 assert.deepEqual(forms[0].cards.map(c=>Object.fromEntries(
  Object.keys(manifest[0]).map(key=>[key,c[key]]))),manifest);
 for(const page of pages){
  assert.ok(page.includes('const SOURCE_SNAPSHOT='+JSON.stringify(forms[0].source_snapshot_sha256)+';'),
   'Form must pin source revision, not just accept any 64-character string');
  assert.ok(page.includes('const SOURCE_RECORDS=Object.freeze('+JSON.stringify(manifest)+'.map(row=>Object.freeze(row)));'),
   'Every immutable public vocabulary field must be pinned');
  assert.ok(page.includes('const SOURCE_INSTRUCTIONS='+JSON.stringify(forms[0].instructions)+';'),
   'Form instructions cannot be silently edited');
  assert.match(page,/input\.source_snapshot_sha256!==SOURCE_SNAPSHOT/u);
  assert.match(page,/input\.instructions!==SOURCE_INSTRUCTIONS/u);
  assert.match(page,/immutable\.every\(key=>card\[key\]===SOURCE_RECORDS\[i\]\[key\]\)/u);
  assert.match(page,/Hãy xin file A\/B mới từ người điều phối/u);
  assert.doesNotMatch(page,/innerHTML\s*=/u);
  assert.doesNotMatch(page,/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/u);
 }
});
test('UX61.13 both browser versions enforce the same validation code',()=>{
 const extract=html=>html.match(/<script>\n([\s\S]*?)\n<\/script>/u)?.[1];
 assert.equal(extract(pages[0]),extract(pages[1]));
});
