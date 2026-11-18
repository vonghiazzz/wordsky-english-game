import test from 'node:test';
import assert from 'node:assert/strict';
import {listVerbEntries,findVerbEntries} from '../public/verb-dictionary.js';
import {listVerbCefrMatches,getVerbCefrEvidence,VERB_CEFR_SOURCE} from '../public/verb-cefr-evidence.js';
import {createVerbQuiz} from '../public/verb-practice-core.js';

test('UX53A batch01: at least 47 Oxford headword-POS matches, with no invented CEFR',()=>{
 const all=listVerbEntries(),matched=listVerbCefrMatches();
 assert.equal(all.length,300);
 assert.ok(matched.length>=47);
 assert.equal(new Set(matched.map(e=>e.v1)).size,matched.length);
 assert.equal(all.filter(v=>v.cefr.status==='source_matched').length,matched.length);
 assert.equal(all.filter(v=>v.cefr.status==='unreviewed').length,300-matched.length);
 assert.equal(all.filter(v=>v.cefr.level===null).length,300-matched.length);
 assert.deepEqual(new Set(matched.map(v=>v.level)).size,4);
 assert.match(VERB_CEFR_SOURCE.url,/oxfordlearnersdictionaries\.com/);
 assert.equal(VERB_CEFR_SOURCE.scope,'headword-pos');
 for(const v of all){
  assert.deepEqual(v.cefr,getVerbCefrEvidence(v.v1));
  if(v.cefr.status==='source_matched'){
   assert.ok(['A1','A2','B1','B2'].includes(v.cefr.level));
   assert.equal(v.cefr.scope,'headword-pos');
   assert.equal(v.cefr.source_url,VERB_CEFR_SOURCE.url);
  }else{
   assert.equal(v.cefr.level,null);
   assert.equal(v.cefr.source_id,null);
  }
 }
});
test('UX53A selected Oxford verb/POS anchors match specific grade; sense is NOT approved',()=>{
 const checks={be:'A1',go:null,buy:'A1',begin:'A1',accept:'A2',achieve:'A2',
  adapt:'B2',admire:'B1',advise:'B1',approve:'B2',broadcast:'B2',call:'A1',
  borrow:'A2',beat:'A2',book:'A2',arise:'B2',belong:'A2'};
 for(const [v1,level] of Object.entries(checks))assert.equal(getVerbCefrEvidence(v1).level,level,v1);
 assert.ok(!Object.values(getVerbCefrEvidence('be')).includes('approved'));
 assert.equal(findVerbEntries('went')[0].v1,'go');
 assert.equal(findVerbEntries('went')[0].cefr.level,null,'unreviewed words stay unreviewed');
});
test('UX53A preserves 10-question V1/V2/V3 quiz sampling and does not mutate SRS',()=>{
 const q=createVerbQuiz({random:()=>0.5});
 assert.equal(q.length,10);
 assert.equal(new Set(q.map(v=>v.v1)).size,10);
 assert.ok(q.every(v=>v.v1&&v.v2&&v.v3&&v.target));
});
