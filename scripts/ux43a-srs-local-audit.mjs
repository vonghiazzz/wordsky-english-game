#!/usr/bin/env node
/*
 * UX43A - aggregate-only baseline audit of SRS v1 in isolated PostgreSQL17.
 * NEVER accepts Vercel/Supabase/Production connections.
 *
 * --fixture: a QA account and review history exist ONLY inside a transaction
 *            that ALWAYS rolls back (including on failure).
 * --local-db: repeatable-read, READ ONLY snapshot of existing isolated data.
 * No account IDs, word text, password hashes, or review rows are printed.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {evaluateSrsV1} from '../lib/srs-v1-audit.js';
import {rebuildSrsProjection} from '../lib/srs-projection.js';
import {hashPassword} from '../lib/security.js';

const mode=process.argv[2];
if(!['--fixture','--local-db'].includes(mode)||process.argv.length!==3)
 throw Error('Usage: node scripts/ux43a-srs-local-audit.mjs --fixture | --local-db');

if(process.env.VERCEL_ENV||process.env.CI==='false'&&process.env.WORDSKY_PREVIEW_DATABASE_URL)
 throw Error('Refusing Vercel/Preview execution. This audit is local-isolated only.');
const raw=process.env.DATABASE_URL;
if(typeof raw!=='string')throw Error('UX43A requires isolated local DATABASE_URL.');
const target=new URL(raw);
if(!['postgres:','postgresql:'].includes(target.protocol)||
 target.hostname!=='127.0.0.1'||target.port!=='5547'||
 target.pathname!=='/wordsky_v6_test'||target.username!=='wordsky_test'||
 target.search||target.hash||target.password==='')throw Error('Refusing non-isolated database target.');

const db=new pg.Client({connectionString:raw,ssl:false});
const SAMPLE_TIME='2026-10-31T12:00:00.000Z';
async function insertFixture(){
 const username='ux43a_qa_'+randomBytes(7).toString('hex');
 const owner=(await db.query(
  'INSERT INTO public.ws_users(username,display_name,password_hash) '+
  'VALUES($1,$2,$3) RETURNING id',
  [username,'Ephemeral UX43A QA',hashPassword('UX43A_Only_Transaction_Rollback_2026!')]
 )).rows[0].id;
 const stock=await db.query(
  'SELECT w.id FROM public.ws_words w JOIN public.ws_topics t ON t.id=w.topic_id '+
  'WHERE w.enabled=true AND t.enabled=true ORDER BY w.id LIMIT 2'
 );
 assert.equal(stock.rows.length,2,'UX43A requires at least two seeded enabled words');
 const personal=(await db.query(
  'INSERT INTO public.ws_personal_cards(user_id,topic,english,meaning) '+
  'VALUES($1,$2,$3,$4) RETURNING id',
  [owner,'Ephemeral QA','audit-example','Fixture only']
 )).rows[0].id;
 const cases=[
  {source:'shared',word_id:stock.rows[0].id,values:[
   ['2026-10-01T00:00:00Z',true],
   ['2026-10-01T00:10:00Z',true],
   ['2026-10-02T00:00:00Z',true],
   ['2026-10-06T00:00:00Z',false],
   ['2026-10-06T00:01:00Z',true]
  ]},
  {source:'shared',word_id:stock.rows[1].id,values:[
   ['2026-10-03T00:00:00Z',true],
   ['2026-10-04T00:00:00Z',true],
   ['2026-10-12T00:00:00Z',false]
  ]},
  {source:'personal',word_id:personal,values:[
   ['2026-10-01T00:00:00Z',false],
   ['2026-10-01T01:00:00Z',true],
   ['2026-10-01T02:00:00Z',true]
  ]}
 ];
 for(const [index,card] of cases.entries()){
  const historyTable=card.source==='shared'?
   'public.ws_learning_flashcard_reviews':'public.ws_personal_card_reviews';
  const progressTable=card.source==='shared'?
   'public.ws_learning_word_progress':'public.ws_personal_card_progress';
  const fk=card.source==='shared'?'word_id':'personal_word_id';
  const observed=[];
  for(const [at,remembered] of card.values){
   const q=await db.query(
    'INSERT INTO '+historyTable+' (user_id,'+fk+',remembered,reviewed_at) '+
    'VALUES ($1,$2,$3,$4::timestamptz) RETURNING id::text,remembered,reviewed_at',
    [owner,card.word_id,remembered,at]
   );
   observed.push(q.rows[0]);
  }
  const last=observed.at(-1);
  await db.query(
   'INSERT INTO '+progressTable+'(user_id,'+fk+',remembered,review_count,last_reviewed_at) '+
   'VALUES($1,$2,$3,$4,$5)',
   [owner,card.word_id,last.remembered,observed.length,last.reviewed_at]
  );
  if(index===0){
   // One complete shadow row, two intentionally missing rows; not mismatches.
   const p=rebuildSrsProjection(observed);
   await db.query(
    'INSERT INTO public.ws_user_srs_schedules '+
    '(user_id,source,word_id,policy_version,last_event_id,last_reviewed_at,'+
    'remembered,review_count,consecutive_remembered,interval_days,due_at) '+
    'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [owner,card.source,card.word_id,p.policy_version,p.last_event_id,
     p.last_reviewed_at,p.remembered,p.review_count,
     p.consecutive_remembered,p.interval_days,p.due_at]
   );
  }
 }
 return owner;
}
async function rows(table,source,kind,filterUser){
 const field=source==='shared'?'word_id':'personal_word_id';
 const parts=kind==='history'?
  ['id::text AS id','user_id::text AS user_id',field+'::text AS word_id',
   'remembered','reviewed_at']:
  ['user_id::text AS user_id',field+'::text AS word_id','remembered',
   'review_count','last_reviewed_at'];
 const order=kind==='history'?'user_id,'+field+',reviewed_at,id':'user_id,'+field;
 const query='SELECT '+parts.join(',')+' FROM '+table+
  ' WHERE ($1::uuid IS NULL OR user_id=$1::uuid) ORDER BY '+order+
  ' LIMIT 50001';
 const result=await db.query(query,[filterUser||null]);
 if(result.rows.length>50000)throw Error('UX43A data limit exceeded; never silently truncate.');
 return result.rows.map(row=>({source,...row}));
}
async function shadowRows(filterUser){
 const result=await db.query(
  'SELECT user_id::text,source,word_id::text,policy_version,'+
  'last_event_id::text,remembered,review_count,consecutive_remembered,'+
  'interval_days,last_reviewed_at,due_at '+
  'FROM public.ws_user_srs_schedules '+
  'WHERE ($1::uuid IS NULL OR user_id=$1::uuid) '+
  'ORDER BY user_id,source,word_id LIMIT 50001',[filterUser||null]
 );
 if(result.rows.length>50000)throw Error('UX43A shadow limit exceeded.');
 return result.rows;
}
async function collect(filterUser,asOf){
 const events=[
  ...await rows('public.ws_learning_flashcard_reviews','shared','history',filterUser),
  ...await rows('public.ws_personal_card_reviews','personal','history',filterUser)
 ];
 const progressRows=[
  ...await rows('public.ws_learning_word_progress','shared','progress',filterUser),
  ...await rows('public.ws_personal_card_progress','personal','progress',filterUser)
 ];
 const scheduleRows=await shadowRows(filterUser);
 return evaluateSrsV1({events,progressRows,scheduleRows,asOf});
}

let open=false;
try{
 await db.connect();
 const current=(await db.query('SELECT current_database() AS name')).rows[0].name;
 assert.equal(current,'wordsky_v6_test');
 if(mode==='--fixture'){
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  open=true;
  const owner=await insertFixture();
  const audit=await collect(owner,SAMPLE_TIME);
  assert.equal(audit.population.accounts_with_history,1);
  assert.equal(audit.population.reviewed_cards,3);
  assert.equal(audit.population.total_review_events,11);
  assert.equal(audit.parity.mismatched,0);
  assert.deepEqual(audit.progress,{matched:3,mismatched:0,missing:0,orphaned:0});
  assert.deepEqual(audit.shadow,{matched:1,mismatched:0,missing:2,orphaned:0});
  assert.equal(audit.timing.repeat_review_events,8);
  console.log(JSON.stringify({dataset:'synthetic-qa-transaction-rollback',...audit}));
 }else{
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  open=true;
  const asOf=(await db.query('SELECT transaction_timestamp() AS as_of')).rows[0].as_of;
  const audit=await collect(null,asOf);
  console.log(JSON.stringify({dataset:'isolated-read-only',...audit}));
 }
}finally{
 // Even a successful fixture run NEVER persists data.
 if(open)await db.query('ROLLBACK').catch(()=>{});
 await db.end();
}
