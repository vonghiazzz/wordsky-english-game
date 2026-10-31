/*
 * QA-S1A: local, read-only lexical audit of repository public SEED only.
 * This is NOT the current 365-word live Production catalog, and it never
 * connects to Vercel, Supabase or any user's personal vocabulary/history.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {auditPublicRecallCues} from '../lib/qa-s1a-recall-cue-audit.js';

if(process.argv.length!==2)throw Error('No live URL, account, export or DB arguments allowed');
const filename=new URL('../db/seed-vocabulary.json',import.meta.url);
const seed=JSON.parse(readFileSync(filename,'utf8'));
if(!seed||typeof seed!=='object'||Array.isArray(seed))throw Error('Invalid public seed');
const cards=[];
for(const [topic,rows] of Object.entries(seed)){
 if(!Array.isArray(rows))throw Error('Invalid public seed topic');
 for(const row of rows){
  if(!Array.isArray(row)||row.length<3)throw Error('Invalid public seed card');
  cards.push({source:'shared',topic,english:row[0],meaning:row[2]});
 }
}
const audit=auditPublicRecallCues(cards);
assert.equal(audit.card_count,cards.length);
console.log('QA-S1A / public seed cue audit (OFFLINE, READ ONLY)');
console.log('Cards: '+audit.card_count+'; topics: '+Object.keys(seed).length);
console.log('Duplicate cue / distinct English candidate groups: '+audit.cue_collision_count);
for(const candidate of audit.cue_collisions)
 console.log('  REVIEW cue "'+candidate.cue+'": '+candidate.english.join(' | '));
console.log('Meaning exposes an English label candidates: '+audit.cue_contains_english_count);
for(const candidate of audit.cue_contains_english_candidates)
 console.log('  REVIEW '+candidate.topic+': '+candidate.english+' — '+candidate.meaning);
console.log('English with multiple meaning candidates: '+audit.multiple_meaning_count);
console.log('Blank-meaning cards (cannot be asked as meaning -> English): '+audit.missing_meaning_count);
console.log('All lexical flags require human judgment; no auto-synonyms, scoring or SRS writes.');
if(audit.missing_meaning_count>0)process.exitCode=1;
