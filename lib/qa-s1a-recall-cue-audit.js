/*
 * QA-S1A - pure lexical audit of PUBLIC shared-vocabulary QA catalogs.
 * Candidate flags are NOT semantic judgments or accepted-answer variants.
 * No DB, network, SRS, auth, UI, or gameplay import or mutation.
 */
export const RECALL_AUDIT_POLICY='qa-s1a-public-cue-review-v1';
const MAX_CARDS=5000;
const fail=()=>{throw new TypeError('QA-S1A invalid public vocabulary input')};
const clean=(value,max,{allowBlank=false}={})=>{
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/u.test(value))fail();
 const result=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
 if(!allowBlank&&!result)fail();
 return result;
};
const cueKey=value=>value.toLocaleLowerCase('vi');
const englishKey=value=>value.toLocaleLowerCase('en');
const compareVi=(a,b)=>a.localeCompare(b,'vi');
const compareEn=(a,b)=>a.localeCompare(b,'en');
const quoteRegex=value=>value.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');
const likelyContainsEnglish=(meaning,english)=>{
 // Flag full English words/phrases only; no fuzzy grading or accent folding.
 // Short words ('a', 'in') create unacceptable false positives.
 if(english.replace(/\s/gu,'').length<3)return false;
 const pattern=new RegExp('(?:^|[^\\p{L}\\p{N}])'+
  quoteRegex(english).replace(/\s+/gu,'\\s+')+
  '(?=$|[^\\p{L}\\p{N}])','iu');
 return pattern.test(meaning);
};
/**
 * Feed public shared QA cards only. Caller is responsible for confirming the
 * dataset is NOT any account's personal vocabulary/history.
 *
 * Returns lexical candidates requiring human review. Nothing in this report
 * is authorized to change approved prompts, grading, or account review events.
 */
export function auditPublicRecallCues(cards){
 if(!Array.isArray(cards)||cards.length>MAX_CARDS)fail();
 const byCue=new Map(),byEnglish=new Map();
 const embedded=[],missing=[];
 for(const raw of cards){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.source!=='shared')fail();
  const topic=clean(raw.topic,80);
  const english=clean(raw.english,160);
  const meaning=clean(raw.meaning,240,{allowBlank:true});
  if(!meaning){missing.push({topic,english});continue;}
  const cue=cueKey(meaning),answer=englishKey(english);
  if(!byCue.has(cue))byCue.set(cue,{english:new Map(),topics:new Set()});
  byCue.get(cue).english.set(answer,english);
  byCue.get(cue).topics.add(topic);
  if(!byEnglish.has(answer))byEnglish.set(answer,{meanings:new Map(),topics:new Set()});
  byEnglish.get(answer).meanings.set(cue,meaning);
  byEnglish.get(answer).topics.add(topic);
  if(likelyContainsEnglish(cue,answer))
   embedded.push({topic,english,meaning});
 }
 const cueCollisions=[...byCue.entries()]
  .filter(([,group])=>group.english.size>1)
  .map(([cue,group])=>({
   cue,
   english:[...group.english.values()].sort(compareEn),
   topics:[...group.topics].sort(compareVi)
  })).sort((a,b)=>compareVi(a.cue,b.cue));
 const multipleMeanings=[...byEnglish.entries()]
  .filter(([,group])=>group.meanings.size>1)
  .map(([english,group])=>({
   english,meanings:[...group.meanings.values()].sort(compareVi),
   topics:[...group.topics].sort(compareVi)
  })).sort((a,b)=>compareEn(a.english,b.english));
 const ordered=(a,b)=>compareVi(a.topic,b.topic)||compareEn(a.english,b.english);
 embedded.sort(ordered);
 missing.sort(ordered);
 return Object.freeze({
  policy:RECALL_AUDIT_POLICY,
  scope:'public-shared-vocabulary-offline-only',
  card_count:cards.length,
  distinct_cue_count:byCue.size,
  cue_collision_count:cueCollisions.length,
  cue_collisions:cueCollisions,
  multiple_meaning_count:multipleMeanings.length,
  multiple_meanings:multipleMeanings,
  cue_contains_english_count:embedded.length,
  cue_contains_english_candidates:embedded,
  missing_meaning_count:missing.length,
  missing_meanings:missing,
  candidate_flags_are_not_translation_errors:true,
  human_semantic_review_required:true,
  accepted_answer_variants_created:false,
  grading_or_srs_changed:false
 });
}
