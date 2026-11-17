// SOCIAL-105B: transactional import core. Caller owns BEGIN/COMMIT/ROLLBACK.
// Never creates topics; only pre-reviewed, learning-only phrase cards.
import {norm} from './social1000-import-policy.js';
export async function insertReviewedSocialBatch(db,plan){
 if(!plan||plan.total!==100||plan.pending?.length!==0||plan.eligible?.length!==100||!plan.topic)
  throw Error('Import requires a fully reviewed 100-item batch');
 const topics=await db.query('SELECT id FROM ws_topics WHERE title=$1 AND enabled=true FOR SHARE',[plan.topic]);
 if(topics.rows.length!==1)throw Error('Existing enabled topic missing: '+plan.topic);
 const topicId=topics.rows[0].id;
 // Serializes imports that share the same enabled topic; must run inside a transaction.
 await db.query('SELECT id FROM ws_topics WHERE id=$1 FOR UPDATE',[topicId]);
 const existing=await db.query('SELECT id,english,meaning,topic_id,learning_only,example,translation,cefr_level,cefr_review_status,ipa FROM ws_words WHERE enabled=true FOR UPDATE');
 const english=new Map(),vietnamese=new Map();
 for(const r of existing.rows){
  const key=norm(r.english),cue=norm(r.meaning);
  if(!english.has(key))english.set(key,[]);
  english.get(key).push(r);
  if(!vietnamese.has(cue))vietnamese.set(cue,[]);
  vietnamese.get(cue).push(r);
 }
 let inserted=0,skipped=0;
 for(const r of plan.eligible){
  const e=norm(r.english),v=norm(r.meaning);
  const prior=english.get(e)||[];
  if(prior.length){
   if(prior.length!==1)throw Error('Ambiguous existing English: '+r.item_id);
   const same=prior[0];
   if(same.topic_id===topicId&&same.learning_only===true&&norm(same.meaning)===v&&
      same.example===r.example&&same.translation===r.translation&&same.cefr_level===r.level&&
      same.cefr_review_status==='PROVISIONAL'&&same.ipa===''){
     skipped++;continue;
   }
   throw Error('Existing English collision or changed payload: '+r.item_id);
  }
  if(vietnamese.has(v))throw Error('Existing Vietnamese cue collision: '+r.item_id);
  const result=await db.query(
   "INSERT INTO ws_words(topic_id,english,meaning,ipa,example,translation,cefr_level,cefr_review_status,learning_only,enabled) VALUES($1,$2,$3,'',$4,$5,$6,'PROVISIONAL',true,true) RETURNING id",
   [topicId,r.english,r.meaning,r.example,r.translation,r.level]);
  const newRow={id:result.rows[0].id,topic_id:topicId,english:r.english,meaning:r.meaning,
   example:r.example,translation:r.translation,cefr_level:r.level,cefr_review_status:'PROVISIONAL',
   ipa:'',learning_only:true};
  english.set(e,[newRow]);vietnamese.set(v,[newRow]);inserted++;
 }
 return {batch:plan.batch_id,inserted,skipped,topic:plan.topic};
}
