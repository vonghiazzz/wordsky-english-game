import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from '../lib/security.js';

const apiBase = 'http://127.0.0.1:3000/api/';
const db = new pg.Pool({
  connectionString:
    'postgresql://wordsky_test:wordsky_local_only@127.0.0.1:5547/wordsky_v6_test',
  ssl: false
});

let qaId;
const check = name => console.log('PASS:', name);
const browser = () => ({ cookie: '' });

async function call(b, route, method = 'GET', payload, expected = 200) {
  const headers = { accept: 'application/json' };
  if (b.cookie) headers.cookie = b.cookie;

  if (payload !== undefined) {
    headers.origin = 'http://localhost:3000';
    headers['content-type'] = 'application/json';
  }

  const r = await fetch(apiBase + route, {
    method,
    headers,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(10000)
  });

  const set = r.headers.get('set-cookie');
  if (set?.startsWith('ws_auth=')) b.cookie = set.split(';')[0];

  const data = await r.json();
  if (expected !== null) {
    assert.equal(r.status, expected,
      `${method} ${route}: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { status: r.status, data };
}

try {
  const x = (await db.query(`
    SELECT current_database() AS db,
      to_regclass('public.ws_learning_flashcard_reviews') AS a,
      to_regclass('public.ws_learning_word_progress') AS b,
      to_regclass('public.ws_personal_cards') AS c,
      to_regclass('public.ws_personal_card_reviews') AS d,
      to_regclass('public.ws_personal_card_progress') AS e,
      to_regclass('public.ws_learning_review_requests') AS f,
      to_regclass('public.ws_user_srs_schedules') AS g
  `)).rows[0];

  assert.equal(x.db, 'wordsky_v6_test');
  assert.ok('abcdefg'.split('').every(k => x[k]),
    'Missing UX10/UX17/UX23/UX24 tables');
  check('7 learning tables exist in local PostgreSQL');

  const username = 'qa' + randomBytes(7).toString('hex');
  const password = randomBytes(24).toString('hex');

  qaId = (await db.query(
    `INSERT INTO ws_users(username,display_name,password_hash)
     VALUES($1,$2,$3) RETURNING id`,
    [username, 'Local QA Test', hashPassword(password)]
  )).rows[0].id;

  const A = browser(), B = browser();

  await call(A, 'auth/login', 'POST', { username, password });
  await call(B, 'auth/login', 'POST', { username, password });

  assert.equal((await call(B, 'auth/me')).data.actor.id, qaId);
  check('Two browser sessions authenticate against local DB');

  const catalog = (await call(A, 'learning/flashcards/catalog')).data;
  assert.ok(catalog.words?.length, 'Local vocabulary not seeded');

  const id = catalog.words[0].word_id;
  const review = {
    request_id: randomUUID(),
    source: 'shared',
    word_id: id,
    remembered: true,
    expected_review_count: 0,
    expected_actor_id: qaId
  };

  assert.equal(
    (await call(A, 'learning/reviews', 'POST', review, 201)).data.replayed,
    false
  );
  assert.equal(
    (await call(B, 'learning/reviews', 'POST', review, 200)).data.replayed,
    true
  );

  await call(B, 'learning/reviews', 'POST', {
    ...review,
    request_id: randomUUID(),
    remembered: false
  }, 409);

  check('Idempotent review replay and stale write rejection');

  const summary = (await call(B, 'learning/me/summary')).data;
  assert.equal(
    summary.words.find(w => w.source === 'shared' && w.id === id)?.review_count,
    1
  );
  check('Browser B sees Browser A shared-word progress');

  const card = (await call(A, 'learning/personal', 'POST', {
    topic: 'Local QA',
    english: 'qa' + randomBytes(4).toString('hex'),
    meaning: 'Test word'
  }, 201)).data;

  assert.ok(
    (await call(B, 'learning/personal')).data.words.some(w => w.id === card.id)
  );

  await call(A, 'learning/reviews', 'POST', {
    request_id: randomUUID(),
    source: 'personal',
    word_id: card.id,
    remembered: false,
    expected_review_count: 0,
    expected_actor_id: qaId
  }, 201);

  assert.equal(
    (await call(B, 'learning/me/summary')).data.words
      .find(w => w.id === card.id)?.review_count,
    1
  );

  check('Personal vocabulary and review sync across sessions');

  const due = (await call(
    B, 'learning/srs/queue?status=due&size=100'
  )).data;

  const upcoming = (await call(
    A, 'learning/srs/queue?status=upcoming&size=100'
  )).data;

  assert.ok(due.words.some(w => w.id === card.id));
  assert.ok(upcoming.words.some(w => w.id === id));

  const diag = (await call(A, 'learning/srs/diagnostics')).data;
  assert.equal(diag.status, 'complete');
  assert.equal(diag.matched, 2);
  assert.equal(diag.missing, 0);
  assert.equal(diag.mismatched, 0);

  check('SRS Due/Upcoming and persisted schedules match 2/2');

  const race = await Promise.all(
    [A, B].map((b, i) =>
      call(b, 'learning/reviews', 'POST', {
        ...review,
        request_id: randomUUID(),
        remembered: i === 0,
        expected_review_count: 1
      }, null)
    )
  );

  assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);

  assert.equal(
    (await call(A, 'learning/me/summary')).data.words
      .find(w => w.id === id)?.review_count,
    2
  );
  assert.equal(
    (await call(A, 'learning/srs/diagnostics')).data.mismatched,
    0
  );

  check('Concurrent reviews serialize without SRS drift');
  console.log('\nWORDSKY LOCAL SRS QA: 7/7 PASS');

} catch (e) {
  console.error('\nWORDSKY LOCAL SRS QA: FAIL:', e.message);
  process.exitCode = 1;
} finally {
  if (qaId) {
    try {
      await db.query('DELETE FROM ws_users WHERE id=$1', [qaId]);
      console.log('Removed temporary local QA user');
    } catch (e) {
      console.error('Local QA cleanup failed:', e.message);
      process.exitCode = 1;
    }
  }
  await db.end();
}
