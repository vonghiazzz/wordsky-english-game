import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

// This test refuses all remote databases, including Supabase Preview.
// It runs only against the ephemeral PostgreSQL service in GitHub Actions.
test('UX23C real PostgreSQL serializes conflicting cross-device reviews and retries', {
 skip:!process.env.UX23C_TEST_DATABASE_URL
}, async()=>{
 const databaseUrl=new URL(process.env.UX23C_TEST_DATABASE_URL);
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(databaseUrl.hostname),
   'never connect a UX23C concurrency test to remote databases');
 assert.equal(databaseUrl.pathname,'/wordsky_test');
 assert.equal(process.env.VERCEL_ENV,undefined);
 process.env.DATABASE_URL=databaseUrl.toString();
 const {sql,getPool}=await import('../lib/db.js');
 const {recordUnifiedReview}=await import('../lib/unified-review.js');
 try{
  // Minimal FK-compatible fixture: the production migration itself supplies
  // the review ledger, including its RLS/GRANT restrictions.
  await sql(`
   CREATE TABLE ws_users(id uuid PRIMARY KEY);
   CREATE TABLE ws_topics(id uuid PRIMARY KEY, title text NOT NULL, enabled boolean NOT NULL DEFAULT true);
   CREATE TABLE ws_words(id uuid PRIMARY KEY, topic_id uuid NOT NULL REFERENCES ws_topics(id),
     enabled boolean NOT NULL DEFAULT true);
   CREATE TABLE ws_personal_cards(id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES ws_users(id),
     deleted_at timestamptz);
   CREATE TABLE ws_learning_word_progress(user_id uuid NOT NULL REFERENCES ws_users(id),
     word_id uuid NOT NULL REFERENCES ws_words(id), remembered boolean NOT NULL,
     review_count integer NOT NULL DEFAULT 1, last_reviewed_at timestamptz NOT NULL,
     PRIMARY KEY(user_id,word_id));
   CREATE TABLE ws_personal_card_progress(user_id uuid NOT NULL REFERENCES ws_users(id),
     personal_word_id uuid NOT NULL REFERENCES ws_personal_cards(id), remembered boolean NOT NULL,
     review_count integer NOT NULL DEFAULT 1, last_reviewed_at timestamptz NOT NULL,
     PRIMARY KEY(user_id,personal_word_id));
   CREATE TABLE ws_learning_flashcard_reviews(user_id uuid NOT NULL REFERENCES ws_users(id),
     word_id uuid NOT NULL REFERENCES ws_words(id), remembered boolean NOT NULL,
     reviewed_at timestamptz NOT NULL);
   CREATE TABLE ws_personal_card_reviews(user_id uuid NOT NULL REFERENCES ws_users(id),
     personal_word_id uuid NOT NULL REFERENCES ws_personal_cards(id),
     remembered boolean NOT NULL, reviewed_at timestamptz NOT NULL);
  `);
  const migration=readFileSync(new URL('../db/migrations/20261027_ux23_idempotent_review_requests.sql',import.meta.url),'utf8');
  await sql(migration);

  const userA=randomUUID(),userB=randomUUID(),topic=randomUUID();
  const shared=randomUUID(),personal=randomUUID();
  await sql('INSERT INTO ws_users(id) VALUES ($1),($2)',[userA,userB]);
  await sql('INSERT INTO ws_topics(id,title) VALUES ($1,$2)',[topic,'Test only']);
  await sql('INSERT INTO ws_words(id,topic_id) VALUES ($1,$2)',[shared,topic]);
  await sql('INSERT INTO ws_personal_cards(id,user_id) VALUES ($1,$2)',[personal,userA]);
  const command=(source,word_id,remembered,version=0,request_id=randomUUID())=>({
   source,word_id,remembered,expected_review_count:version,request_id
  });

  // Two *different* device commands both observed the same empty word.
  const left=command('shared',shared,true),right=command('shared',shared,false);
  const outcomes=await Promise.allSettled([
   recordUnifiedReview(userA,left),recordUnifiedReview(userA,right)
  ]);
  const accepted=outcomes.filter(r=>r.status==='fulfilled');
  const rejected=outcomes.filter(r=>r.status==='rejected');
  assert.equal(accepted.length,1);
  assert.equal(rejected.length,1);
  assert.equal(rejected[0].reason.status,409);
  const winner=outcomes[0].status==='fulfilled'?left:right;
  let current=await sql('SELECT remembered,review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',[userA,shared]);
  assert.equal(current.rows.length,1);
  assert.equal(current.rows[0].remembered,winner.remembered);
  assert.equal(current.rows[0].review_count,1);
  let rows=await sql('SELECT count(*)::int AS n FROM ws_learning_flashcard_reviews WHERE user_id=$1',[userA]);
  assert.equal(rows.rows[0].n,1,'a rejected stale command must not append history');
  rows=await sql('SELECT count(*)::int AS n FROM ws_learning_review_requests WHERE user_id=$1',[userA]);
  assert.equal(rows.rows[0].n,1,'the stale idempotency claim rolls back too');

  // Retrying a committed request returns its original confirmation even
  // after another action changes the word.
  const replay=await recordUnifiedReview(userA,winner);
  assert.equal(replay.replayed,true);
  assert.equal(replay.request_id,winner.request_id);
  assert.equal(String(replay.reviewed_at),String(accepted[0].value.reviewed_at));
  await assert.rejects(
   recordUnifiedReview(userA,{...winner,remembered:!winner.remembered}),
   error=>error.status===409
  );
  const deliberate=command('shared',shared,!winner.remembered,1);
  const next=await recordUnifiedReview(userA,deliberate);
  assert.equal(next.replayed,false);
  current=await sql('SELECT remembered,review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',[userA,shared]);
  assert.equal(current.rows[0].review_count,2);
  assert.equal(current.rows[0].remembered,!winner.remembered);
  const replayAgain=await recordUnifiedReview(userA,winner);
  assert.equal(replayAgain.replayed,true);
  rows=await sql('SELECT count(*)::int AS n FROM ws_learning_flashcard_reviews WHERE user_id=$1',[userA]);
  assert.equal(rows.rows[0].n,2);

  // The same request UUID is scoped per account, while personal cards
  // cannot be written by another account.
  const personalReview=command('personal',personal,true);
  await recordUnifiedReview(userA,personalReview);
  await assert.rejects(recordUnifiedReview(userB,command('personal',personal,true)),
    error=>error.status===404);
  const anotherAccount=await recordUnifiedReview(userB,command('shared',shared,true,0,winner.request_id));
  assert.equal(anotherAccount.replayed,false);
  rows=await sql('SELECT count(*)::int AS n FROM ws_personal_card_reviews WHERE user_id=$1',[userA]);
  assert.equal(rows.rows[0].n,1);
  rows=await sql('SELECT count(*)::int AS n FROM ws_learning_review_requests WHERE user_id=$1',[userB]);
  assert.equal(rows.rows[0].n,1,'rejected cross-owner request leaves no ledger entry');
 }finally{
  await getPool().end();
 }
});
