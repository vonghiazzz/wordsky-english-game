import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=read('.github/workflows/learning-ci.yml');
const policy=read('docs/ux29-release-candidate-checklist.md');

test('UX29 release CI can be manually dispatched for an exact current main SHA',()=>{
 assert.match(workflow,/^\s{2}workflow_dispatch:\s*$/m);
 assert.match(workflow,/^\s{6}expected_sha:\s*$/m);
 assert.match(workflow,/^\s+required:\s+true\s*$/m);
 assert.match(workflow,/if: github\.event_name == 'workflow_dispatch'/);
 assert.match(workflow,/EXPECTED_SHA: \$\{\{ inputs\.expected_sha \}\}/);
 assert.match(workflow,/^\s+if \[\[ ! "\$EXPECTED_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]; then/m);
 assert.match(workflow,/if \[\[ "\$GITHUB_REF" != 'refs\/heads\/main' \]\]; then/);
 assert.match(workflow,/if \[\[ "\$ACTUAL_SHA" != "\$EXPECTED_SHA" \]\] \|\| \[\[ "\$GITHUB_SHA" != "\$EXPECTED_SHA" \]\]; then/);
});

test('Manual CI retains full isolated DB and browser acceptance, never deploys Vercel',()=>{
 assert.match(workflow,/^\s{2}pull_request:\s*$/m);
 assert.match(workflow,/^\s{2}unit-and-postgres:\s*$/m);
 assert.match(workflow,/^\s{2}browser-srs-e2e:\s*$/m);
 assert.match(workflow,/node scripts\/ux29-local-insights-e2e\.mjs/);
 assert.match(workflow,/wordsky_v6_test/);
 assert.match(workflow,/127\.0\.0\.1:5547/);
 assert.doesNotMatch(workflow,/VERCEL_TOKEN|\bvercel deploy(?:\s|$)|\bvercel promote(?:\s|$)|deploy_to_vercel|mcp__Vercel__/i);
 assert.equal(JSON.parse(read('vercel.json')).git.deploymentEnabled,false);
});

test('UX29 release checklist requires distinct Preview before manually staging Production',()=>{
 for(const line of [
  'exact SHA',
  'manual Vercel Preview build',
  'Preview must not reuse Production',
  'HTTP 503',
  'Human Preview acceptance',
  'vercel deploy --prod --skip-domain',
  'vercel promote',
  '402',
  'GitHub'
 ])assert.ok(policy.toLowerCase().includes(line.toLowerCase()),
  'Missing release control: '+line);
 assert.match(policy,/already merged/);
 assert.match(policy,/older Preview/);
});

test('UX29 release checklist never asserts an unverified Preview or Production is live',()=>{
 assert.match(policy,/\*\*UX29 was not live at that time\.\*\*/);
 assert.match(policy,/Never count an older Preview as evidence/);
 assert.match(policy,/presence\s*\n\s*does \*\*not prove\*\*/);
 assert.match(policy,/do not\s*\n\s*probe it by creating trial deployments/);
});
