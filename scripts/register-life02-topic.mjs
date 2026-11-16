/*
 * LIFE-02 disabled-only topic registration.
 *
 * Default: node scripts/register-life02-topic.mjs
 * Local:   WORDSKY_TEST_DATABASE_URL=<isolated-local-test> node scripts/register-life02-topic.mjs --write-local-test
 * Preview: requires explicit independently verified isolated DB and manual
 *          approval gate. Does not enable the topic or import any word.
 *
 * NEVER run against Production. No secrets are printed.
 */
import {readFileSync} from 'node:fs';
import {
 validateLife02TopicProposal,resolveLife02RegistrationTarget,
 registerInactiveLife02Topic
} from '../lib/vocab-topic-preview-policy.js';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';

const read=relative=>JSON.parse(readFileSync(new URL('../'+relative,import.meta.url),'utf8'));
const seed=read('db/seed-vocabulary.json');
const roadmap=read('vocab/life-1000-roadmap.json');
const batch=read('vocab/batches/LIFE-02.json');
const prior=read('vocab/batches/LIFE-01.json');
const drafts=read('vocab/cefr-provisional.json').records;

// Run full cross-batch QA on every invocation, including dry-run.
const qa=validateLife1000Candidates({
 roadmap,seed,drafts,priorRecords:prior.records,batch
});
const proposal=validateLife02TopicProposal(roadmap,seed,batch);
const target=resolveLife02RegistrationTarget(process.argv.slice(2),process.env);
if(qa.lexical_candidates!==100||qa.candidate_import_authorized!==false||
   proposal.approved_words!==0||proposal.publish_authorized!==false)
 throw Error('Editorial approval boundary violated');

console.log(JSON.stringify({
 operation:'LIFE-02 inactive topic registration',
 mode:target.mode,topic:proposal.topic_title,
 candidate_words:qa.lexical_candidates,
 new_topic_enabled:false,approved_words:0,
 import_authorized:false,gameplay_enabled:false,
 production_deployment_authorized:false
},null,2));

if(!target.mayWrite){
 console.log('DRY RUN: no DB connection, no topic creation, no words or SRS changes.');
 process.exit(0);
}

const {default:pg}=await import('pg');
const db=new pg.Client({connectionString:target.connectionString,
 ssl:target.mode==='local-test'?false:undefined});
await db.connect();
let began=false;
try{
 await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 began=true;
 await db.query("SET LOCAL lock_timeout = '3s'");
 const result=await registerInactiveLife02Topic(db,proposal,target);
 await db.query('COMMIT');
 began=false;
 console.log(JSON.stringify({
  mode:target.mode,topic:result.topic_title,topic_id:result.topic_id,
  action:result.action,enabled:false,words:0,rounds:0,
  review_status:'NOT_APPROVED',import_authorized:false
 },null,2));
} catch(error){
 if(began)await db.query('ROLLBACK').catch(()=>{});
 throw error;
} finally{
 await db.end();
}
