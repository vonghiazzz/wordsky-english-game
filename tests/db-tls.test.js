import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPgConfig, getPool } from '../lib/db.js';

const pooler = 'postgresql://postgres.project:example@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require';
const fakeCA = '-----BEGIN CERTIFICATE-----\nTESTCA\n-----END CERTIFICATE-----';

test('Supabase remote DB requires a CA instead of silently disabling TLS verification', () => {
  assert.throws(() => buildPgConfig(pooler), { status: 503 });
  assert.throws(() => buildPgConfig(pooler, 'invalid'), { status: 503 });
});

test('Supabase remote DB uses CA, strict server certificate verification and SNI', () => {
  const cfg = buildPgConfig(pooler, fakeCA);
  assert.equal(cfg.ssl.rejectUnauthorized, true);
  assert.equal(cfg.ssl.servername, 'aws-0-ap-northeast-2.pooler.supabase.com');
  assert.equal(cfg.ssl.ca, fakeCA);
  assert.equal(new URL(cfg.connectionString).searchParams.has('sslmode'), false);
  assert.equal(new URL(cfg.connectionString).hostname, cfg.ssl.servername);
});

test('Supabase CA may be escaped in an environment variable', () => {
  const cfg = buildPgConfig(pooler, fakeCA.replaceAll('\n', '\\n'));
  assert.equal(cfg.ssl.ca, fakeCA);
});

test('Local database still works without TLS CA', () => {
  const cfg = buildPgConfig('postgresql://localhost:5432/postgres');
  assert.equal(cfg.ssl, false);
});

test('Missing DATABASE_URL returns 503 before any network calls', () => {
  const previous = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.throws(() => getPool(), { status: 503 });
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});


test('Vercel serverless pools use one connection', () => {
  for (const mode of ['preview', 'production']) {
    const cfg = buildPgConfig(pooler, fakeCA, {VERCEL_ENV: mode});
    assert.equal(cfg.max, 1);
    assert.equal(cfg.idleTimeoutMillis, 1000);
    assert.equal(cfg.connectionTimeoutMillis, 8000);
    assert.equal(cfg.ssl.rejectUnauthorized, true);
  }
});

test('Local and CI PostgreSQL retain existing pool limits', () => {
  const cfg = buildPgConfig(
    'postgresql://localhost:5547/wordsky_v6_test',
    null,
    {}
  );
  assert.equal(cfg.max, 5);
  assert.equal(cfg.idleTimeoutMillis, 10000);
  assert.equal(cfg.ssl, false);
});
