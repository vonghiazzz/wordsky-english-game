import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import handler from '../api/index.js';
import { issueSession } from '../lib/security.js';

const topicId = '33333333-3333-4333-8333-333333333333';
const eventId = '11111111-1111-4111-8111-111111111111';
const wordId = '44444444-4444-4444-8444-444444444444';
const secret = 'test-session-secret-test-session-secret-123456';
const originalDb = process.env.DATABASE_URL;
const originalSecret = process.env.SESSION_SECRET;
const originalAdmin = process.env.ADMIN_USERNAME;
const originalHash = process.env.ADMIN_PASSWORD_HASH;

process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.SESSION_SECRET = secret;
process.env.ADMIN_USERNAME = 'owner';
process.env.ADMIN_PASSWORD_HASH = 'scrypt:01234567890123456789012345678901:' + '11'.repeat(64);
const cookie = 'ws_auth=' + issueSession({ role: 'admin', id: 'owner' }, secret);
let log = [];
let available = 10;
let carStock={a2:30,bonus:30,double:30};
let eventStatus = 'DRAFT';
let openedRounds = [];
let topicUsedByActiveEvent = false;

const originalConnect = pg.Pool.prototype.connect;
pg.Pool.prototype.connect = async function () {
  return {
    async query(sql) {
      log.push(sql);
      if (sql.includes("count(DISTINCT lower(w.english)) FILTER (WHERE w.cefr_level")) return { rows: [carStock] };
      if (sql.startsWith('SELECT count(*)::int AS n FROM ws_words')) return { rows: [{ n: available }] };
      if (sql.startsWith('SELECT e.id FROM ws_events e JOIN ws_rounds')) return { rows: topicUsedByActiveEvent ? [{ id: eventId }] : [] };
      if (sql.startsWith('SELECT topic_id FROM ws_words WHERE id=$1 FOR UPDATE')) return { rows: [{ topic_id: topicId }] };
      if (sql.startsWith('SELECT * FROM ws_events WHERE id=$1 FOR UPDATE')) return { rows: [{ id: eventId, status: eventStatus }] };
      if (sql.startsWith('SELECT mode,difficulty,question_count,topic_id FROM ws_rounds')) return { rows: openedRounds };
      if (sql.startsWith('INSERT INTO ws_events')) return { rows: [{ id: eventId, join_code: 'ROOMABC', status: 'DRAFT' }] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
};

async function req(method, path, body) {
  const result = {};
  const request = { method, url: '/api/' + path, query: { rest: path }, headers: { cookie }, body: body ?? {}, socket: {} };
  const response = { statusCode: 200, setHeader() {}, end(x) { result.status = this.statusCode; result.data = JSON.parse(x); } };
  await handler(request, response);
  return result;
}

const sample = (difficulty, count) => ({ mode: 'MATCH', difficulty, topic_id: topicId,
  duration_seconds: 90, question_count: count, points_per_correct: 100, penalty: 25, weight: 1 });

function bodyFor(round) {
  return { title: 'Test WordSky Cup', password: 'TestRoomPass123', max_players: 5, rounds: [round] };
}

test('API rejects a HARD MATCH with too few words before inserting the event', async () => {
  log = []; available = 10;
  const result = await req('POST', 'admin/events', bodyFor(sample('HARD', 8)));
  assert.equal(result.status, 400);
  assert.ok(result.data.error.includes('12'));
  assert.ok(!log.some(x => x.startsWith('INSERT INTO ws_events')));
  assert.ok(log.includes('ROLLBACK'));
});

test('API creates a NORMAL MATCH only after vocabulary has been checked', async () => {
  log = []; available = 10;
  const result = await req('POST', 'admin/events', bodyFor(sample('NORMAL', 8)));
  assert.equal(result.status, 201);
  const countIndex = log.findIndex(x => x.startsWith('SELECT count(*)::int AS n FROM ws_words'));
  const insertIndex = log.findIndex(x => x.startsWith('INSERT INTO ws_events'));
  assert.ok(countIndex >= 0 && insertIndex > countIndex);
  assert.ok(log.includes('COMMIT'));
});

test('API revalidates vocabulary before opening an event after words are hidden', async () => {
  log = []; available = 10; eventStatus = 'DRAFT';
  openedRounds = [sample('HARD', 8)];
  const result = await req('POST', 'admin/events/' + eventId + '/open');
  assert.equal(result.status, 400);
  assert.ok(!log.some(x => x.startsWith('UPDATE ws_events SET status=')));
});

test('API permits opening an event only when its rounds are feasible', async () => {
  log = []; available = 10; eventStatus = 'DRAFT';
  openedRounds = [sample('NORMAL', 8)];
  const result = await req('POST', 'admin/events/' + eventId + '/open');
  assert.equal(result.status, 200);
  assert.equal(result.data.status, 'OPEN');
  assert.ok(log.some(x => x.startsWith('UPDATE ws_events SET status=')));
});

test('API rejects an event using a missing topic even when word stock is large', async () => {
  log = []; available = 50;
  const invalid = sample('NORMAL', 8);
  invalid.topic_id = null;
  const result = await req('POST', 'admin/events', bodyFor(invalid));
  assert.equal(result.status, 400);
  assert.ok(!log.some(x => x.startsWith('INSERT INTO ws_events')));
});


test('API refuses changing a topic referenced by an OPEN or LIVE event', async () => {
  log = []; topicUsedByActiveEvent = true;
  const result = await req('DELETE', 'admin/topics/' + topicId);
  assert.equal(result.status, 409);
  assert.ok(!log.some(x => x.startsWith('UPDATE ws_topics SET enabled=')));
  topicUsedByActiveEvent = false;
});

test('API refuses deleting a word referenced by an OPEN or LIVE event', async () => {
  log = []; topicUsedByActiveEvent = true;
  const result = await req('DELETE', 'admin/words/' + wordId);
  assert.equal(result.status, 409);
  assert.ok(!log.some(x => x.startsWith('UPDATE ws_words SET enabled=')));
  topicUsedByActiveEvent = false;
});

test('API refuses changing a word referenced by an OPEN or LIVE event', async () => {
  log = []; topicUsedByActiveEvent = true;
  const result = await req('PATCH', 'admin/words/' + wordId, { english: 'newword', meaning: 'newmeaning' });
  assert.equal(result.status, 409);
  assert.ok(!log.some(x => x.startsWith('UPDATE ws_words SET english=')));
  topicUsedByActiveEvent = false;
});

test('API allows changing vocabulary when no OPEN or LIVE event references it', async () => {
  log = []; topicUsedByActiveEvent = false;
  const result = await req('DELETE', 'admin/words/' + wordId);
  assert.equal(result.status, 200);
  assert.ok(log.some(x => x.startsWith('UPDATE ws_words SET enabled=')));
});

test.after(() => {
  pg.Pool.prototype.connect = originalConnect;
  for (const [key, value] of [
    ['DATABASE_URL', originalDb], ['SESSION_SECRET', originalSecret],
    ['ADMIN_USERNAME', originalAdmin], ['ADMIN_PASSWORD_HASH', originalHash],
  ]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

const carRound=(difficulty='NORMAL',count=8)=>({mode:'CAR',difficulty,topic_id:null,
 duration_seconds:120,question_count:count,points_per_correct:100,penalty:25,weight:1});
test('CAR: server refuses creating a room without enough approved C1/C2 words',async()=>{
 log=[];carStock={a2:30,bonus:30,double:4};
 const out=await req('POST','admin/events',bodyFor(carRound('NORMAL',8)));
 assert.equal(out.status,400);
 assert.match(out.data.error,/C1/);
 assert.equal(log.some(x=>x.startsWith('INSERT INTO ws_events')),false);
 carStock={a2:30,bonus:30,double:30};
});
test('CAR: server checks approved per-tier stock before creating a room',async()=>{
 log=[];carStock={a2:30,bonus:30,double:30};
 const out=await req('POST','admin/events',bodyFor(carRound('EASY',8)));
 assert.equal(out.status,201);
 assert.equal(log.some(x=>x.includes('cefr_review_status=\'APPROVED\'')),true);
 assert.ok(log.some(x=>x.includes("w.cefr_level IN ('A1','A2')")),'CAR stock SQL must count both A1 and A2');
});
