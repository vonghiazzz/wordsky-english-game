import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDatabaseUrl } from '../lib/db-target.js';

const prodRef = 'ilyhbhoqswsioxxpuvcb';
const otherRef = 'abcdeabcdeabcdeabcde';
const production = `postgresql://postgres.${prodRef}:secret@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
const isolated = `postgresql://postgres.${otherRef}:isolated@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
const preview = { VERCEL_ENV: 'preview', DATABASE_URL: production };
const approved = { ...preview, WORDSKY_PREVIEW_DB_REF: otherRef, WORDSKY_PREVIEW_DATABASE_URL: isolated };

test('Production keeps its existing configured database URL', () => {
  assert.equal(resolveDatabaseUrl({ VERCEL_ENV: 'production', DATABASE_URL: production }), production);
});
test('Local development keeps its configured database URL', () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: 'postgresql://localhost:5547/wordsky_v6_test' }),
    'postgresql://localhost:5547/wordsky_v6_test');
});
test('Preview without isolated configuration fails closed', () => {
  assert.throws(() => resolveDatabaseUrl(preview), /Preview database is not verified/);
});
test('Preview rejects a URL aimed at the production project', () => {
  assert.throws(() => resolveDatabaseUrl({ ...approved, WORDSKY_PREVIEW_DATABASE_URL: production }), /Preview database is not verified/);
});
test('Preview rejects the production project ref', () => {
  assert.throws(() => resolveDatabaseUrl({ ...approved, WORDSKY_PREVIEW_DB_REF: prodRef }), /Preview database is not verified/);
});
test('Preview rejects a mismatched claimed project ref', () => {
  assert.throws(() => resolveDatabaseUrl({ ...approved, WORDSKY_PREVIEW_DB_REF: 'zzzzzabcdeabcdeabcde' }), /Preview database is not verified/);
});
test('Preview rejects the same physical DB identity with different query parameters', () => {
  assert.throws(() => resolveDatabaseUrl({ ...approved, DATABASE_URL: isolated + '?application_name=production' }), /Preview database is not verified/);
});
test('Preview accepts an explicitly isolated Supabase project reference', () => {
  assert.equal(resolveDatabaseUrl(approved), isolated);
});
test('Preview rejects non-Postgres schemes', () => {
  assert.throws(() => resolveDatabaseUrl({ ...approved, WORDSKY_PREVIEW_DATABASE_URL: 'https://example.com/' }), /Preview database is not verified/);
});
