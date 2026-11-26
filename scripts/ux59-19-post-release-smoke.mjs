// UX59.19 - anonymous GET-only release verification. Never sends credentials or writes.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const FULL_SHA = /^[0-9a-f]{40}$/;
const BASE = 'https://wordsky-english-game.vercel.app';

export function assertReleaseIdentity(actual, expected) {
  assert.match(expected, FULL_SHA, 'Expected a full lowercase commit SHA');
  assert.equal(actual?.commit_sha, expected, 'Production release SHA differs from approved main');
  assert.equal(actual?.git_ref, 'main', 'Production must be built from main');
  assert.equal(actual?.environment, 'production', 'Expected production environment');
}

export async function verifyLiveProduction(expected, fetcher = fetch, base = BASE) {
  assert.match(expected, FULL_SHA);
  const get = async (pathname) => {
    const url = new URL(pathname, base);
    assert.equal(url.origin, new URL(base).origin, 'Unexpected request origin');
    const response = await fetcher(url, {
      method: 'GET',
      redirect: 'error',
      headers: { accept: pathname.endsWith('.html') ? 'text/html' : 'application/json', 'cache-control': 'no-store' },
      signal: AbortSignal.timeout(15000)
    });
    assert.equal(response.status, 200, pathname + ' HTTP ' + response.status);
    assert.equal(response.headers.get('set-cookie'), null, pathname + ' unexpectedly set a cookie');
    return response;
  };

  const release = await (await get('/api/release')).json();
  assertReleaseIdentity(release, expected);
  console.log('PASS: production release SHA/ref/environment');

  const health = await (await get('/api/health')).json();
  assert.equal(health.ok, true);
  assert.equal(health.service, 'wordsky-v4');
  console.log('PASS: public health endpoint');

  const auth = await (await get('/api/auth/me')).json();
  assert.equal(auth.actor, null, 'Anonymous request saw an authenticated actor');
  console.log('PASS: anonymous session remains anonymous');

  const page = await get('/progress.html');
  assert.match(page.headers.get('content-type') || '', /text\/html/i);
  assert.match(await page.text(), /<html/i);
  console.log('PASS: public My Learning HTML');
  return { expected_commit_sha: expected, checks: 4 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyLiveProduction(process.env.EXPECTED_SHA || '');
    console.log('UX59.19 POST-RELEASE LIVE SMOKE PASS', JSON.stringify(result));
  } catch (error) {
    console.error('UX59.19 POST-RELEASE LIVE SMOKE FAIL:', error.stack || error);
    process.exitCode = 1;
  }
}
