import test from 'node:test';
import assert from 'node:assert/strict';
import {getVerbCefrEvidence,listVerbCefrMatches} from '../public/verb-cefr-evidence.js';
import {listVerbEntries} from '../public/verb-dictionary.js';
// Source: Oxford 3000 English, PDF pages 4–6 (zero-index P3–P5), verb POS labels.
// https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
const rows=`earn A2
eat A1
educate B1
encourage B1
enter A2
enjoy A1
exchange B1
exist A2
expect A2
explain A1
express A2
fail A2
fall A1
feed A2
feel A1
fight A2
fill A1
find A1
finish A1
fix A2
fly A1
follow A1
forget A1
forgive B2
form A1
freeze B1
gather B1
get A1
give A1
go A1
greet A2
grow A1
guess A1
handle B2
hang B1
happen A1
have A1
hear A1
hide A2
hit A2
hold A2
hope A1
join A1
jump A2
keep A1
know A1
lay B1
lead A2
lean B2
learn A1`.trim().split('\n').map(line=>line.split(' '));
test('UX53A batch03 matches 50 distinct verb headwords and exact Oxford POS levels',()=>{
 assert.equal(rows.length,50);
 assert.equal(new Set(rows.map(row=>row[0])).size,50);
 assert.equal(listVerbCefrMatches().length,147);
 const catalog=listVerbEntries();
 assert.equal(catalog.length,300);
 assert.equal(catalog.filter(row=>row.cefr.status==='source_matched').length,147);
 assert.equal(catalog.filter(row=>row.cefr.status==='unreviewed').length,153);
 for(const [word,expected] of rows){
  assert.ok(catalog.some(row=>row.v1===word),word);
  const match=getVerbCefrEvidence(word);
  assert.equal(match.level,expected,word);
  assert.equal(match.status,'source_matched',word);
  assert.equal(match.scope,'headword-pos',word);
  assert.match(match.source_url,/The_Oxford_3000.pdf/);
 }
});
test('UX53A evidence does not become learning approval or modify the SRS',()=>{
 assert.equal(listVerbEntries().filter(row=>row.cefr.status==='approved').length,0);
 assert.equal(getVerbCefrEvidence('unknown').level,null);
});
