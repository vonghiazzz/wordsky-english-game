#!/usr/bin/env node
// UX-24E: Manual, Preview-ONLY one-account-at-a-time backfill.
// Run after verifying isolated Preview project and migrations.
// Does NOT support Production, and does NOT mutate anything without --apply.
import {getPool} from '../lib/db.js';
import {backfillAccountSrs} from '../lib/srs-backfill.js';

const VERIFIED_PREVIEW_REF='zbdnvvvdjxmdurucfjpe';
const args=new Set(process.argv.slice(2));
if([...args].some(arg=>!['--apply','--dry-run'].includes(arg))||
   (args.has('--apply')&&args.has('--dry-run')))
 throw Error('Usage: node scripts/preview-backfill-srs.mjs [--dry-run | --apply]');
const apply=args.has('--apply');
if(process.env.VERCEL_ENV==='production'||
   process.env.WORDSKY_PREVIEW_DB_REF!==VERIFIED_PREVIEW_REF||
   !process.env.WORDSKY_PREVIEW_DATABASE_URL||
   !process.env.SUPABASE_CA_CERT)
 throw Error('Refusing: verified isolated Supabase Preview connection is required. Never use Production.');
process.env.VERCEL_ENV='preview'; // enforce db-target.js isolation verification.
const pool=getPool();
try{
 const users=await pool.query('SELECT id FROM ws_users ORDER BY id LIMIT 10001');
 if(users.rows.length>10000)throw Error('Account count exceeds safe backfill boundary');
 const summary={mode:apply?'apply':'dry-run',accounts:users.rows.length,
  historical_words:0,existing:0,ready_to_insert:0,inserted:0,matched:0};
 for(const user of users.rows){
  const report=await backfillAccountSrs(user.id,{apply});
  for(const key of ['historical_words','existing','ready_to_insert','inserted','matched'])
   summary[key]+=report[key];
 }
 // Print aggregate counts only; never expose session secrets or word IDs.
 console.log(JSON.stringify(summary));
}finally{
 await pool.end();
}
