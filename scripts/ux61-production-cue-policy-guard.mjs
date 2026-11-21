/**
 * UX61.5 release gate for publicly readable production vocabulary.
 * GET-only: no auth headers, cookies, write requests, database or user history.
 * The audit tests the PR's actual pending-recall policy against live words.
 */
import assert from 'node:assert/strict';
import {isPendingEditorialRecall} from '../public/ux61-pending-recall.js';

const ORIGIN='https://wordsky-english-game.vercel.app';
export const normalizeCue=value=>String(value??'').normalize('NFKC')
 .trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const normalizeEnglish=value=>String(value??'').normalize('NFKC')
 .trim().replace(/\s+/gu,' ').toLocaleLowerCase('en');

export function auditAmbiguousPublicCues(words){
 assert.ok(Array.isArray(words),'Public vocabulary must be an array');
 const byCue=new Map();
 for(const row of words){
  assert.ok(row&&typeof row.english==='string'&&
   typeof row.meaning==='string'&&typeof row.topic==='string',
   'Public word has invalid English, meaning or topic');
  const cue=normalizeCue(row.meaning);
  const english=normalizeEnglish(row.english);
  if(!cue||!english)continue;
  if(!byCue.has(cue))byCue.set(cue,[]);
  byCue.get(cue).push(row);
 }
 const collisions=[],uncovered=[];
 for(const [cue,rows] of byCue){
  if(new Set(rows.map(r=>normalizeEnglish(r.english))).size<2)continue;
  const affected=rows.map(row=>({
   english:row.english,topic:row.topic,word_id:row.word_id||row.id||null,
   held:isPendingEditorialRecall({
    source:'shared',id:row.word_id||row.id,word_id:row.word_id||row.id,
    english:row.english,meaning:row.meaning,topic:row.topic
   })
  }));
  const entry={cue,affected};
  collisions.push(entry);
  for(const a of affected)if(!a.held)uncovered.push({cue,english:a.english,topic:a.topic,word_id:a.word_id});
 }
 collisions.sort((a,b)=>a.cue.localeCompare(b.cue,'vi'));
 return {total_words:words.length,collision_groups:collisions.length,
  affected_cards:collisions.reduce((sum,c)=>sum+c.affected.length,0),
  collisions,uncovered};
}

export async function auditProductionReadOnly(){
 const response=await fetch(ORIGIN+'/api/learning/vocabulary',{
  method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000),
  headers:{accept:'application/json'}
 });
 assert.equal(response.status,200,'Production public vocabulary must return HTTP 200');
 assert.match(response.headers.get('content-type')||'',/application\/json/i);
 const payload=await response.json();
 assert.equal(payload.scope,'catalog');
 assert.ok(Array.isArray(payload.words)&&payload.words.length>=2000&&
  payload.words.length<=5000,'Unexpected public catalog size');
 const report=auditAmbiguousPublicCues(payload.words);
 // Existing six cards must remain explicitly guarded until human signoff.
 for(const expected of ['năm','đánh giá','đáng kể']){
  assert.ok(report.collisions.some(c=>c.cue===expected),
   'Expected editorial review group missing: '+expected);
 }
 assert.deepEqual(report.uncovered,[],
  'A shared word with ambiguous Vietnamese cue is auto-gradable');
 return report;
}
if(process.argv.includes('--live')){
 try{
  const report=await auditProductionReadOnly();
  console.log(JSON.stringify({
   result:'PASS_UX61_5_PUBLIC_CUE_POLICY',
   source:'GET-only public Production vocabulary',
   observed_words:report.total_words,
   collision_groups:report.collision_groups,
   affected_cards:report.affected_cards,
   held_groups:report.collisions.map(c=>({cue:c.cue,
    words:c.affected.map(w=>w.english),held:c.affected.every(w=>w.held)})),
   note:'No auth, no SRS review writes, no Production data changes'
  }));
 }catch(error){
  console.error('FAIL_UX61_5_PUBLIC_CUE_POLICY: '+error.message);
  process.exitCode=1;
 }
}
