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
