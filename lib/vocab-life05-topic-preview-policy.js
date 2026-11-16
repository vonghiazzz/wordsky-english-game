/*
 * LIFE-05 Money & Payments topic gate.
 * OFFLINE by default. NEVER approves expressions, changes SRS, or enables
 * a category. Remote isolated Preview writes require manual one-time gates.
 * Uses the already verified LIFE-02 target-identity policy unchanged.
 */
import {resolveLife02RegistrationTarget} from './vocab-topic-preview-policy.js';

export const LIFE05_TOPIC_NAME='Money & Payments - Thanh toán';
export const LIFE05_TOPIC_BATCH='LIFE-05';
const fail=message=>{throw new Error('LIFE-05 topic preview: '+message)};
const norm=s=>String(s??'').normalize('NFKC').trim().toLocaleLowerCase('vi');

export function validateLife05TopicProposal(roadmap,seed,batch){
 if(!roadmap||!seed||!batch||Array.isArray(seed)||Array.isArray(batch)||
    roadmap.version!=='wordsky-life-1000-v1'||
    roadmap.status!=='PLANNED_NOT_IMPORTED'||
    batch.batch_id!==LIFE05_TOPIC_BATCH||batch.status!=='DRAFT'||
    !Array.isArray(batch.records)||batch.records.length!==100)
   fail('invalid LIFE-05 roadmap or candidate count');
 const topic=roadmap.proposed_topics?.find(t=>t.name===LIFE05_TOPIC_NAME);
 if(!topic||topic.activation!=='REQUIRES_SEPARATE_APPROVAL'||
    Object.keys(seed).some(t=>norm(t)===norm(LIFE05_TOPIC_NAME)))
   fail('proposed topic must be new, disabled and explicitly pending');
 const definition=roadmap.batches?.find(b=>b.id===LIFE05_TOPIC_BATCH);
 const required={
  shopping:'Shopping - Mua sắm',prices:LIFE05_TOPIC_NAME,
  payments:LIFE05_TOPIC_NAME,returns:LIFE05_TOPIC_NAME
 };
 if(!definition||!Array.isArray(definition.groups)||definition.groups.length!==4||
    definition.groups.some(g=>g.topic!==required[g.id]||g.target_words!==25)||
    new Set(definition.groups.map(g=>g.id)).size!==4)
   fail('roadmap must have exactly four approved 25-word allocations');
 const quota=new Map(definition.groups.map(g=>[g.id,0]));
 for(const item of batch.records){
  if(!item||item.topic!==required[item.group_id]||
     item.review_status!=='PROVISIONAL'||
     !['exact_sense_label','collocation_in_labeled_sense','contextual_inference'].includes(item.cefr_evidence_kind)||
     ((item.cefr_evidence_kind==='contextual_inference'&&item.cefr_source_label!==null)||
      (item.cefr_evidence_kind!=='contextual_inference'&&item.cefr_source_label!==item.level))||
     Object.hasOwn(item,'reviewed_by')||Object.hasOwn(item,'reviewed_at')||
     Object.hasOwn(item,'approved_by')||Object.hasOwn(item,'approved_at')||
     !quota.has(item.group_id))
    fail('candidate must stay draft and cannot impersonate a reviewer');
  quota.set(item.group_id,quota.get(item.group_id)+1);
 }
 if([...quota.values()].some(n=>n!==25))
  fail('all four topic groups must have exactly 25 candidates');
 if(LIFE05_TOPIC_NAME.length>80)fail('title exceeds schema');
 return Object.freeze({
  batch_id:LIFE05_TOPIC_BATCH,topic_title:LIFE05_TOPIC_NAME,
  proposed_words:75,total_batch_records:100,activation:'INACTIVE_ONLY',
  approved_words:0,reviewer_approved:false,import_authorized:false,
  publish_authorized:false,production_authorized:false
 });
}

export function resolveLife05RegistrationTarget(argv=[],env={}){
 const target=resolveLife02RegistrationTarget(argv,env);
 if(target.mode==='preview'&&env.WORDSKY_LIFE05_TOPIC_WRITE_APPROVED!=='true')
   fail('requires separate human approval for LIFE-05 isolated Preview topic');
 return target;
}

/* Caller controls SERIALIZABLE BEGIN/COMMIT/ROLLBACK. Never use Admin API. */

export async function registerInactiveLife05Topic(db,plan,target){
 if(!db||typeof db.query!=='function'||plan?.batch_id!==LIFE05_TOPIC_BATCH||plan?.activation!=='INACTIVE_ONLY'||
    plan.topic_title!==LIFE05_TOPIC_NAME||
    !target?.mayWrite||!target.expectedDatabase||!target.expectedRole)
  fail('write requires checked proposal, target and DB transaction');
 const identity=await db.query('SELECT current_database() AS db_name,current_user AS db_role');
 const row=identity.rows?.[0];
 if(!row||row.db_name!==target.expectedDatabase||row.db_role!==target.expectedRole)
  fail('actual PostgreSQL database and role do not match checked target');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',
  ['wordsky-life05-topic:'+norm(LIFE05_TOPIC_NAME)]);
 const prev=await db.query(
  'SELECT id,title,enabled FROM ws_topics WHERE lower(btrim(title))=lower(btrim($1)) FOR UPDATE',
  [LIFE05_TOPIC_NAME]);
 if(prev.rows.length>1)fail('multiple topic aliases exist: manual intervention required');
 let topic=prev.rows[0],change='already_disabled';
 if(topic){
  if(topic.title!==LIFE05_TOPIC_NAME||topic.enabled!==false)
   fail('existing topic has different title or is already enabled; refuse to mutate');
 }else{
  const inserted=await db.query(
   'INSERT INTO ws_topics(title,enabled) VALUES($1,FALSE) ON CONFLICT(title) DO NOTHING RETURNING id,title,enabled',
   [LIFE05_TOPIC_NAME]);
  if(inserted.rows.length!==1)fail('concurrent topic conflict; abort transaction');
  topic=inserted.rows[0];change='created_disabled';
 }
 if(topic.enabled!==false)fail('topic must remain disabled');
 const uses=await db.query(
  'SELECT (SELECT count(*)::int FROM ws_words WHERE topic_id=$1) AS words,'+
  '(SELECT count(*)::int FROM ws_rounds WHERE topic_id=$1) AS rounds',
  [topic.id]);
 if(uses.rows.length!==1||Number(uses.rows[0].words)!==0||Number(uses.rows[0].rounds)!==0)
  fail('a proposed topic cannot contain words or active/archived round references');
 return Object.freeze({
  topic_id:topic.id,topic_title:topic.title,action:change,
  enabled:false,word_count:0,round_count:0,
  approved_words:0,published:false
 });
}
