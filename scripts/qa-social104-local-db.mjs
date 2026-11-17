// SOCIAL-104: isolated-only, rollback-only PostgreSQL guard acceptance.
import assert from 'node:assert/strict';
import pg from 'pg';
const source=process.env.DATABASE_URL;
assert.ok(source,'DATABASE_URL must point to the isolated QA fixture');
const url=new URL(source);
assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'remote database forbidden');
assert.equal(url.port,'5547','SOCIAL-104 only accepts isolated port 5547');
assert.equal(url.pathname,'/wordsky_v6_test','SOCIAL-104 requires isolated test database');
assert.equal(url.username,'wordsky_test','SOCIAL-104 requires isolated test role');
const db=new pg.Client({connectionString:source,ssl:false});
await db.connect();
let inTx=false;
try{
 const name=await db.query('SELECT current_database() AS name');
 assert.equal(name.rows[0].name,'wordsky_v6_test');
 const column=await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ws_words' AND column_name='learning_only'");
 assert.equal(column.rows.length,1,'learning_only migration missing');
 await db.query('BEGIN'); inTx=true;
 const {rows:topics}=await db.query('SELECT id FROM ws_topics WHERE enabled=true LIMIT 1');
 assert.ok(topics.length>0,'seed must contain a real existing topic');
 const topic=topics[0].id;
 const before=await db.query("SELECT count(*)::int AS n FROM ws_words WHERE topic_id=$1 AND enabled=true AND COALESCE((to_jsonb(ws_words)->>'learning_only')::boolean,false)=false",[topic]);
 const phrase=await db.query("INSERT INTO ws_words(topic_id,english,meaning,example,translation,learning_only) VALUES($1,$2,$3,$4,$5,true) RETURNING id",[
  topic,'SOCIAL104 isolated testing phrase only','Câu thử biệt lập SOCIAL104','SOCIAL104 isolated testing phrase only.','Câu thử biệt lập SOCIAL104.'
 ]);
 const id=phrase.rows[0].id;
 const myLearning=await db.query('SELECT id,english FROM ws_words WHERE id=$1 AND enabled=true',[id]);
 assert.equal(myLearning.rows.length,1,'My Learning shared catalog must include phrase');
 const games=await db.query("SELECT id FROM ws_words w WHERE w.id=$1 AND w.enabled=true AND COALESCE((to_jsonb(w)->>'learning_only')::boolean,false)=false",[id]);
 assert.equal(games.rows.length,0,'Game vocabulary must exclude learning-only phrase');
 const after=await db.query("SELECT count(*)::int AS n FROM ws_words w WHERE w.topic_id=$1 AND w.enabled=true AND COALESCE((to_jsonb(w)->>'learning_only')::boolean,false)=false",[topic]);
 assert.equal(after.rows[0].n,before.rows[0].n,'Game-eligible capacity must remain unchanged');
 const old=await db.query("SELECT count(*)::int AS n FROM ws_words WHERE enabled=true AND learning_only=false");
 assert.ok(old.rows[0].n>0,'existing seed words must keep false default');
 await db.query('ROLLBACK');inTx=false;
 const residual=await db.query('SELECT id FROM ws_words WHERE id=$1',[id]);
 assert.equal(residual.rows.length,0,'Rollback must leave no phrase in the fixture');
 console.log('SOCIAL-104 PASS: isolated migration, existing-topic insert, learning visibility, gameplay exclusion, capacity stability, rollback');
}finally{
 if(inTx)await db.query('ROLLBACK');
 await db.end();
}
