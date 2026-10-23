import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema=fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../db/migrations/20261023_220000_match_solo.sql',import.meta.url),'utf8');
const localDb=fs.readFileSync(new URL('../dev/wordsky-v6-test/local-db.sh',import.meta.url),'utf8');

test('base schema and additive migration define constrained MATCH Solo runs',()=>{
 for(const source of [schema,migration]){
  assert.match(source,/CREATE TABLE IF NOT EXISTS (?:public\.)?ws_solo_runs/);
  assert.match(source,/access_token_hash text NOT NULL/);
  assert.match(source,/client_fingerprint_hash text NOT NULL/);
  assert.match(source,/CHECK\(mode='MATCH'\)/);
  assert.match(source,/question_count BETWEEN 3 AND 20/);
  assert.match(source,/state jsonb NOT NULL/);
  assert.match(source,/ws_solo_runs_user_started/);
  assert.match(source,/ws_solo_runs_fingerprint_started/);
  assert.match(source,/ALTER TABLE (?:public\.)?ws_solo_runs ENABLE ROW LEVEL SECURITY/);
 }
 assert.doesNotMatch(migration,/^\s*(?:DROP|TRUNCATE|DELETE)\b/im);
});

test('local database setup applies the idempotent MATCH Solo migration',()=>{
 assert.match(localDb,/db\/migrations\/20261022_gameplay_round_settings\.sql/);
 assert.match(localDb,/db\/migrations\/20261023_220000_match_solo\.sql/);
 assert.match(localDb,/ON_ERROR_STOP=1/);
});
