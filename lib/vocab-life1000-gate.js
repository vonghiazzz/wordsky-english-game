/*
 * WordSky LIFE-1000 vocabulary planning / candidate preflight.
 *
 * Offline ONLY. No database, HTTP, user account, SRS, gameplay,
 * real reviewer or approval is implemented. A PROVISIONAL source link
 * is not evidence of a Cambridge-certified word level or a human review.
 */
const LEVELS=new Set(['A1','A2','B1','B2','C1','C2']);
const SOURCE_KINDS=new Set([
 'exact_sense_label','headword_pos_label','collocation_in_labeled_sense','contextual_inference'
]);
const WORD_FIELDS=[
 'group_id','topic','english','ipa','meaning','example','translation',
 'part_of_speech','level','review_status','source_url',
 'cefr_evidence_kind','cefr_source_label','source_note'
];
const fail=message=>{throw new Error('LIFE-1000 preflight: '+message)};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const tidy=(x,max=240)=>{
 if(typeof x!=='string'||x.length<1||x.length>max||
    /[\u0000-\u001f\u007f]/u.test(x))fail('missing, oversized or unsafe text');
 const normalized=x.normalize('NFKC').trim().replace(/\s+/gu,' ');
 if(!normalized)fail('empty text');
 return normalized;
};
const en=x=>tidy(x,160).toLocaleLowerCase('en');
const vi=x=>tidy(x,240).toLocaleLowerCase('vi');
const topicKey=x=>tidy(x,80).toLocaleLowerCase('vi');
const duplicates=xs=>new Set(xs).size!==xs.length;
const sum=xs=>xs.reduce((n,x)=>n+x,0);
const knownHttps=url=>{
 if(typeof url!=='string'||url.length>400||/\s/u.test(url))fail('invalid source URL');
 let u;
 try{u=new URL(url)}catch{fail('invalid source URL')}
 if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.hash||
    !/^[a-z0-9.-]+$/i.test(u.hostname)||!u.hostname.includes('.')||
    /^(localhost|127\.|0\.|10\.|192\.168\.)/i.test(u.hostname))fail('source URL must be a public HTTPS page');
 return u.href;
};

/** The roadmap describes editorial destinations, NOT provisioned DB topics.
 * No new topic can be automatically enabled, imported or exposed to users.
 */
export function validateLife1000Roadmap(roadmap,seed){
 if(!plain(roadmap)||!plain(seed)||Array.isArray(seed)||
    roadmap.version!=='wordsky-life-1000-v1'||
    roadmap.status!=='PLANNED_NOT_IMPORTED'||
    roadmap.batch_count!==10||roadmap.target_words_per_batch!==100||
    roadmap.target_words_per_group!==25||roadmap.total_target_new_words!==1000||
    !Array.isArray(roadmap.batches)||roadmap.batches.length!==10||
    !Array.isArray(roadmap.proposed_topics)||roadmap.proposed_topics.length!==7)
   fail('roadmap version, population or target is inconsistent');
 const current=Object.keys(seed).map(topicKey);
 if(duplicates(current))fail('existing topic catalog is ambiguous');
 const future=roadmap.proposed_topics.map(t=>{
  if(!plain(t)||t.activation!=='REQUIRES_SEPARATE_APPROVAL')fail('unsafe proposed topic');
  return topicKey(t.name);
 });
 if(duplicates(future)||future.some(t=>current.includes(t)))fail('planned topic conflicts with active catalog');
 const allowed=new Set([...current,...future]);
 const plannedUsage=new Set();
 let sectionCount=0;
 for(let i=0;i<roadmap.batches.length;i++){
  const batch=roadmap.batches[i];
  if(!plain(batch)||batch.id!=='LIFE-'+String(i+1).padStart(2,'0')||
   !Array.isArray(batch.groups)||batch.groups.length!==4)fail('non-deterministic batch sequence');
  tidy(batch.name,150);
  const ids=new Set(),quota=[];
  for(const section of batch.groups){
   if(!plain(section)||!/^([a-z][a-z0-9-]{1,48})$/u.test(section.id)||
    ids.has(section.id)||section.target_words!==25)fail('invalid group or quota');
   tidy(section.name,160);
   const target=topicKey(section.topic);
   if(!allowed.has(target))fail('unknown or unapproved topic in editorial roadmap');
   if(future.includes(target))plannedUsage.add(target);
   ids.add(section.id);quota.push(section.target_words);sectionCount++;
  }
  if(sum(quota)!==100)fail('batch is not exactly 100 words');
 }
 if(plannedUsage.size!==future.length)fail('a proposed topic has no planned allocation');
 const mix=roadmap.suggested_cefr_mix;
 if(!plain(mix)||Object.keys(mix).sort().join(',')!=='A1,A2,B1,B2'||
    Object.values(mix).some(x=>!Number.isSafeInteger(x)||x<0)||
    sum(Object.values(mix))!==1000)fail('CEFR editorial targets inconsistent');
 if(!plain(roadmap.policies)||
    roadmap.policies.import!=='NO_DATABASE_WRITES_FROM_PLAN'||
    roadmap.policies.review!=='HUMAN_BILINGUAL_REVIEW_REQUIRED'||
    roadmap.policies.cefr!=='PROVISIONAL_UNTIL_INDEPENDENT_REVIEW')
    fail('unsafe approval/import policy');
 return Object.freeze({
  plan_id:roadmap.version,
  batches:roadmap.batches.length,
  sections:sectionCount,
  planned_words:roadmap.total_target_new_words,
  existing_topics:current.length,
  proposed_topics:future.length,
  new_topics_created:false,
  reviewer_approval_granted:false,
  authorized_to_import:false,
  authorized_to_deploy:false
 });
}

function existingWords(seed,drafts,priorRecords){
 const words=new Set(),cues=new Map();
 const push=(english,meaning)=>{
  const word=en(english);
  words.add(word);
  if(typeof meaning==='string'&&meaning.trim()){
   const cue=vi(meaning);
   if(!cues.has(cue))cues.set(cue,new Set());
   cues.get(cue).add(word);
  }
 };
 for(const rows of Object.values(seed)){
  if(!Array.isArray(rows))fail('invalid public seed cards');
  for(const r of rows){
   if(!Array.isArray(r)||r.length<3)fail('invalid public seed row');
   push(r[0],r[2]);
  }
 }
 if(!Array.isArray(drafts))fail('missing draft comparison catalog');
 for(const d of [...drafts,...priorRecords]){
  if(!plain(d))fail('invalid comparison draft');
  push(d.english,d.meaning);
 }
 return {words,cues};
}

/** Validates exactly 100 *draft candidates* for a specific planned batch.
 * Caller supplies ONLY public seed/draft data, never personal word lists.
 * Return value NEVER authorizes importing or approving any record.
 */
export function validateLife1000Candidates({roadmap,seed,drafts,priorRecords=[],batch}={}){
 const report=validateLife1000Roadmap(roadmap,seed);
 if(!plain(batch)||batch.status!=='DRAFT'||
    !Array.isArray(batch.records)||batch.records.length!==100)
   fail('candidate payload must contain exactly 100 DRAFT records');
 const definition=roadmap.batches.find(b=>b.id===batch.batch_id);
 if(!definition)fail('candidate batch id does not exist in plan');
 const groupMap=new Map(definition.groups.map(s=>[s.id,s]));
 const quota=new Map(definition.groups.map(s=>[s.id,0]));
 if(!Array.isArray(priorRecords))fail('invalid prior batch comparison data');
 const {words,cues}=existingWords(seed,drafts,priorRecords);
 const seen=new Set(),newCues=new Map(),reasonKinds={};
 for(const record of batch.records){
  if(!plain(record)||Object.keys(record).sort().join('|')!==[...WORD_FIELDS].sort().join('|'))
   fail('candidate fields do not match the safe draft schema');
  const section=groupMap.get(record.group_id);
  if(!section||topicKey(record.topic)!==topicKey(section.topic))
   fail('word assigned to wrong topic/group');
  const word=en(record.english),cue=vi(record.meaning);
  if(words.has(word)||seen.has(word))fail('duplicate English expression in existing catalog or batch: '+word);
  seen.add(word);
  const matches=cues.get(cue);
  if(matches&&[...matches].some(other=>other!==word))
   fail('Vietnamese cue collides with a different existing word: '+cue);
  const used=newCues.get(cue);
  if(used&&used!==word)fail('ambiguous new Vietnamese cue: '+cue);
  newCues.set(cue,word);
  for(const field of ['ipa','example','translation','part_of_speech'])
   tidy(record[field],field==='example'||field==='translation'?500:120);
  if(!LEVELS.has(record.level)||record.review_status!=='PROVISIONAL'||
   !SOURCE_KINDS.has(record.cefr_evidence_kind))
   fail('invalid provisional CEFR or review status');
  const label=record.cefr_source_label;
  if(record.cefr_evidence_kind==='contextual_inference'){
   if(label!==null)fail('contextual inference cannot impersonate a source CEFR label');
  }else if(label!==record.level)fail('source evidence and proposed level disagree');
  knownHttps(record.source_url);
  if(tidy(record.source_note,1200).length<25)
   fail('insufficient word-sense/source evidence note');
  quota.set(section.id,quota.get(section.id)+1);
  reasonKinds[record.cefr_evidence_kind]=(reasonKinds[record.cefr_evidence_kind]||0)+1;
 }
 if([...quota.values()].some(n=>n!==25))fail('each of four groups must contain 25 entries');
 return Object.freeze({
  batch_id:batch.batch_id,
  lexical_candidates:batch.records.length,
  groups:[...quota].map(([group_id,count])=>({group_id,count})),
  evidence_types:reasonKinds,
  proposed_level_count:batch.records.length,
  all_items_provisional:true,
  independent_review_completed:false,
  existing_topics_created:false,
  candidate_import_authorized:false,
  production_deployment_authorized:false,
  roadmap:report.plan_id
 });
}
