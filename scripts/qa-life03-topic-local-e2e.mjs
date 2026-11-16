/*
 * LIFE-03 local-only PostgreSQL acceptance test.
 * Always rolls back changes. This script never opens a remote connection,
 * never enables topics, and runs AFTER the existing SRS browser E2E suite.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {
 resolveLife03RegistrationTarget,validateLife03TopicProposal,
 registerInactiveLife03Topic,LIFE03_TOPIC_NAME
} from '../lib/vocab-life03-topic-preview-policy.js';

const url=process.env.DATABASE_URL;
const target=resolveLife03RegistrationTarget(['--write-local-test'],{
 WORDSKY_TEST_DATABASE_URL:url,
 WORDSKY_TARGET_ENV:process.env.WORDSKY_TARGET_ENV,
 VERCEL_ENV:process.env.VERCEL_ENV
});
assert.equal(target.mode,'local-test');
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const plan=validateLife03TopicProposal(
 read('vocab/life-1000-roadmap.json'),
 read('db/seed-vocabulary.json'),
 read('vocab/batches/LIFE-03.json')
);
const db=new pg.Client({connectionString:target.connectionString,ssl:false});
await db.connect();
try{
 const before=await db.query('SELECT id FROM ws_topics WHERE lower(btrim(title))=lower(btrim($1))',
  [LIFE03_TOPIC_NAME]);
 assert.equal(before.rowCount,0,
  'Topic already present in isolated DB fixture; cannot test rollback');
 await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 try{
  await db.query("SET LOCAL lock_timeout='3s'");
  const first=await registerInactiveLife03Topic(db,plan,target);
  assert.equal(first.action,'created_disabled');
  assert.equal(first.enabled,false);
  const second=await registerInactiveLife03Topic(db,plan,target);
  assert.equal(second.action,'already_disabled');
  assert.equal(second.topic_id,first.topic_id);
  const found=await db.query(
   'SELECT t.title,t.enabled,(SELECT count(*)::int FROM ws_words WHERE topic_id=t.id) AS n FROM ws_topics t WHERE t.id=$1',
   [first.topic_id]
  );
  assert.equal(found.rowCount,1);
  assert.equal(found.rows[0].enabled,false);
  assert.equal(found.rows[0].n,0);
  const publicList=await db.query('SELECT count(*)::int AS n FROM ws_topics WHERE enabled=true AND id=$1',[first.topic_id]);
  assert.equal(publicList.rows[0].n,0);
 }finally{
  await db.query('ROLLBACK');
 }
 const after=await db.query('SELECT id FROM ws_topics WHERE lower(btrim(title))=lower(btrim($1))',
  [LIFE03_TOPIC_NAME]);
 assert.equal(after.rowCount,0,'Local QA transaction leaked a disabled topic');
 console.log('PASS: LIFE-03 topic created inactive, repeated safely, excluded from enabled public list, rollback clean');
}finally{await db.end()}
