/* UX61.8 offline editorial evidence preflight (strict, read-only, fail-closed).
 * NO reviewer authentication, approval, activation, SQL, CEFR or SRS mutation.
 * The output only reports whether the unapproved reference packet still matches
 * a separately fetched public catalog snapshot. It is NOT permission to grade.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isPendingEditorialRecall} from '../public/ux61-pending-recall.js';

export const UX618_SCHEMA='wordsky-ux61-8-editorial-evidence-v1';
const EXPECTED=['five','year','assess','evaluate','significant','substantial'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GATES={
 allow_auto_apply:false,allow_approval_from_packet:false,
 allow_graded_srs_activation:false,allow_cefr_mutation:false,
 allow_user_history_change:false,requires_independent_human_sense_review:true,
 requires_verified_reviewer_identity:true,requires_exact_catalog_recheck:true,
 requires_preview_e2e:true
};
function keys(value,expected,label){
 assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object');
 assert.deepEqual(Object.keys(value).sort(),expected.slice().sort(),label+' shape changed');
}
const expectedFields={
 packet:['schema','scope','decision_status','source','release_gate','reviewer_instructions','cards'],
 source:['kind','url','environment','as_of','observed_total_words'],
 card:['english','topic','word_id','existing_meaning','original_example','original_translation',
  'part_of_speech','source_url','candidate_contextual_cue_vi','editorial_note','review'],
 review:['status','reviewed_by','reviewed_at','accepted_english','approved_prompt_vi','independent_receipts']
};
function nonblank(value,label){
 assert.ok(typeof value==='string'&&value.length>0&&value.length<=800&&value.trim()===value,
  label+' must be nonempty');
 return value;
}
function knownSource(word){
 return 'https://dictionary.cambridge.org/dictionary/english/'+word;
}
export function validatePendingEditorialPacket(packet,publicWords){
 keys(packet,expectedFields.packet,'packet');
 assert.equal(packet.schema,UX618_SCHEMA);
 assert.equal(packet.scope,'offline-editorial-reference-only');
 assert.equal(packet.decision_status,'PENDING_HUMAN_REVIEW');
 nonblank(packet.reviewer_instructions,'reviewer_instructions');
 keys(packet.source,expectedFields.source,'source');
 assert.equal(packet.source.kind,'read-only-public-catalog');
 assert.equal(packet.source.environment,'production');
 assert.equal(packet.source.url,'https://wordsky-english-game.vercel.app/api/learning/vocabulary');
 assert.match(packet.source.as_of,/^20\d\d-\d\d-\d\d$/);
 assert.ok(Number.isSafeInteger(packet.source.observed_total_words)&&packet.source.observed_total_words>=6);
 keys(packet.release_gate,Object.keys(GATES),'release_gate');
 assert.deepEqual(packet.release_gate,GATES,'Never permit activation through an offline packet');
 assert.ok(Array.isArray(packet.cards)&&packet.cards.length===EXPECTED.length,
  'Exactly six pending editorial cards required');
 assert.deepEqual(packet.cards.map(c=>c.english),EXPECTED,'Canonical card order and membership must match');
 assert.ok(Array.isArray(publicWords)&&publicWords.length>=6,'Explicit public catalog required');
 const index=new Map(),ids=new Set();
 for(const word of publicWords){
  if(!word||typeof word!=='object')throw Error('Malformed public catalog row');
  const id=word.word_id||word.id;
  if(typeof id!=='string')continue;
  if(index.has(id.toLowerCase()))throw Error('Duplicate public word UUID');
  index.set(id.toLowerCase(),word);
 }
 const approved=0,canonical=[],cues=new Map();
 for(const c of packet.cards){
  keys(c,expectedFields.card,'card');
  for(const k of ['english','topic','word_id','existing_meaning','original_example',
   'original_translation','part_of_speech','source_url','editorial_note'])nonblank(c[k],k);
  assert.match(c.word_id,UUID,'Valid production word UUID required');
  assert.ok(!ids.has(c.word_id),'Duplicate editorial word UUID');ids.add(c.word_id);
  assert.equal(c.source_url,knownSource(c.english),'Dictionary source must be allowlisted');
  assert.ok(c.candidate_contextual_cue_vi===null||
   (typeof c.candidate_contextual_cue_vi==='string'&&c.candidate_contextual_cue_vi.trim()===c.candidate_contextual_cue_vi&&c.candidate_contextual_cue_vi.length>5),
   'Context suggestion must be null or informative');
  if(['assess','evaluate'].includes(c.english))
   assert.equal(c.candidate_contextual_cue_vi,null,
    'Overlapping synonyms must not be given artificial distinct answers');
  keys(c.review,expectedFields.review,'review');
  assert.equal(c.review.status,'PENDING_HUMAN_REVIEW');
  for(const field of ['reviewed_by','reviewed_at','accepted_english','approved_prompt_vi'])
   assert.equal(c.review[field],null,'Unverified review field: '+field);
  assert.deepEqual(c.review.independent_receipts,[],'Offline packet cannot claim reviewer proof');
  const live=index.get(c.word_id.toLowerCase());
  assert.ok(live,'Production word missing: '+c.english);
  for(const [field,catalogKey] of [
   ['english','english'],['topic','topic'],['existing_meaning','meaning'],
   ['original_example','example'],['original_translation','translation']
  ])assert.equal(c[field],live[catalogKey],c.english+' catalog drift: '+field);
  assert.equal(isPendingEditorialRecall({...live,source:'shared',id:c.word_id}),true,
   'Editorial card not blocked from scored SRS: '+c.english);
  const cue=String(c.existing_meaning).normalize('NFKC').trim()
   .replace(/\s+/gu,' ').toLocaleLowerCase('vi');
  cues.set(cue,(cues.get(cue)||0)+1);
  canonical.push([c.word_id,c.english,c.topic,c.existing_meaning,c.original_example,c.original_translation]);
 }
 assert.deepEqual([...cues.entries()].sort((a,b)=>a[0].localeCompare(b[0],'vi')),
  [['năm',2],['đánh giá',2],['đáng kể',2]].sort((a,b)=>a[0].localeCompare(b[0],'vi')),
  'Exactly three Vietnamese cues/two distinct cards per cue required');
 const snapshotHash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
 return Object.freeze({
  policy:UX618_SCHEMA,scope:'offline-unapproved-reference-check-only',
  matched_cards:EXPECTED.length,collision_groups:cues.size,
  public_words:publicWords.length,source_word_count_changed:
   publicWords.length!==packet.source.observed_total_words,
  exact_card_snapshot_sha256:snapshotHash,
  pending_human_review:EXPECTED.length,verified_approvals:approved,
  safe_to_use_as_reference:true,authorized_to_activate_prompts:false,
  authorized_to_grade_srs:false,authorized_to_modify_cefr:false,
  independent_reviewer_identity_verified:false
 });
}
