import test from 'node:test';
import assert from 'node:assert/strict';
import {getVerbCefrEvidence,listVerbCefrMatches} from '../public/verb-cefr-evidence.js';
import {listVerbEntries} from '../public/verb-dictionary.js';
// Oxford 3000, PDF printed pages 2–3/11, verb POS labels only.
// https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
const batch=`carry A1
catch A2
celebrate A2
change A1
charge B1
check A1
choose A1
clean A1
close A1
collect A2
come A1
communicate A2
compare A1
complain A2
complete A1
concentrate B1
confirm B1
connect A2
consider A2
contact B1
continue A2
cook A1
copy A2
cost A1
count A2
cover A2
create A1
cut A1
damage B1
dance A1
deal A2
decide A1
decorate B1
decrease B2
deliver B1
demand B2
depend A2
describe A1
design A1
destroy A2
develop A2
dig B2
discover A2
discuss A1
divide B1
do A1
draw A1
dream A2
drink A1
drive A1`.trim().split('\n').map(line=>line.split(' '));
test('UX53A batch02 has 50 new non-duplicate Oxford verb/POS labels',()=>{
 assert.equal(batch.length,50);
 assert.equal(new Set(batch.map(([v1])=>v1)).size,50);
 const catalog=listVerbEntries();
 assert.equal(catalog.length,300);
 const sourced=listVerbCefrMatches();
 assert.equal(sourced.length,97);
 assert.equal(catalog.filter(v=>v.cefr.status==='source_matched').length,97);
 assert.equal(catalog.filter(v=>v.cefr.level===null).length,203);
 for(const [v1,level] of batch){
  assert.ok(catalog.some(v=>v.v1===v1),'missing V1 '+v1);
  const found=getVerbCefrEvidence(v1);
  assert.equal(found.level,level,v1);
  assert.equal(found.status,'source_matched');
  assert.equal(found.scope,'headword-pos');
  assert.match(found.source_url,/oxfordlearnersdictionaries/);
 }
});
test('UX53A evidence remains non-approved and never predicts CEFR for other words',()=>{
 assert.equal(getVerbCefrEvidence('forgive').level,null);
 assert.equal(getVerbCefrEvidence('unknown').status,'unreviewed');
 const all=listVerbEntries();
 assert.equal(all.filter(v=>v.cefr.status==='approved').length,0);
});
