import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
 LIFE02_TOPIC_NAME,validateLife02TopicProposal,
 resolveLife02RegistrationTarget,registerInactiveLife02Topic
} from '../lib/vocab-topic-preview-policy.js';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const roadmap=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const batch=read('vocab/batches/LIFE-02.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const localUrl='postgresql://wordsky_test:pass@127.0.0.1:5547/wordsky_v6_test';
const previewUrl='postgresql://preview_editor:pass@sandbox-isolated.preview-example.net:5432/wordsky_preview_test';

test('LIFE-02 proposal is registered ONLY as a disabled, empty topic',()=>{
 const p=validateLife02TopicProposal(roadmap,seed,batch);
 assert.equal(p.topic_title,LIFE02_TOPIC_NAME);
 assert.equal(p.proposed_words,100);
 assert.equal(p.activation,'INACTIVE_ONLY');
 assert.equal(p.approved_words,0);
 for(const key of ['reviewer_approved','import_authorized','publish_authorized','production_authorized'])
  assert.equal(p[key],false,key);
 assert.equal(Object.hasOwn(seed,LIFE02_TOPIC_NAME),false);
});

test('LIFE-02 refuses forged topic approval or candidate status injection',()=>{
 const approved=copy(roadmap);
 approved.proposed_topics[0].activation='ACTIVE';
 assert.throws(()=>validateLife02TopicProposal(approved,seed,batch),/proposed, not a seeded/);
 const enabled=copy(batch);enabled.records[0].review_status='APPROVED';
 assert.throws(()=>validateLife02TopicProposal(roadmap,seed,enabled),/must not be approved/);
 const reviewer=copy(batch);reviewer.records[0].reviewed_by='fake_admin';
 assert.throws(()=>validateLife02TopicProposal(roadmap,seed,reviewer),/must not be approved/);
 const under=copy(batch);under.records.pop();
 assert.throws(()=>validateLife02TopicProposal(roadmap,seed,under),/unpublished LIFE-02 batch/);
 const intruder=copy(seed);intruder[LIFE02_TOPIC_NAME]=[];
 assert.throws(()=>validateLife02TopicProposal(roadmap,intruder,batch),/proposed, not a seeded/);
 const changed=copy(batch);changed.records[0].topic='Daily Life';
 assert.throws(()=>validateLife02TopicProposal(roadmap,seed,changed),/must not be approved/);
});

test('LIFE-02 dry-run has no DB target and rejects arbitrary modes',()=>{
 assert.deepEqual(resolveLife02RegistrationTarget(),{mode:'dry-run',mayWrite:false});
 assert.deepEqual(resolveLife02RegistrationTarget(['--dry-run'],{
  DATABASE_URL:'postgresql://production:secret@production.invalid/db'
 }),{mode:'dry-run',mayWrite:false});
 for(const args of [['--write'],['--topic=anything'],['--dry-run','--write-preview']])
  assert.throws(()=>resolveLife02RegistrationTarget(args),/choose only one mode|unsupported mode/);
});

test('LIFE-02 permits local writes only on the pinned isolated Postgres test identity',()=>{
 const env={WORDSKY_TEST_DATABASE_URL:localUrl};
 const p=resolveLife02RegistrationTarget(['--write-local-test'],env);
 assert.equal(p.mode,'local-test');
 assert.equal(p.expectedDatabase,'wordsky_v6_test');
 assert.equal(p.expectedRole,'wordsky_test');
 assert.equal(p.mayWrite,true);
 for(const url of [
  'postgresql://wordsky_test:pass@127.0.0.1:5432/wordsky_v6_test',
  'postgresql://admin:pass@127.0.0.1:5547/wordsky_v6_test',
  'postgresql://wordsky_test:pass@db.example.net:5547/wordsky_v6_test',
  'postgresql://wordsky_test:pass@127.0.0.1:5547/wordsky_production'
 ]){
  assert.throws(()=>resolveLife02RegistrationTarget(['--write-local-test'],{
   WORDSKY_TEST_DATABASE_URL:url
  }),/local test may write only/);
 }
 assert.throws(()=>resolveLife02RegistrationTarget(['--write-local-test'],{
  ...env,VERCEL_ENV:'production'
 }),/Production environment is forbidden/);
});

test('LIFE-02 remote Preview write requires explicit isolated host, database, role, and manual approval',()=>{
 const env={
  WORDSKY_TARGET_ENV:'preview',WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED:'true',
  WORDSKY_PREVIEW_DATABASE_URL:previewUrl,
  WORDSKY_PREVIEW_EXPECTED_HOST:'sandbox-isolated.preview-example.net',
  WORDSKY_PREVIEW_EXPECTED_DB:'wordsky_preview_test',
  WORDSKY_PREVIEW_EXPECTED_ROLE:'preview_editor'
 };
 const r=resolveLife02RegistrationTarget(['--write-preview'],env);
 assert.equal(r.mode,'preview');
 assert.equal(r.expectedDatabase,'wordsky_preview_test');
 assert.equal(r.expectedRole,'preview_editor');
 for(const override of [
  {WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED:'false'},
  {WORDSKY_TARGET_ENV:'production'},
  {VERCEL_ENV:'production'},
  {CI:'true'},
  {WORDSKY_PREVIEW_EXPECTED_HOST:'different.preview-example.net'},
  {WORDSKY_PREVIEW_EXPECTED_DB:'production'},
  {WORDSKY_PREVIEW_EXPECTED_ROLE:'wrong_role'},
  {DATABASE_URL:previewUrl},
  {WORDSKY_PRODUCTION_DATABASE_URL:previewUrl},
  {WORDSKY_PREVIEW_DATABASE_URL:'postgresql://preview_editor:pass@127.0.0.1:5432/wordsky_preview_test'}
 ]){
  assert.throws(()=>resolveLife02RegistrationTarget(['--write-preview'],{...env,...override}),
   /LIFE-02 topic preview:/);
 }
 assert.throws(()=>resolveLife02RegistrationTarget(['--write-preview'],{}),
  /explicit Preview target/);
});

const target=resolveLife02RegistrationTarget(['--write-local-test'],{
 WORDSKY_TEST_DATABASE_URL:localUrl
});
const plan=validateLife02TopicProposal(roadmap,seed,batch);
const fakeDb=({stored=null,wordCount=0,roundCount=0}={})=>{
 const state={stored,wordCount,roundCount,requests:[]};
 return {
  state,async query(statement,values){
   state.requests.push({statement,values});
   if(statement.startsWith('SELECT current_database()'))
    return {rows:[{db_name:'wordsky_v6_test',db_role:'wordsky_test'}]};
   if(statement.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[{}]};
   if(statement.startsWith('SELECT id,title,enabled FROM ws_topics'))
    return {rows:state.stored?[state.stored]:[]};
   if(statement.startsWith('INSERT INTO ws_topics')){
    state.stored={id:'00000000-0000-4000-8000-000000000001',
     title:LIFE02_TOPIC_NAME,enabled:false};
    return {rows:[state.stored]};
   }
   if(statement.startsWith('SELECT (SELECT count(*)'))
    return {rows:[{words:state.wordCount,rounds:state.roundCount}]};
   throw Error('Unexpected DB operation: '+statement);
  }
 };
};

test('LIFE-02 writes only an inactive topic and is idempotent',async()=>{
 const db=fakeDb();
 const first=await registerInactiveLife02Topic(db,plan,target);
 assert.equal(first.action,'created_disabled');
 assert.equal(first.enabled,false);
 assert.equal(first.word_count,0);
 const second=await registerInactiveLife02Topic(db,plan,target);
 assert.equal(second.action,'already_disabled');
 assert.equal(first.topic_id,second.topic_id);
 assert.equal(db.state.requests.filter(x=>x.statement.startsWith('INSERT')).length,1);
 assert.ok(db.state.requests.every(x=>!/(UPDATE|DELETE)\s+ws_topics/i.test(x.statement)));
 assert.ok(db.state.requests.some(x=>x.statement.includes('pg_advisory_xact_lock')));
});

test('LIFE-02 refuses enabled topics, occupied topics, and wrong DB identity',async()=>{
 await assert.rejects(
  registerInactiveLife02Topic(fakeDb({stored:{id:'aaa',title:LIFE02_TOPIC_NAME,enabled:true}}),plan,target),
  /already enabled/);
 await assert.rejects(
  registerInactiveLife02Topic(fakeDb({stored:{id:'bbb',title:LIFE02_TOPIC_NAME,enabled:false},wordCount:1}),plan,target),
  /cannot contain words or active/);
 await assert.rejects(
  registerInactiveLife02Topic(fakeDb({stored:{id:'ccc',title:LIFE02_TOPIC_NAME,enabled:false},roundCount:1}),plan,target),
  /cannot contain words or active/);
 const db=fakeDb();
 const mismatch={...target,expectedRole:'production_admin'};
 await assert.rejects(registerInactiveLife02Topic(db,plan,mismatch),
  /do not match checked target/);
 assert.equal(db.state.requests.filter(x=>x.statement.startsWith('INSERT')).length,0);
});

test('LIFE-02 registrar default mode is an offline, credential-free dry-run',()=>{
 const r=spawnSync(process.execPath,['scripts/register-life02-topic.mjs'],{
  cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH},encoding:'utf8'
 });
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/DRY RUN: no DB connection/);
 assert.match(r.stdout,/"candidate_words": 100/);
 assert.match(r.stdout,/"new_topic_enabled": false/);
 assert.doesNotMatch(r.stdout,/postgresql:\/\//);
});
