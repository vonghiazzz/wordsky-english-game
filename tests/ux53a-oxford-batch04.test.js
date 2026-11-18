import test from 'node:test';
import assert from 'node:assert/strict';
import {getVerbCefrEvidence,listVerbCefrMatches} from '../public/verb-cefr-evidence.js';
import {listVerbEntries} from '../public/verb-dictionary.js';

// Oxford 3000 English PDF, printed pages 6–11; verified verb POS, not Vietnamese senses.
// https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
const batch=`leave A1
listen A1
live A1
locate B1
look A1
lose A1
love A1
maintain B2
make A1
manage A2
meet A1
open A1
order A1
organize A2
paint A1
participate B1
pass A2
pay A1
perform A2
prepare A1
promise A2
protect A2
provide A2
publish A2
pull A2
push A2
put A1
remember A1
remind B1
repair A2
repeat A1
reply A2
return A1
ride A1
save A2
say A1
see A1
stay A1
steal A2
stop A1
study A1
support A2
sweep B2
swim A1
take A1
talk A1
understand A1
upset B1
use A1
visit A1`.trim().split('\n').map(line=>line.split(' '));
test('UX53A batch04 adds 50 distinct Oxford verb headword/POS CEFR labels',()=>{
 assert.equal(batch.length,50);
 assert.equal(new Set(batch.map(([v1])=>v1)).size,50);
 const all=listVerbEntries(),evidence=listVerbCefrMatches();
 assert.equal(all.length,300);
 assert.equal(evidence.length,197);
 assert.equal(all.filter(v=>v.cefr.status==='source_matched').length,197);
 assert.equal(all.filter(v=>v.cefr.status==='unreviewed').length,103);
 assert.equal(new Set(all.map(v=>v.v1)).size,300);
 for(const [v1,level] of batch){
  const word=all.find(v=>v.v1===v1);
  assert.ok(word,'missing catalog verb '+v1);
  assert.equal(word.cefr.level,level,v1);
  assert.deepEqual(word.cefr,getVerbCefrEvidence(v1));
  assert.equal(word.cefr.scope,'headword-pos');
  assert.equal(word.cefr.status,'source_matched');
  assert.match(word.cefr.source_url,/The_Oxford_3000\.pdf/);
 }
});
test('UX53A batch04 never treats source match as meaning-level approval or SRS action',()=>{
 const all=listVerbEntries();
 assert.equal(all.filter(v=>v.cefr.status==='approved').length,0);
 assert.equal(getVerbCefrEvidence('unknown').status,'unreviewed');
 assert.equal(getVerbCefrEvidence('forbid').level,null);
});
