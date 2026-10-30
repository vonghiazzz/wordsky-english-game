import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const vercel=JSON.parse(read('vercel.json'));

test('WordSky Git pushes and merges never trigger automatic Vercel deployments',()=>{
 assert.deepEqual(vercel.git,{deploymentEnabled:false},
  'Automatic deployments must remain off for Preview AND Production');
 assert.equal(vercel.github?.enabled,undefined,
  'Use the supported git.deploymentEnabled option, not deprecated github.enabled');
});

test('WordSky Vercel runtime API, rewrites, regions and security headers are preserved',()=>{
 assert.equal(vercel.regions?.[0],'icn1');
 assert.equal(vercel.functions?.['api/index.js']?.maxDuration,30);
 assert.ok(vercel.rewrites?.some(x=>x.source==='/api/:rest*'));
 assert.ok(vercel.rewrites?.some(x=>x.source==='/'));
 const headers=vercel.headers?.flatMap(x=>x.headers||[])||[];
 for(const name of ['X-Content-Type-Options','Referrer-Policy','X-Frame-Options'])
  assert.ok(headers.some(h=>h.key===name),'Missing '+name);
});

test('WordSky GitHub PR CI stays enabled for feature development',()=>{
 const ci=read('.github/workflows/learning-ci.yml');
 assert.match(ci,/pull_request:\s*\n\s+branches:\s*\n\s+- main/);
 assert.match(ci,/npm run check/);
 assert.match(ci,/npm test/);
 assert.match(ci,/Run account sync and browser SRS acceptance/);
});

test('Manual release instructions require approved Preview before Production',()=>{
 const doc=read('docs/manual-vercel-release-policy.md');
 for(const phrase of [
  'one **explicit** Vercel Preview deployment',
  'Require READY',
  'After successful Preview and human verification',
  'vercel deploy --prod --skip-domain',
  'vercel promote',
  'isolated PostgreSQL DB',
  'No Vercel deployment is created solely from pushes'
 ])assert.ok(doc.includes(phrase),'Missing release gate: '+phrase);
});

test('WordSky pins Node 24 across Vercel, lockfile, CI and local development',()=>{
 const pkg=JSON.parse(read('package.json'));
 const lock=JSON.parse(read('package-lock.json'));
 assert.equal(pkg.engines.node,'24.x','Vercel must not auto-select Node 26');
 assert.equal(lock.packages[''].engines.node,'24.x','npm lockfile must match package.json');
 assert.equal(read('.nvmrc').trim(),'24','local developer runtime must match CI');
 const ci=read('.github/workflows/learning-ci.yml');
 const smoke=read('.github/workflows/ux26-production-readonly-smoke.yml');
 assert.equal((ci.match(/node-version:\s*'24'/g)||[]).length,2,
  'Both unit/PostgreSQL and Chromium/Firefox jobs must use Node 24');
 assert.equal((ci.match(/Verify Node.js 24 runtime/g)||[]).length,2);
 assert.equal((smoke.match(/node-version:\s*'24'/g)||[]).length,1,
  'Read-only smoke should not run on a different Node version');
 assert.doesNotMatch(ci+smoke,/node-version:\s*['"](?:22|26)['"]/);
 assert.deepEqual(vercel.git,{deploymentEnabled:false},
  'Pinning Node must never enable Git-triggered Vercel deploys');
});
