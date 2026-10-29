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
