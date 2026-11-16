/*
 * LIFE-02 topic registration: fail-closed, inactive-only and Preview gated.
 * This is separate from the Admin topic API (which defaults to enabled=true).
 * Nothing here approves a word, publishes a topic, or mutates learning data.
 */
export const LIFE02_TOPIC_NAME='Everyday Conversation - Giao tiếp hằng ngày';
export const LIFE02_TOPIC_BATCH='LIFE-02';
const fail=msg=>{throw Error('LIFE-02 topic preview: '+msg)};
const norm=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('vi');
const noValue=value=>!value||typeof value!=='string'||!value.trim();
const safeHttpsUrl=value=>{
 if(noValue(value))fail('missing target URL');
 let u;
 try{u=new URL(value)}catch{fail('malformed target URL')}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||!u.username||!u.pathname||
    u.hash||u.search)fail('unsupported PostgreSQL connection URL');
 return u;
};

export function validateLife02TopicProposal(roadmap,seed,batch){
 if(!roadmap||!seed||!batch||Array.isArray(seed)||Array.isArray(batch)||
    roadmap.version!=='wordsky-life-1000-v1'||roadmap.status!=='PLANNED_NOT_IMPORTED'||
    batch.batch_id!==LIFE02_TOPIC_BATCH||batch.status!=='DRAFT'||
    !Array.isArray(batch.records)||batch.records.length!==100)
   fail('invalid roadmap or unpublished LIFE-02 batch');
 const proposal=roadmap.proposed_topics?.find(p=>p.name===LIFE02_TOPIC_NAME);
 if(!proposal||proposal.activation!=='REQUIRES_SEPARATE_APPROVAL'||
    Object.keys(seed).some(t=>norm(t)===norm(LIFE02_TOPIC_NAME)))
   fail('new topic must be proposed, not a seeded/approved topic');
 const group=roadmap.batches?.find(b=>b.id===LIFE02_TOPIC_BATCH);
 if(!group||group.groups?.length!==4||group.groups.some(s=>s.topic!==LIFE02_TOPIC_NAME||s.target_words!==25))
   fail('roadmap group allocation is invalid');
 const quota=new Map(group.groups.map(g=>[g.id,0]));
 for(const record of batch.records){
  if(!record||record.topic!==LIFE02_TOPIC_NAME||record.review_status!=='PROVISIONAL'||
     record.cefr_evidence_kind!=='contextual_inference'||record.cefr_source_label!==null||
     Object.hasOwn(record,'reviewed_by')||Object.hasOwn(record,'approved_by')||
     !quota.has(record.group_id))fail('unreviewed candidate must not be approved or published');
  quota.set(record.group_id,quota.get(record.group_id)+1);
 }
 if([...quota.values()].some(n=>n!==25))fail('LIFE-02 must have 4 groups x 25 unpublished candidates');
 if(LIFE02_TOPIC_NAME.length>80)fail('topic name exceeds database limit');
 return Object.freeze({
  batch_id:LIFE02_TOPIC_BATCH,topic_title:LIFE02_TOPIC_NAME,
  proposed_words:batch.records.length,activation:'INACTIVE_ONLY',
  approved_words:0,reviewer_approved:false,import_authorized:false,
  publish_authorized:false,production_authorized:false
 });
}

/** Keep target selection independent of the DB adapter; test all paths offline. */
export function resolveLife02RegistrationTarget(argv=[],env={}){
 if(!Array.isArray(argv)||argv.length>1)fail('choose only one mode');
 const arg=argv[0]??'--dry-run';
 if(!['--dry-run','--write-local-test','--write-preview'].includes(arg))
  fail('unsupported mode');
 if(arg==='--dry-run')return Object.freeze({mode:'dry-run',mayWrite:false});
 if(env.VERCEL_ENV==='production'||env.WORDSKY_TARGET_ENV==='production')
  fail('Production environment is forbidden');
 if(arg==='--write-local-test'){
  const url=safeHttpsUrl(env.WORDSKY_TEST_DATABASE_URL);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||
     url.port!=='5547'||url.pathname!=='/wordsky_v6_test'||
     decodeURIComponent(url.username)!=='wordsky_test')
    fail('local test may write only to wordsky_test@127.0.0.1:5547/wordsky_v6_test');
  return Object.freeze({
   mode:'local-test',mayWrite:true,connectionString:env.WORDSKY_TEST_DATABASE_URL,
   expectedDatabase:'wordsky_v6_test',expectedRole:'wordsky_test'
  });
 }
 if(env.CI==='true')fail('remote Preview writes prohibited in CI');
 if(env.WORDSKY_TARGET_ENV!=='preview'||
    env.WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED!=='true')
  fail('explicit Preview target and one-time human write approval required');
 const url=safeHttpsUrl(env.WORDSKY_PREVIEW_DATABASE_URL);
 const expectedHost=env.WORDSKY_PREVIEW_EXPECTED_HOST;
 const expectedDB=env.WORDSKY_PREVIEW_EXPECTED_DB;
 const expectedRole=env.WORDSKY_PREVIEW_EXPECTED_ROLE;
 if([expectedHost,expectedDB,expectedRole].some(noValue)||
    url.hostname!==expectedHost||url.pathname!=='/'+expectedDB||
    decodeURIComponent(url.username)!==expectedRole||
    ['127.0.0.1','localhost'].includes(url.hostname)||
    /ilyhbhoqswsioxxpuvcb/i.test(url.href))
  fail('Preview host, database and role must match the independently verified isolated target');
 for(const other of [env.DATABASE_URL,env.WORDSKY_PRODUCTION_DATABASE_URL,
   env.PRODUCTION_DATABASE_URL,env.SUPABASE_DB_URL]){
  if(other&&other===env.WORDSKY_PREVIEW_DATABASE_URL)
    fail('Preview connection string equals another DB target');
 }
 return Object.freeze({
  mode:'preview',mayWrite:true,connectionString:env.WORDSKY_PREVIEW_DATABASE_URL,
  expectedDatabase:expectedDB,expectedRole
 });
}

/** Must be called inside a caller-controlled transaction.
 * Creates ONLY a disabled empty topic, with no words, rounds or approval.
 * Repeated use is idempotent. An enabled or occupied row is a blocker.
 */
export async function registerInactiveLife02Topic(db,plan,target){
 if(!db||typeof db.query!=='function'||plan?.activation!=='INACTIVE_ONLY'||
    plan.topic_title!==LIFE02_TOPIC_NAME||
    !target?.mayWrite||!target.expectedDatabase||!target.expectedRole)
  fail('write requires checked proposal, target and DB transaction');
 const identity=await db.query('SELECT current_database() AS db_name,current_user AS db_role');
 const row=identity.rows?.[0];
 if(!row||row.db_name!==target.expectedDatabase||row.db_role!==target.expectedRole)
  fail('actual PostgreSQL database and role do not match checked target');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',
  ['wordsky-life02-topic:'+norm(LIFE02_TOPIC_NAME)]);
 const prev=await db.query(
  'SELECT id,title,enabled FROM ws_topics WHERE lower(btrim(title))=lower(btrim($1)) FOR UPDATE',
  [LIFE02_TOPIC_NAME]);
 if(prev.rows.length>1)fail('multiple topic aliases exist: manual intervention required');
 let topic=prev.rows[0],change='already_disabled';
 if(topic){
  if(topic.title!==LIFE02_TOPIC_NAME||topic.enabled!==false)
   fail('existing topic has different title or is already enabled; refuse to mutate');
 }else{
  const inserted=await db.query(
   'INSERT INTO ws_topics(title,enabled) VALUES($1,FALSE) ON CONFLICT(title) DO NOTHING RETURNING id,title,enabled',
   [LIFE02_TOPIC_NAME]);
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
