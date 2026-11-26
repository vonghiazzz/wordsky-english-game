import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReleaseIdentity, verifyLiveProduction } from '../scripts/ux59-19-post-release-smoke.mjs';

const sha = 'a'.repeat(40);
test('UX59.19 validates exact production release identity', () => {
  assert.doesNotThrow(() => assertReleaseIdentity({commit_sha:sha,git_ref:'main',environment:'production'},sha));
  assert.throws(() => assertReleaseIdentity({commit_sha:'b'.repeat(40),git_ref:'main',environment:'production'},sha));
  assert.throws(() => assertReleaseIdentity({commit_sha:sha,git_ref:'feature',environment:'production'},sha));
  assert.throws(() => assertReleaseIdentity({commit_sha:sha,git_ref:'main',environment:'preview'},sha));
});

test('UX59.19 only issues anonymous same-origin GETs', async () => {
  const paths = [];
  const fakeFetch = async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.ok(!('cookie' in options.headers));
    assert.equal(url.origin, 'https://wordsky-english-game.vercel.app');
    paths.push(url.pathname);
    const data = url.pathname === '/api/release'
      ? JSON.stringify({commit_sha:sha,git_ref:'main',environment:'production'})
      : url.pathname === '/api/health'
        ? JSON.stringify({ok:true,service:'wordsky-v4',database:true})
        : url.pathname === '/api/auth/me' ? JSON.stringify({actor:null}) : '<html>WordSky</html>';
    return new Response(data,{status:200,headers:{'content-type':url.pathname.endsWith('.html')?'text/html':'application/json'}});
  };
  const result = await verifyLiveProduction(sha, fakeFetch);
  assert.equal(result.checks, 4);
  assert.deepEqual(paths,['/api/release','/api/health','/api/auth/me','/progress.html']);
});

test('UX59.19 fails closed on HTTP errors and cross-actor data', async () => {
  await assert.rejects(verifyLiveProduction(sha,async()=>new Response('{}',{status:503})),/HTTP 503/);
  const fakeFetch = async url => new Response(url.pathname === '/api/release'
    ? JSON.stringify({commit_sha:sha,git_ref:'main',environment:'production'})
    : url.pathname === '/api/health' ? JSON.stringify({ok:true,service:'wordsky-v4'})
    : JSON.stringify({actor:{id:'unexpected'}}),{status:200});
  await assert.rejects(verifyLiveProduction(sha,fakeFetch),/Anonymous request saw an authenticated actor/);
});
