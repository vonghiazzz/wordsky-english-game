// WordSky V6: human-reviewed CEFR importer; inserts new entries and updates metadata of exact matching legacy words.
// All words remain within the existing 26 topics: it never creates a topic.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
const local=argv.includes('--write-local-test');
const preview=argv.includes('--write-preview');
if(local && preview)throw Error('Chon chi mot che do write.');
const fileFlag=argv.find(x=>x.startsWith('--file='));
const file=fileFlag?path.resolve(fileFlag.slice(7)):path.join(root,'vocab/cefr-provisional.json');
const validLevels=new Set(['A1','A2','B1','B2','C1','C2']);
const originalTopics=JSON.parse(fs.readFileSync(path.join(root,'db/seed-vocabulary.json'),'utf8'));
const topicNames=new Set(Object.keys(originalTopics));
const text=s=>String(s??'').trim();
let payload;
try{payload=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){throw Error('Khong doc duoc bo tu: '+e.message)}
const cards=Array.isArray(payload)?payload:payload.records;
if(!Array.isArray(cards))throw Error('Can JSON array hoac {records: []}.');
const testOnly=payload?.test_only===true;
if(testOnly && !local)throw Error('TEST-ONLY fixture chi duoc su dung voi --write-local-test.');
const seen=new Set(),approved=[];
for(const [i,c] of cards.entries()){
  if(!c || !topicNames.has(c.topic))throw Error(`Dong ${i+1}: topic khong thuoc 26 chu de duoc phep.`);
  for(const key of ['english','meaning','ipa','example','translation']){
    if(!text(c[key]))throw Error(`Dong ${i+1}: thieu ${key}`);
  }
  const unique=c.topic.toLowerCase()+'\u0000'+text(c.english).toLocaleLowerCase('en-US');
  if(seen.has(unique))throw Error(`Tu bi trung trong chu de ${c.topic}: ${c.english}`);
  seen.add(unique);
  if(!['UNREVIEWED','PROVISIONAL','APPROVED'].includes(c.review_status))throw Error(`Dong ${i+1}: review_status khong hop le.`);
  if(c.level!==null&&c.level!==undefined&&c.level!==''&&!validLevels.has(c.level))throw Error(`Dong ${i+1}: CEFR khong hop le.`);
  if(c.review_status!=='UNREVIEWED'&&!validLevels.has(c.level))throw Error(`Dong ${i+1}: can level cho PROVISIONAL/APPROVED.`);
  if(c.review_status==='APPROVED'){
    if(!testOnly && (!text(c.reviewed_by)||!text(c.reviewed_at)||!text(c.source_url))){
      throw Error(`Dong ${i+1}: APPROVED can reviewed_by, reviewed_at, source_url de truy vet nguon doi chieu.`);
    }
    if(!testOnly && (Number.isNaN(Date.parse(c.reviewed_at))||!/^[\w.\-]+$/u.test(c.reviewed_by)||!/^https:\/\//.test(c.source_url))){
      throw Error(`Dong ${i+1}: metadata duyet khong hop le.`);
    }
    approved.push(c);
  }
}
const byLevel=Object.fromEntries([...validLevels].map(l=>[l,approved.filter(x=>x.level===l).length]));
const byTopic=Object.fromEntries([...new Set(cards.map(x=>x.topic))].sort().map(t=>[t,approved.filter(x=>x.topic===t).length]));
console.log(JSON.stringify({file,records:cards.length,topicsOriginal:topicNames.size,topicsDraft:new Set(cards.map(x=>x.topic)).size,approved:approved.length,byLevel,approvedByTopic:byTopic,testOnly},null,2));
if(!local && !preview){console.log('DRY RUN: KHONG KET NOI database, KHONG GHI du lieu.');process.exit(0)}
if(!approved.length)throw Error('0 tu duoc duyet: tu choi ghi.');
let target;
if(local){
  target=process.env.WORDSKY_TEST_DATABASE_URL||'postgresql://wordsky_test:wordsky_local_only@localhost:5547/wordsky_v6_test';
  const u=new URL(target);
  if(!['localhost','127.0.0.1'].includes(u.hostname)||u.port!=='5547'||u.pathname!=='/wordsky_v6_test'||u.username!=='wordsky_test'){
    throw Error('Local test DB phai la wordsky_test@localhost:5547/wordsky_v6_test.');
  }
  console.log('LOCAL TEST ONLY (port 5547).');
}else{
  target=process.env.WORDSKY_PREVIEW_DATABASE_URL;
  if(!target||!/^postgres(ql)?:\/\//.test(target))throw Error('Thieu WORDSKY_PREVIEW_DATABASE_URL');
  if(process.env.WORDSKY_TARGET_ENV!=='preview')throw Error('Thieu WORDSKY_TARGET_ENV=preview');
  if(target===process.env.DATABASE_URL)throw Error('URL Preview trung voi DATABASE_URL.');
  if(target.includes('ilyhbhoqswsioxxpuvcb'))throw Error('Tuyet doi khong su dung WordSky Production lam Preview.');
  if(['localhost','127.0.0.1'].includes(new URL(target).hostname))throw Error('Preview phai la isolated remote DB; dung --write-local-test cho local.');
  console.log('PREVIEW ONLY. Verify URL belongs to an isolated preview project before proceeding.');
}
// Import db module only after all safety checks; it connects to the selected DB.
process.env.DATABASE_URL=target;
const {transaction,getPool}=await import('../lib/db.js');
const {decideCefrImport}=await import('../lib/cefr-import-policy.js');
// Keep evidence and reviewer identity in the same transaction as CEFR assignment.
// The Admin "review sources" endpoint reads action='word_cefr_review'.
async function writeCefrImportAudit(db,wordId,w,change,previous=null){
 const reviewer=testOnly?'TEST_ONLY_FIXTURE':text(w.reviewed_by);
 const record={
  english:text(w.english),meaning:text(w.meaning),topic:w.topic,
  cefr_level:w.level,cefr_review_status:'APPROVED',
  previous_level:previous?.cefr_level??null,previous_status:previous?.cefr_review_status??null,
  source_url:text(w.source_url),source_type:text(w.source_type),
  reviewed_by:reviewer,reviewed_at:text(w.reviewed_at)||null,
  verification_scope:text(w.verification_scope)||null,
  ipa_quality:text(w.ipa_quality)||null,
  importer:'scripts/import-cefr-approved.js',import_action:change,test_only:testOnly
 };
 await db.query(
  "INSERT INTO ws_audit(actor,action,entity_id,payload) VALUES ($1,'word_cefr_review',$2,$3::jsonb)",
  [reviewer,String(wordId),JSON.stringify(record)]
 );
}
try{
 const result=await transaction(async db=>{
  const conn=await db.query('SELECT current_database() AS name');
  if(local&&conn.rows[0].name!=='wordsky_v6_test')throw Error('Sai database local.');
  const col=await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ws_words' AND column_name IN ('cefr_level','cefr_review_status')");
  if(col.rows.length!==2)throw Error('Can migrate CEFR truoc khi import.');
  const found=await db.query('SELECT id,title,enabled FROM ws_topics WHERE title=ANY($1::text[]) FOR SHARE',[Object.keys(originalTopics)]);
  if(found.rows.length!==topicNames.size||found.rows.some(x=>!x.enabled))throw Error('26 chu de goc chua day du/da bi an. Khong duoc tu tao chu de.');
  const map=new Map(found.rows.map(r=>[r.title,r.id]));
  let inserted=0,updated=0,skipped=0;
  for(const w of approved){
    const topicId=map.get(w.topic),english=text(w.english);
    // Even a metadata-only approval must not alter vocabulary backing OPEN/LIVE games.
    const active=await db.query(`SELECT e.id FROM ws_events e JOIN ws_rounds r ON r.event_id=e.id
      WHERE (r.topic_id=$1 OR (r.mode='CAR' AND r.topic_id IS NULL))
        AND e.status IN ('OPEN','LIVE') FOR SHARE OF e`,[topicId]);
    if(active.rows.length)throw Error('Dang co giai OPEN/LIVE su dung chu de '+w.topic+'; hay ket thuc giai truoc khi nhap.');
    const matches=await db.query(`SELECT id,meaning,cefr_level,cefr_review_status,enabled
       FROM ws_words WHERE topic_id=$1 AND lower(english)=lower($2) FOR UPDATE`,[topicId,english]);
    if(matches.rows.length>1)throw Error('Trung tu khong phan biet chu hoa: '+w.topic+' / '+english);
    const action=decideCefrImport(matches.rows[0],w);
    if(action==='skip'){
      const alreadyAudited=await db.query(`SELECT 1 FROM ws_audit WHERE entity_id=$1 AND action='word_cefr_review'
        AND payload->>'importer'='scripts/import-cefr-approved.js'
        AND payload->>'source_url'=$2 LIMIT 1`,[String(matches.rows[0].id),text(w.source_url)]);
      if(!alreadyAudited.rows.length)await writeCefrImportAudit(db,matches.rows[0].id,w,'reconfirm',matches.rows[0]);
      skipped++;continue;
    }
    if(action==='update'){
      const changed=await db.query(`UPDATE ws_words SET cefr_level=$1,cefr_review_status='APPROVED'
         WHERE id=$2 AND cefr_review_status IN ('UNREVIEWED','PROVISIONAL') RETURNING id`,[w.level,matches.rows[0].id]);
      if(changed.rows.length!==1)throw Error('CEFR update lost its row lock / expected row.');
      await writeCefrImportAudit(db,changed.rows[0].id,w,'update',matches.rows[0]);
      updated++;continue;
    }
    const q=await db.query(`INSERT INTO ws_words(topic_id,english,meaning,ipa,example,translation,cefr_level,cefr_review_status)
      VALUES($1,$2,$3,$4,$5,$6,$7,'APPROVED')
      ON CONFLICT(topic_id,english) DO NOTHING RETURNING id`,
      [topicId,english,text(w.meaning),text(w.ipa),text(w.example),text(w.translation),w.level]);
    if(!q.rows.length)throw Error('Tu bi tranh chap ghi dong thoi: '+w.topic+'/'+english+'; thu lai an toan.');
    await writeCefrImportAudit(db,q.rows[0].id,w,'insert');
    inserted++;
  }
  return {database:conn.rows[0].name,inserted,updated,skipped,topicCount:found.rows.length};
 });
 console.log('IMPORT COMPLETE',JSON.stringify(result));
}finally{await getPool().end()}
