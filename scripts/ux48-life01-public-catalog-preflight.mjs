/**
 * LIFE-01 candidate preflight against the *live public* WordSky catalog.
 *
 * This script NEVER inserts, updates or deletes WordSky data. It does not
 * authenticate and only performs GET requests against a pinned Production host.
 * A clean collision report is not CEFR approval or publication authorization.
 *
 * Usage: node scripts/ux48-life01-public-catalog-preflight.mjs --live
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const PROD='https://wordsky-english-game.vercel.app';
const allowedEvidence=new Set(['exact_sense_label','headword_pos_label','collocation_in_labeled_sense','contextual_inference']);
const normalize=s=>String(s??'').normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');

function requireCatalog(catalog,topics){
 if(!catalog||catalog.scope!=='catalog'||!Array.isArray(catalog.words)||!catalog.words.length)
  throw Error('Public vocabulary API response is missing or malformed');
 if(!topics||!Array.isArray(topics.topics)||!topics.topics.length)
  throw Error('Public topics API response is missing or malformed');
 return new Set(topics.topics.filter(x=>x.enabled===true).map(x=>x.title));
}

export function auditLife01Candidate({batch,catalog,topics}={}){
 const activeTopics=requireCatalog(catalog,topics);
 if(!batch||batch.batch_id!=='LIFE-01'||batch.status!=='DRAFT'||!Array.isArray(batch.records)||batch.records.length!==100)
  throw Error('LIFE-01 must contain exactly 100 DRAFT candidate records');
 const oldEnglish=new Map(),oldMeaning=new Map(),newEnglish=new Set(),newMeaning=new Set();
 for(const word of catalog.words){
  if(!word||typeof word.english!=='string'||typeof word.meaning!=='string')throw Error('Malformed Production word');
  const en=normalize(word.english),vi=normalize(word.meaning);
  if(!oldEnglish.has(en))oldEnglish.set(en,[]);
  if(!oldMeaning.has(vi))oldMeaning.set(vi,[]);
  oldEnglish.get(en).push(word);
  oldMeaning.get(vi).push(word);
 }
 let presentCount=0;
 const collisions=[],problems=[],perTopic={},evidence={};
 for(const [i,w] of batch.records.entries()){
  const idx=i+1;
  if(!w||['topic','english','meaning','ipa','example','translation'].some(k=>typeof w[k]!=='string'||!w[k].trim())){
   problems.push({index:idx,issue:'missing_required_content'});continue;
  }
  if(!activeTopics.has(w.topic))problems.push({index:idx,issue:'inactive_or_unknown_topic'});
  if(w.review_status!=='PROVISIONAL'||!allowedEvidence.has(w.cefr_evidence_kind))
   problems.push({index:idx,issue:'invalid_candidate_review_state'});
  if(!['A1','A2','B1','B2','C1','C2'].includes(w.level))
   problems.push({index:idx,issue:'invalid_proposed_cefr'});
  if(typeof w.source_url!=='string'||!w.source_url.startsWith('https://'))
   problems.push({index:idx,issue:'missing_public_source_reference'});
  const en=normalize(w.english),vi=normalize(w.meaning);
  const existing=oldEnglish.get(en)||[];
  const isSame=existing.some(o=>['topic','english','meaning','ipa','example','translation']
    .every(key=>normalize(o[key])===normalize(w[key])));
  if(isSame)presentCount++;
  // Replaying the exact same published record is not a new-word collision.
  // A conflicting English term or Vietnamese cue remains a hard blocker.
  if(existing.some(o=>!isSame||['topic','meaning'].some(k=>normalize(o[k])!==normalize(w[k]))))
    collisions.push({index:idx,type:'live_english',word:w.english});
  if((oldMeaning.get(vi)||[]).some(o=>normalize(o.english)!==en))
    collisions.push({index:idx,type:'live_vietnamese_cue',word:w.english});
  if(newEnglish.has(en))collisions.push({index:idx,type:'in_batch_english',word:w.english});
  if(newMeaning.has(vi))collisions.push({index:idx,type:'in_batch_vietnamese_cue',word:w.english});
  newEnglish.add(en);newMeaning.add(vi);
  perTopic[w.topic]=(perTopic[w.topic]||0)+1;
  evidence[w.cefr_evidence_kind]=(evidence[w.cefr_evidence_kind]||0)+1;
 }
 return Object.freeze({
  batch_id:'LIFE-01',candidate_status:'DRAFT',candidate_count:batch.records.length,
  live_word_count:catalog.words.length,
  already_present_count:presentCount,
  potential_new_words:batch.records.length-presentCount,
  potential_total_if_every_record_is_approved_and_published:catalog.words.length+batch.records.length-presentCount,
  per_topic:perTopic,source_evidence:evidence,collisions,problems,
  independent_human_review_complete:false,
  approved_records:0,
  can_publish_to_production:false,
  explanation:'This is a read-only catalog reconciliation, not an approval or insert command. Same-word published records count as already present, while all original draft CEFR claims remain PROVISIONAL and require independent bilingual review.',
  source_of_truth:'Read-only live public API and repo vocab/batches/LIFE-01.json',
  mutations:0
 });
}

async function getJSON(path){
 if(!['/api/topics','/api/learning/vocabulary'].includes(path))throw Error('Forbidden URL path');
 const response=await fetch(PROD+path,{
  method:'GET',redirect:'error',credentials:'omit',
  headers:{accept:'application/json','cache-control':'no-store'},
  signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw Error('Production '+path+' returned HTTP '+response.status);
 if(!(response.headers.get('content-type')||'').includes('application/json'))
  throw Error('Unexpected Production response content type');
 return response.json();
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv.length!==3||process.argv[2]!=='--live'){
  console.error('Usage: node scripts/ux48-life01-public-catalog-preflight.mjs --live (GET only, no writes)');
  process.exitCode=2;
 }else{
  try{
   const batch=JSON.parse(readFileSync(new URL('vocab/batches/LIFE-01.json',root),'utf8'));
   const [catalog,topics]=await Promise.all([getJSON('/api/learning/vocabulary'),getJSON('/api/topics')]);
   const report=auditLife01Candidate({batch,catalog,topics});
   console.log(JSON.stringify(report,null,2));
   if(report.collisions.length||report.problems.length)process.exitCode=1;
  }catch(e){console.error('LIFE-01 preflight FAILED: '+e.message);process.exitCode=1}
 }
}
