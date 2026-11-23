/* UX61.12 public reviewer entrypoint: no uploads, approval or SRS mutation.
 * Static contract verified before CI; live Preview Chrome confirms behavior.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const online=read('../public/editorial-reviewer.html');
const offline=read('../tools/ux61-11-reviewer-form.html');
const cfg=JSON.parse(read('../vercel.json'));
const getScript=html=>html.match(/<script>\n([\s\S]*?)\n<\/script>/u)?.[1];
const getStyle=html=>html.match(/<style>\n([\s\S]*?)\n<\/style>/u)?.[1];

test('UX61.12 public reviewer uses the identical vetted offline JS/CSS',()=>{
 assert.ok(getScript(online)&&getStyle(online));
 assert.equal(getScript(online),getScript(offline),
  'Hosted UI must not diverge from vetted offline import/export code');
 assert.equal(getStyle(online),getStyle(offline));
 assert.match(online,/<html lang="vi">/);
 assert.match(online,/noindex,nofollow,noarchive/);
 assert.match(online,/REVIEWER_A/);
 assert.match(online,/REVIEWER_B/);
 assert.match(online,/Phiếu kiểm duyệt/);
 assert.doesNotMatch(online,/innerHTML\s*=/u);
 assert.doesNotMatch(online,/XMLHttpRequest|navigator\.sendBeacon|WebSocket|EventSource|\bfetch\s*\(/u);
 assert.doesNotMatch(online,/<script[^>]+src=/u);
 assert.doesNotMatch(online,/<iframe|<object|<embed/iu);
});

test('UX61.12 hosted form has strict response header CSP and no cache or index',()=>{
 const route=cfg.headers.find(h=>h.source==='/editorial-reviewer.html');
 assert.ok(route,'Missing dedicated headers for hosted reviewer');
 assert.ok(cfg.headers.findIndex(h=>h.source==='/editorial-reviewer.html')>
  cfg.headers.findIndex(h=>h.source==='/(.*)'),
  'Specific no-referrer response must override generic site header');
 const headers=Object.fromEntries(route.headers.map(h=>[h.key.toLowerCase(),h.value]));
 assert.equal(headers['cache-control'],'no-store');
 assert.match(headers['x-robots-tag'],/noindex/);
 assert.equal(headers['referrer-policy'],'no-referrer');
 for(const directive of [
  "default-src 'none'","connect-src 'none'","form-action 'none'",
  "object-src 'none'","base-uri 'none'","frame-ancestors 'none'"
 ])assert.ok(headers['content-security-policy'].includes(directive),
  'Missing CSP directive: '+directive);
 assert.match(online,/connect-src 'none'/);
 assert.ok(!cfg.rewrites.some(rule=>rule.source==='/editorial-reviewer.html'&&
  rule.destination.includes('/api/')),
  'Reviewer file must be served as static HTML, never an API');
});

test('UX61.12 review form still cannot approve or auto-submit SRS',()=>{
 assert.match(online,/Không phải phê duyệt/);
 assert.match(online,/không lưu dữ liệu phiếu lên máy chủ WordSky/);
 assert.match(online,/base\.review_code/);
 assert.match(online,/JSON\.stringify\(output,null,2\)/);
 assert.match(online,/URL\.createObjectURL\(blob\)/);
 assert.doesNotMatch(online,/authorized_to_grade_srs\s*:\s*true/u);
});
