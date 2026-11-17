// SOCIAL-105: safe dry-run and isolated-only importer. Never connects to Production.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parseReviewCsv,planSocialBatch,SOCIAL_BATCH_IDS,norm} from '../lib/social1000-import-policy.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const argv=process.argv.slice(2),write=argv.includes('--write-local-test');
const batchArg=argv.find(a=>/^--batch=SOCIAL-(0[1-9]|10)$/.test(a));
if(argv.some(a=>a!==batchArg&&a!=='--write-local-test')||!batchArg)throw Error('Usage: node scripts/import-social1000.mjs --batch=SOCIAL-01 [--write-local-test]');
const batchId=batchArg.split('=')[1];
if(!SOCIAL_BATCH_IDS.includes(batchId))throw Error('Unknown SOCIAL batch');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const batch=read('vocab/social-life-batches/'+batchId+'.json');
const queue=parseReviewCsv(readFileSync(resolve(root,'vocab/editorial/SOCIAL-1000-review-queue.csv'),'utf8'));
const plan=planSocialBatch(batch,queue,{requireEditorial:false});
console.log(JSON.stringify({batch:batchId,total:plan.total,eligible:plan.eligible.length,pending:plan.pending.length,mode:write?'isolated-write':'offline-dry-run'},null,2));
if(!write){console.log('DRY RUN: zero DB connections; zero changes.');process.exit(0);}
if(plan.pending.length)throw Error('No write: '+plan.pending.length+' editorial items remain pending');
const target=process.env.WORDSKY_TEST_DATABASE_URL;
if(!target)throw Error('WORDSKY_TEST_DATABASE_URL required');
const url=new URL(target);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='5547'||url.pathname!=='/wordsky_v6_test'||url.username!=='wordsky_test')
 throw Error('SOCIAL isolated-only write requires wordsky_test@localhost:5547/wordsky_v6_test');
if(target===process.env.DATABASE_URL&&process.env.VERCEL_ENV==='production')throw Error('Production environment forbidden');
const pg=await import('pg');
const client=new pg.default.Client({connectionString:target,ssl:false});
await client.connect();
let started=false;
try{
 const name=await client.query('SELECT current_database() AS name');
 if(name.rows[0]?.name!=='wordsky_v6_test')throw Error('Unexpected database name');
 const col=await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ws_words' AND column_name='learning_only'");
 if(col.rows.length!==1)throw Error('learning_only migration not applied');
 await client.query('BEGIN');started=true;
 const topics=await client.query('SELECT id FROM ws_topics WHERE title=$1 AND enabled=true FOR SHARE',[plan.topic]);
 if(topics.rows.length!==1)throw Error('Existing enabled topic missing: '+plan.topic);
 const topicId=topics.rows[0].id;
 const existing=await client.query('SELECT id,english,meaning,topic_id,learning_only FROM ws_words WHERE enabled=true FOR UPDATE');
 const existingEnglish=new Map(),existingVi=new Map();
 for(const r of existing.rows){
  if(!existingEnglish.has(norm(r.english)))existingEnglish.set(norm(r.english),[]);
  existingEnglish.get(norm(r.english)).push(r);
  if(!existingVi.has(norm(r.meaning)))existingVi.set(norm(r.meaning),[]);
  existingVi.get(norm(r.meaning)).push(r);
 }
 let inserted=0,skipped=0;
 for(const r of plan.eligible){
  const match=existingEnglish.get(norm(r.english))||[];
  if(match.length){
   if(match.length===1&&match[0].topic_id===topicId&&match[0].learning_only===true&&norm(match[0].meaning)===norm(r.meaning)){
    skipped++;continue;
   }
   throw Error('Existing English collision: '+r.item_id+' / '+r.english);
  }
  if(existingVi.has(norm(r.meaning)))throw Error('Existing Vietnamese cue collision: '+r.item_id);
  const q=await client.query(
   "INSERT INTO ws_words(topic_id,english,meaning,ipa,example,translation,cefr_level,cefr_review_status,learning_only,enabled) VALUES($1,$2,$3,'',$4,$5,$6,'PROVISIONAL',true,true) RETURNING id",
   [topicId,r.english,r.meaning,r.example,r.translation,r.level]);
  existingEnglish.set(norm(r.english),[{topic_id:topicId,meaning:r.meaning,learning_only:true,id:q.rows[0].id}]);
  existingVi.set(norm(r.meaning),[{english:r.english}]);inserted++;
 }
 await client.query('COMMIT');started=false;
 console.log(JSON.stringify({batch:batchId,inserted,skipped,topic:plan.topic,isolated:true}));
}finally{
 if(started)await client.query('ROLLBACK');
 await client.end();
}
