// SOCIAL-105: safe dry-run and isolated-only importer. Never connects to Production.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parseReviewCsv,planSocialBatch,SOCIAL_BATCH_IDS} from '../lib/social1000-import-policy.js';
import {insertReviewedSocialBatch} from '../lib/social1000-import-db.js';
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
 const result=await insertReviewedSocialBatch(client,plan);
 await client.query('COMMIT');started=false;
 console.log(JSON.stringify({...result,isolated:true}));
}finally{
 if(started)await client.query('ROLLBACK');
 await client.end();
}
