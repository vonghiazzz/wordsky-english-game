import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema=fs.readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../db/migrations/20261023_220000_match_solo.sql',import.meta.url),'utf8');
const bombMigration=fs.readFileSync(new URL('../db/migrations/20261024_100000_bomb_solo.sql',import.meta.url),'utf8');
const localDb=fs.readFileSync(new URL('../dev/wordsky-v6-test/local-db.sh',import.meta.url),'utf8');

test('base schema and original additive migration define constrained Solo runs',()=>{
 for(const source of [schema,migration]){
  assert.match(source,/CREATE TABLE IF NOT EXISTS (?:public\.)?ws_solo_runs/);
  assert.match(source,/access_token_hash text NOT NULL/);
  assert.match(source,/client_fingerprint_hash text NOT NULL/);
  assert.match(source,/state jsonb NOT NULL/);
  assert.match(source,/ws_solo_runs_user_started/);
  assert.match(source,/ws_solo_runs_fingerprint_started/);
  assert.match(source,/ALTER TABLE (?:public\.)?ws_solo_runs ENABLE ROW LEVEL SECURITY/);
 }
 assert.match(migration,/CHECK\(mode='MATCH'\)/);
 assert.match(migration,/question_count BETWEEN 3 AND 20/);
 assert.match(schema,/CHECK\(mode IN \('MATCH','BOMB','CAR'\)\)/);
 assert.match(schema,/question_count BETWEEN 3 AND 30/);
 assert.doesNotMatch(migration,/^\s*(?:DROP|TRUNCATE|DELETE)\b/im);
});

test('Phase 2.2 migration expands constraints without replacing the table or deleting MATCH rows',()=>{
 assert.match(bombMigration,/CHECK \(mode IN \('MATCH','BOMB'\)\) NOT VALID/);
 assert.match(bombMigration,/CHECK \(question_count BETWEEN 3 AND 30\) NOT VALID/);
 assert.match(bombMigration,/VALIDATE CONSTRAINT ws_solo_runs_mode_check/);
 assert.match(bombMigration,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(bombMigration,/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE public\.ws_solo_runs/i);
});

test('local database setup applies both idempotent Solo migrations',()=>{
 assert.match(localDb,/db\/migrations\/20261022_gameplay_round_settings\.sql/);
 assert.match(localDb,/db\/migrations\/20261023_220000_match_solo\.sql/);
 assert.match(localDb,/db\/migrations\/20261024_100000_bomb_solo\.sql/);
 assert.match(localDb,/ON_ERROR_STOP=1/);
});

const carMigration=fs.readFileSync(new URL('../db/migrations/20261024_110000_car_solo.sql',import.meta.url),'utf8');
test('CAR Solo migration preserves MATCH/BOMB data and validates new constraint',()=>{
 assert.match(schema,/CHECK\(mode IN \('MATCH','BOMB','CAR'\)\)/);
 assert.match(carMigration,/CHECK \(mode IN \('MATCH','BOMB','CAR'\)\) NOT VALID/);
 assert.match(carMigration,/VALIDATE CONSTRAINT ws_solo_runs_mode_check/);
 assert.match(carMigration,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(carMigration,/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE public\.ws_solo_runs/i);
 assert.match(localDb,/db\/migrations\/20261024_110000_car_solo\.sql/);
});
