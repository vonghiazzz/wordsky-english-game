import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(
  new URL('../scripts/ux59-35-postdeploy-smoke.mjs',import.meta.url),'utf8');
const workflow=readFileSync(
  new URL('../.github/workflows/ux59-35-post-deploy-smoke.yml',import.meta.url),'utf8');

test('UX59.38 production smoke checks exactly eight grounded read-only routes',()=>{
  const checks=[...source.matchAll(/await check\('([^']+)',(\d+),'([^']+)'/g)]
    .map(([,path,code,type])=>({path,code:Number(code),type}));
  assert.deepEqual(checks,[
    {path:'/',code:200,type:'text/html'},
    {path:'/progress.html',code:200,type:'text/html'},
    {path:'/learn.html',code:200,type:'text/html'},
    {path:'/verbs.html',code:200,type:'text/html'},
    {path:'/ux10-progress.js',code:200,type:'javascript'},
    {path:'/api/auth/me',code:200,type:'application/json'},
    {path:'/api/learning/me/summary',code:401,type:'application/json'},
    {path:'/api/learning/srs/queue?status=due&page=0&size=20',
      code:401,type:'application/json'}
  ]);
  assert.match(source,/method:'GET'/);
  assert.doesNotMatch(source,/method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/);
  assert.match(source,/assert\.equal\(url\.origin,origin\)/);
});

test('UX59.38 samples durations without imposing uncalibrated load-test budgets',()=>{
  assert.match(source,/const started=performance\.now\(\)/);
  assert.match(source,/durationMs:durationMs|durationMs\}\)/);
  assert.match(source,/p95Ms:p95/);
  assert.match(source,/not a load test/);
  assert.match(source,/8\/8 PASS/);
  assert.match(workflow,/8 read-only production GET checks PASS/);
});
