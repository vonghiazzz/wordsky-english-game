import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUnifiedReview} from '../lib/unified-review.js';
const base={request_id:'11111111-1111-4111-8111-111111111111',word_id:'22222222-2222-4222-8222-222222222222',source:'shared',remembered:true};
test('UX23C optional observed version accepts only nonnegative safe integers',()=>{
 assert.equal(validateUnifiedReview({...base,expected_review_count:0}).expected_review_count,0);
 assert.equal(validateUnifiedReview({...base,expected_review_count:42}).expected_review_count,42);
 assert.equal(validateUnifiedReview(base).expected_review_count,null);
 for(const v of [-1,1.5,'0',null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>validateUnifiedReview({...base,expected_review_count:v}));
});
test('UX23C lock serializes distinct requests and rejects stale expected progress count',()=>{
 const s=readFileSync(new URL('../lib/unified-review.js',import.meta.url),'utf8');
 assert.match(s,/SELECT id FROM ws_users WHERE id=\$1 FOR UPDATE/);
 assert.match(s,/if\(request.expected_review_count!==null\)/);
 assert.match(s,/if\(count!==request.expected_review_count\)/);
 assert.match(s,/Tải lại trước khi lưu/);
 assert.ok(s.indexOf('if(request.expected_review_count!==null)')<s.indexOf("if(request.source==='shared'){"));
});
