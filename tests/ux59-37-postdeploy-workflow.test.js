import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Offline contract: automatic read-only smoke must only start after the
// external Vercel status is SUCCESS for the current main commit.
// Never gate on a main push: Git-triggered Vercel deploys are disabled.
const workflow=readFileSync(
  new URL('../.github/workflows/ux59-35-post-deploy-smoke.yml',import.meta.url),
  'utf8'
);

test('UX59.37 post-deploy workflow does not race manual production deployment',()=>{
  assert.match(workflow,/^  status:\s*$/m);
  assert.doesNotMatch(workflow,/^  push:/m);
  assert.match(workflow,/^  workflow_dispatch:\s*$/m);
  assert.match(workflow,/github\.event_name == 'status'/);
  assert.match(workflow,/github\.event\.context == 'Vercel'/);
  assert.match(workflow,/github\.event\.state == 'success'/);
  assert.match(workflow,/github\.event\.sha == github\.sha/);
});

test('UX59.37 binds event SHA to exact checked-out main commit',()=>{
  assert.match(workflow,/test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$COMMIT_SHA"/);
  assert.match(workflow,/test "\$DEPLOYED_SHA" = "\$COMMIT_SHA"/);
  assert.match(workflow,/test "\$STATUS_CONTEXT" = "Vercel"/);
  assert.match(workflow,/test "\$STATUS_STATE" = "success"/);
});

test('UX59.37 still executes GET-only post-deploy test and publishes status',()=>{
  assert.match(workflow,/run: node scripts\/ux59-35-postdeploy-smoke\.mjs/);
  assert.match(workflow,/context="WordSky Post-Deploy HTTP Smoke"/);
  assert.match(workflow,/statuses: write/);
  assert.match(workflow,/if: always\(\)/);
});
