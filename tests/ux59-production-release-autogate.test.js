import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/ux59-production-release-fingerprint.yml',import.meta.url),'utf8');

test('UX59.9 runs on reviewed main pushes and retains manual release audit',()=>{
 assert.match(workflow,/on:\n  push:\n    branches: \[main\]\n  workflow_dispatch:/);
 assert.match(workflow,/if: github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/timeout-minutes: 15/);
 assert.match(workflow,/concurrency:/);
 assert.match(workflow,/cancel-in-progress: true/);
});
test('UX59.9 waits for independently assigned production alias but fails closed',()=>{
 assert.match(workflow,/for attempt in \$\(seq 1 40\)/);
 assert.match(workflow,/node scripts\/ux59-production-release-fingerprint\.mjs/);
 assert.match(workflow,/sleep 15/);
 assert.match(workflow,/exit 1/);
 assert.match(workflow,/::error::UX59\.9 production release incomplete/);
});
test('UX59.9 post-release guard remains read only and uses no deploy token',()=>{
 assert.match(workflow,/permissions:\n  contents: read/);
 assert.doesNotMatch(workflow,/VERCEL_TOKEN|assign_alias|vercel deploy|vercel promote|POST |PATCH |DELETE |write-all/);
});
