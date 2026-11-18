import test from 'node:test';
import assert from 'node:assert/strict';
import {getVerbCefrEvidence,listVerbCefrMatches,VERB_CEFR_SOURCE,VERB_CEFR_ADVANCED_SOURCE} from '../public/verb-cefr-evidence.js';
import {listVerbEntries,findVerbEntries} from '../public/verb-dictionary.js';

// Sources:
// https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
// https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000_by_CEFR_level.pdf
// Oxford 3000 entries are English verb headword/POS matches A1-B2.
// Oxford 5000 B2/C1 entries are an additional source and MUST be identified separately.
const core=`set B1
like A1
plan A1
rain A1
smile A2
hurt A2
lend A2
light A2
ring A2
rise A2
shake A2
shoot B1
sing A1
shine B1
throw A2
tear B2
realize A2
recognize A2
recommend A2
reduce A2
refuse A2
quit B1
spread B1
spring B1
sink B1
slide B2
shut A2
speed B2
stick B1
swear B2
strike B2
seek B2
obtain B2
mistake B2`.trim().split('\n').map(line=>line.split(' '));
const advanced=`forbid B2
overcome B2
spill B2
bind C1
bleed C1
burst C1
cling C1
creep C1
flee C1
grind C1
shrink C1
spin C1
swing C1
breed C1`.trim().split('\n').map(line=>line.split(' '));
test('UX53A batch06 audits 34 core and 14 advanced CEFR records without duplicates',()=>{
 assert.equal(core.length,34);
 assert.equal(advanced.length,14);
 const newEntries=[...core,...advanced];
 assert.equal(new Set(newEntries.map(([v])=>v)).size,48);
 const catalog=listVerbEntries();
 assert.equal(catalog.length,300);
 assert.equal(new Set(catalog.map(row=>row.v1)).size,300);
 assert.equal(listVerbCefrMatches().length,295);
 assert.equal(catalog.filter(row=>row.cefr.status==='source_matched').length,295);
 assert.equal(catalog.filter(row=>row.cefr.status==='unreviewed').length,5);
 for(const [group,source] of [[core,VERB_CEFR_SOURCE],[advanced,VERB_CEFR_ADVANCED_SOURCE]]){
  for(const [v1,level] of group){
   const row=catalog.find(row=>row.v1===v1);
   assert.ok(row,'missing '+v1);
   assert.equal(row.cefr.level,level,v1);
   assert.equal(row.cefr.status,'source_matched',v1);
   assert.equal(row.cefr.source_id,source.id,v1);
   assert.equal(row.cefr.source_url,source.url,v1);
   assert.equal(row.cefr.scope,'headword-pos',v1);
   assert.deepEqual(row.cefr,getVerbCefrEvidence(v1));
  }
 }
});
test('UX53A batch06 leaves five unsupported records null and never auto-approves',()=>{
 const unmatched=['practice','kneel','sting','stink','undo'];
 const catalog=listVerbEntries();
 assert.deepEqual(catalog.filter(row=>row.cefr.status==='unreviewed').map(row=>row.v1).sort(),unmatched.sort());
 for(const v1 of unmatched){
  const meta=getVerbCefrEvidence(v1);
  assert.equal(meta.level,null);
  assert.equal(meta.status,'unreviewed');
  assert.equal(meta.source_url,null);
 }
 assert.equal(catalog.filter(row=>row.cefr.status==='approved').length,0);
 assert.equal(findVerbEntries('practice')[0].v1,'practice');
 assert.equal(findVerbEntries('forbidden')[0].cefr.level,'B2');
});
