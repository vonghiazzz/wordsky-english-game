/**
 * UX56 read-only lexical quality inventory for shared PUBLIC Production catalog.
 * No auth, cookies, secrets, user progress, POST, SQL, or mutation of any kind.
 * Flags are not semantic corrections or CEFR certifications.
 */
import assert from 'node:assert/strict';
import {auditPublicRecallCues} from '../lib/qa-s1a-recall-cue-audit.js';

const url='https://wordsky-english-game.vercel.app/api/learning/vocabulary';
const response=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{accept:'application/json'}});
assert.equal(response.status,200,'Expected HTTP 200 from public catalog');
assert.match(response.headers.get('content-type')||'',/application\/json/i);
const payload=await response.json();
assert.equal(payload.scope,'catalog');
assert.ok(Array.isArray(payload.words)&&payload.words.length>0&&payload.words.length<=5000,'Invalid catalog size');
const words=payload.words;
const cards=words.map(row=>({
  source:'shared',
  topic:row.topic,
  english:row.english,
  meaning:row.meaning
}));
const audit=auditPublicRecallCues(cards);
const englishGroups=new Map();
let missingIpa=0,missingExample=0,missingTranslation=0;
for(const row of words){
  assert.equal(typeof row.english,'string');
  assert.equal(typeof row.meaning,'string');
  assert.equal(typeof row.topic,'string');
  const key=row.english.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en');
  const group=englishGroups.get(key)||{english:key,topics:new Set(),count:0};
  group.count++;
  group.topics.add(row.topic);
  englishGroups.set(key,group);
  if(typeof row.ipa!=='string'||!row.ipa.trim())missingIpa++;
  if(typeof row.example!=='string'||!row.example.trim())missingExample++;
  if(typeof row.translation!=='string'||!row.translation.trim())missingTranslation++;
}
const duplicates=[...englishGroups.values()].filter(g=>g.count>1).map(g=>({
  english:g.english,count:g.count,topics:[...g.topics].sort()
})).sort((a,b)=>a.english.localeCompare(b.english));
const report={
 result:'PASS_READ_ONLY_PUBLIC_LEXICAL_AUDIT',
 source:'public-shared-catalog-only',
 observed_words:words.length,
 observed_topics:new Set(words.map(w=>w.topic)).size,
 missing_ipa:missingIpa,
 missing_example:missingExample,
 missing_translation:missingTranslation,
 duplicate_english_groups:duplicates,
 ambiguous_vietnamese_cues:audit.cue_collisions,
 english_exposure_candidate_count:audit.cue_contains_english_count,
 multiple_meaning_groups:audit.multiple_meaning_count,
 missing_meanings:audit.missing_meaning_count,
 notes:'Lexical candidates require human review. API does not expose editorial CEFR approval. No data written.'
};
console.log(JSON.stringify(report));
assert.equal(audit.missing_meaning_count,0,'Public catalog has blank Vietnamese meaning(s)');
