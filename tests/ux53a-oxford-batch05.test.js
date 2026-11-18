import test from 'node:test';
import assert from 'node:assert/strict';
import {getVerbCefrEvidence,listVerbCefrMatches,VERB_CEFR_SOURCE} from '../public/verb-cefr-evidence.js';
import {listVerbEntries} from '../public/verb-dictionary.js';
// UX53A batch05 manually checked Oxford 3000 v. POS and grade (PDF pages 5–11).
// https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
const verified=`read A1
run A1
sell A1
send A1
sit A1
sleep A1
speak A1
spend A1
stand A1
teach A1
tell A1
think A1
wake A1
wear A1
win A1
write A1
let A1
mean A1
show A1
help A1
improve A1
include A1
invite A2
move A1
need A1
play A1
receive A2
share A1
start A1
travel A1
try A1
turn A1
wait A1
walk A1
want A1
wash A1
watch A1
work A1
worry A2
imagine A1
introduce A1
offer A2
identify A2
inform B2
insist B2
interrupt B2
investigate B1
mention A2
notice A2
observe B2`.trim().split('\n').map(row=>row.split(' '));
test('UX53A batch05 has 50 distinct sourced CEFR verb POS matches',()=>{
 assert.equal(verified.length,50);
 assert.equal(new Set(verified.map(row=>row[0])).size,50);
 const catalog=listVerbEntries(), sourced=listVerbCefrMatches();
 assert.equal(catalog.length,300);
 assert.equal(sourced.length,247);
 assert.equal(catalog.filter(v=>v.cefr.status==='source_matched').length,247);
 assert.equal(catalog.filter(v=>v.cefr.status==='unreviewed').length,53);
 assert.equal(new Set(catalog.map(v=>v.v1)).size,300);
 for(const [v1,level] of verified){
  const word=catalog.find(v=>v.v1===v1);
  assert.ok(word,'missing '+v1);
  assert.equal(word.cefr.level,level,v1);
  assert.deepEqual(word.cefr,getVerbCefrEvidence(v1));
  assert.equal(word.cefr.status,'source_matched');
  assert.equal(word.cefr.scope,'headword-pos');
  assert.equal(word.cefr.source_url,VERB_CEFR_SOURCE.url);
 }
});
test('UX53A batch05 does not infer unverified grade or approve training',()=>{
 assert.equal(getVerbCefrEvidence('forbid').level,null);
 assert.equal(getVerbCefrEvidence('unknown').status,'unreviewed');
 assert.equal(listVerbEntries().filter(v=>v.cefr.status==='approved').length,0);
});
