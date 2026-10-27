import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import http from 'node:http';

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
     english text NOT NULL DEFAULT 'test word', ipa text NOT NULL DEFAULT '',
     meaning text NOT NULL DEFAULT '', example text NOT NULL DEFAULT '',
     translation text NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT true);
   CREATE TABLE ws_personal_cards(id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES ws_users(id),
     topic text NOT NULL DEFAULT 'Test', english text NOT NULL DEFAULT 'test word',
     ipa text NOT NULL DEFAULT '',meaning text NOT NULL DEFAULT '',
     example text NOT NULL DEFAULT '',translation text NOT NULL DEFAULT '',
     deleted_at timestamptz);
   CREATE TABLE ws_learning_word_progress(user_id uuid NOT NULL REFERENCES ws_users(id),
     word_id uuid NOT NULL REFERENCES ws_words(id), remembered boolean NOT NULL,
     review_count integer NOT NULL DEFAULT 1, last_reviewed_at timestamptz NOT NULL,
     PRIMARY KEY(user_id,word_id));
   CREATE TABLE ws_personal_card_progress(user_id uuid NOT NULL REFERENCES ws_users(id),
     personal_word_id uuid NOT NULL REFERENCES ws_personal_cards(id), remembered boolean NOT NULL,
     review_count integer NOT NULL DEFAULT 1, last_reviewed_at timestamptz NOT NULL,
     PRIMARY KEY(user_id,personal_word_id));
   CREATE TABLE ws_learning_flashcard_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES ws_users(id),
     word_id uuid NOT NULL REFERENCES ws_words(id), remembered boolean NOT NULL,
     reviewed_at timestamptz NOT NULL);
   CREATE TABLE ws_personal_card_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES ws_users(id),
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
  // Actual HTTP handler with two independent clients (same signed-in actor).
  // No remote website, credential, or production data is involved.
  const oldSecret=process.env.SESSION_SECRET;
  process.env.SESSION_SECRET='ux23c-ci-only-ephemeral-secret-not-used-in-production';
  const {issueSession}=await import('../lib/security.js');
  const {default:handler}=await import('../api/index.js');
  const server=http.createServer(async(req,res)=>{
   try{
    const buffers=[];
    for await(const piece of req)buffers.push(piece);
    const input=Buffer.concat(buffers).toString('utf8');
    req.body=input?JSON.parse(input):{};
    const parsedUrl=new URL(req.url,'http://127.0.0.1');
    req.query={...Object.fromEntries(parsedUrl.searchParams),rest:parsedUrl.pathname.slice(5)};
    await handler(req,res);
   }catch(error){
    res.statusCode=500;
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({error:'Test HTTP adapter failure'}));
   }
  });
  try{
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const base='http://127.0.0.1:'+server.address().port;
   const cookieFor=id=>'ws_auth='+issueSession({role:'player',id},process.env.SESSION_SECRET);
   const send=async(cookie,method,path,data)=>{
    const response=await fetch(base+path,{
     method,headers:{...(cookie?{cookie}:{}) ,...(data?{'content-type':'application/json'}:{})},
     body:data?JSON.stringify(data):undefined
    });
    return {status:response.status,body:await response.json()};
   };
   const newWord=randomUUID();
   await sql('INSERT INTO ws_words(id,topic_id) VALUES ($1,$2)',[newWord,topic]);
   const one=command('shared',newWord,true,0);
   const two=command('shared',newWord,false,0);
   const headersA=cookieFor(userA),headersB=cookieFor(userB);
   const [first,second]=await Promise.all([
    send(headersA,'POST','/api/learning/reviews',{...one,expected_actor_id:userA}),
    send(headersA,'POST','/api/learning/reviews',{...two,expected_actor_id:userA})
   ]);
   assert.deepEqual([first.status,second.status].sort(),[201,409]);
   const acceptedHttp=first.status===201?one:two;
   const repeated=await send(headersA,'POST','/api/learning/reviews',
    {...acceptedHttp,expected_actor_id:userA});
   assert.equal(repeated.status,200);
   assert.equal(repeated.body.replayed,true);
   const snapshot=await send(headersA,'GET','/api/learning/me/summary');
   assert.equal(snapshot.status,200);
   assert.equal(snapshot.body.scope,'unified-account');
   assert.equal(snapshot.body.actor_id,userA);
   const observed=snapshot.body.words.find(x=>x.source==='shared'&&x.id===newWord);
   assert.equal(observed.review_count,1);
   assert.equal(observed.remembered,acceptedHttp.remembered);
   const newDecision=await send(headersA,'POST','/api/learning/reviews',{
    ...command('shared',newWord,!acceptedHttp.remembered,observed.review_count),
    expected_actor_id:userA
   });
   assert.equal(newDecision.status,201);
   const changedActor=await send(headersA,'POST','/api/learning/reviews',{
    ...command('shared',newWord,true,2),expected_actor_id:userB
   });
   assert.equal(changedActor.status,409,'actor pin forbids switching account');
   const guest=await send(null,'POST','/api/learning/reviews',command('shared',newWord,true,0));
   assert.equal(guest.status,401);
   const otherAccount=await send(headersB,'GET','/api/learning/me/summary');
   assert.equal(otherAccount.status,200);
   assert.equal(otherAccount.body.actor_id,userB);
   const isolated=otherAccount.body.words.find(x=>x.source==='shared'&&x.id===newWord);
   assert.equal(isolated.review_count,0,'another actor cannot view account A progress');
   const blockedPersonal=await send(headersB,'POST','/api/learning/reviews',
    {...command('personal',personal,true),expected_actor_id:userB});
   assert.equal(blockedPersonal.status,404);
   const httpCounts=await sql(
    'SELECT count(*)::int as n FROM ws_learning_flashcard_reviews WHERE user_id=$1 AND word_id=$2',
    [userA,newWord]);
   assert.equal(httpCounts.rows[0].n,2,'only two accepted HTTP actions append history');

   // UX-24 preview-only read API: the handler must not reveal account
   // history to guests or cross-account callers, or mutate any review rows.
   const disabled=await send(headersA,'GET','/api/learning/srs/queue');
   assert.equal(disabled.status,404);
   const oldFlag=process.env.WORDSKY_SRS_PREVIEW_ENABLED;
   try{
    process.env.WORDSKY_SRS_PREVIEW_ENABLED='true';
    const unknown=await send(null,'GET','/api/learning/srs/queue');
    assert.equal(unknown.status,401);
    const dueWord=randomUUID(),untouched=randomUUID();
    await sql('INSERT INTO ws_words(id,topic_id) VALUES ($1,$3),($2,$3)',[dueWord,untouched,topic]);
    const dueAction=await send(headersA,'POST','/api/learning/reviews',{
     ...command('shared',dueWord,false,0),expected_actor_id:userA});
    assert.equal(dueAction.status,201);
    const beforeSrs=await sql('SELECT count(*)::int as n FROM ws_learning_flashcard_reviews WHERE user_id=$1',[userA]);
    const dueQueue=await send(headersA,'GET','/api/learning/srs/queue?status=due&page=0&size=100');
    assert.equal(dueQueue.status,200,JSON.stringify(dueQueue.body));
    assert.equal(dueQueue.body.actor_id,userA);
    assert.equal(dueQueue.body.scope,'account-srs');
    assert.ok(dueQueue.body.words.some(w=>w.id===dueWord&&w.status==='due'));
    const newQueue=await send(headersA,'GET','/api/learning/srs/queue?status=new&page=0&size=1');
    assert.equal(newQueue.status,200);
    assert.equal(newQueue.body.words.length,1);
    assert.ok(newQueue.body.total>=1);
    const complete=await send(headersA,'GET','/api/learning/srs/queue?status=new&page=0&size=100');
    assert.equal(complete.status,200);
    assert.ok(complete.body.words.some(w=>w.id===untouched));
    const otherSrs=await send(headersB,'GET','/api/learning/srs/queue?status=due');
    assert.equal(otherSrs.status,200);
    assert.equal(otherSrs.body.actor_id,userB);
    assert.ok(!otherSrs.body.words.some(w=>w.id===dueWord));
    const invalid=await send(headersA,'GET','/api/learning/srs/queue?size=101');
    assert.equal(invalid.status,400);
    const afterSrs=await sql('SELECT count(*)::int as n FROM ws_learning_flashcard_reviews WHERE user_id=$1',[userA]);
    assert.equal(afterSrs.rows[0].n,beforeSrs.rows[0].n,'read-only API must not append history');
    process.env.VERCEL_ENV='production';
    const prodDisabled=await send(headersA,'GET','/api/learning/srs/queue');
    assert.equal(prodDisabled.status,404,'never expose experimental SRS on Production');
    delete process.env.VERCEL_ENV;
   }finally{
    delete process.env.VERCEL_ENV;
    if(oldFlag===undefined)delete process.env.WORDSKY_SRS_PREVIEW_ENABLED;
    else process.env.WORDSKY_SRS_PREVIEW_ENABLED=oldFlag;
   }
  }finally{
   await new Promise(resolve=>server.close(resolve));
   if(oldSecret===undefined)delete process.env.SESSION_SECRET;
   else process.env.SESSION_SECRET=oldSecret;
  }

 }finally{
  await getPool().end();
 }
});
