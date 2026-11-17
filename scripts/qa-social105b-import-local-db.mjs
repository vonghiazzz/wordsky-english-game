// SOCIAL-105B — synthetic approved fixture, isolated PostgreSQL, rollback-only.
import assert from 'node:assert/strict';
import pg from 'pg';
import {insertReviewedSocialBatch} from '../lib/social1000-import-db.js';
const address=process.env.DATABASE_URL;
assert.ok(address,'Require isolated CI DATABASE_URL');
const u=new URL(address);
assert.ok(['127.0.0.1','localhost'].includes(u.hostname),'Remote DB forbidden');
assert.equal(u.port,'5547');assert.equal(u.pathname,'/wordsky_v6_test');assert.equal(u.username,'wordsky_test');
const db=new pg.Client({connectionString:address,ssl:false});
await db.connect();let active=false;
try{
 const database=await db.query('SELECT current_database() AS db');
 assert.equal(database.rows[0].db,'wordsky_v6_test');
 await db.query('BEGIN');active=true;
 const topic='SOCIAL-105B QA synthetic existing topic';
 // Fixture creates one isolated topic; the importer itself must never create topics.
 const result=await db.query('INSERT INTO ws_topics(title,enabled) VALUES($1,true) RETURNING id',[topic]);
 const topicId=result.rows[0].id;
 const cards=Array.from({length:100},(_,i)=>({
  item_id:'SOCIAL-01-'+String(i+1).padStart(3,'0'),
  topic,english:'SOCIAL105B synthetic utterance '+String(i+1).padStart(3,'0'),
  meaning:'Nghĩa giả lập SOCIAL105B '+String(i+1).padStart(3,'0'),
  example:'SOCIAL105B synthetic utterance '+String(i+1).padStart(3,'0')+'.',
  translation:'Nghĩa giả lập SOCIAL105B '+String(i+1).padStart(3,'0')+'.',
  level:'A2'
 }));
 const plan={batch_id:'SOCIAL-01',topic,total:100,pending:[],eligible:cards};
 const first=await insertReviewedSocialBatch(db,plan);
 assert.equal(first.inserted,100);assert.equal(first.skipped,0);
 const second=await insertReviewedSocialBatch(db,plan);
 assert.equal(second.inserted,0);assert.equal(second.skipped,100);
 const learning=await db.query('SELECT count(*)::int n FROM ws_words WHERE topic_id=$1 AND enabled=true',[topicId]);
 assert.equal(learning.rows[0].n,100);
 const games=await db.query("SELECT count(*)::int n FROM ws_words w WHERE w.topic_id=$1 AND w.enabled=true AND COALESCE((to_jsonb(w)->>'learning_only')::boolean,false)=false",[topicId]);
 assert.equal(games.rows[0].n,0);
 const flag=await db.query("SELECT count(*)::int n FROM ws_words WHERE topic_id=$1 AND learning_only=true AND cefr_review_status='PROVISIONAL'",[topicId]);
 assert.equal(flag.rows[0].n,100);
 // A drifted entry cannot be silently overwritten, and the parent transaction stays valid.
 await db.query('SAVEPOINT collision_probe');
 const edited={...plan,eligible:plan.eligible.map((r,i)=>i===0?{...r,meaning:'Different Vietnamese cue'}:r)};
 await assert.rejects(insertReviewedSocialBatch(db,edited),/collision or changed payload/);
 await db.query('ROLLBACK TO SAVEPOINT collision_probe');
 // A reused Vietnamese meaning under a different English phrase must fail as well.
 await db.query('SAVEPOINT cue_probe');
 const cueCollision={...plan,eligible:plan.eligible.map((r,i)=>i===0?{...r,english:'SOCIAL105B distinct changed English',meaning:cards[1].meaning}:r)};
 await assert.rejects(insertReviewedSocialBatch(db,cueCollision),/Vietnamese cue collision/);
 await db.query('ROLLBACK TO SAVEPOINT cue_probe');
 const badTopic={...plan,topic:'SOCIAL105B unregistered topic'};
 await assert.rejects(insertReviewedSocialBatch(db,badTopic),/Existing enabled topic missing/);
 await db.query('ROLLBACK');active=false;
 const left=await db.query("SELECT count(*)::int n FROM ws_topics WHERE title=$1",[topic]);
 assert.equal(left.rows[0].n,0,'Fixture must leave no topic or phrases');
 console.log('SOCIAL-105B PASS: 100 INSERT, 100 idempotent SKIP, game exclusion, drift/cue collisions, missing topic, full ROLLBACK');
}finally{
 if(active)await db.query('ROLLBACK');
 await db.end();
}
