import {transaction} from './db.js';
import {fail} from './game.js';
import {normalizePersonalCard} from './personal-vocabulary.js';

// The client presents a preview, but the DB transaction rechecks identity.
const clean=value=>typeof value==='string'?value.normalize('NFC').trim():'';
const fingerprint=card=>JSON.stringify([
 clean(card.topic),clean(card.english).toLocaleLowerCase('en'),
 clean(card.ipa),clean(card.meaning),clean(card.example),clean(card.translation)
]);

export function classifyLegacyMatch(card,shared,personal){
 const candidates=[
  ...shared.map(word=>({source:'shared',id:word.id,word})),
  ...personal.map(word=>({source:'personal',id:word.id,word}))
 ];
 // Exact topic+English takes priority. A same English spelling in another
 // topic without an exact-identity match is held for manual review, not copied.
 const identity=word=>clean(word.topic).toLocaleLowerCase('en')+'\u0000'+
   clean(word.english).toLocaleLowerCase('en');
 const matched=candidates.filter(hit=>identity(hit.word)===identity(card));
 if(matched.length>1)return {status:'ambiguous',source:null,id:null};
 if(!matched.length&&candidates.length)return {status:'conflict',source:null,id:null};
 if(!matched.length)return {status:'new',source:'personal',id:null};
 const only=matched[0];
 return fingerprint(card)===fingerprint(only.word)
  ? {status:'matched',source:only.source,id:only.id}
  : {status:'conflict',source:only.source,id:null};
}

async function importLegacyCard(db,userId,payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    typeof payload.known!=='boolean')
   throw fail('Dữ liệu chuyển Flashcard cũ không hợp lệ',400);
 const card=normalizePersonalCard(payload.card);
  const shared=await db.query(
   'SELECT w.id,t.title AS topic,w.english,w.ipa,w.meaning,w.example,w.translation '+
   'FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id '+
   'WHERE w.enabled=true AND t.enabled=true '+
   'AND lower(w.english)=lower($1) '+
   'ORDER BY w.id LIMIT 20',[card.english]);
  const personal=await db.query(
   'SELECT id,topic,english,ipa,meaning,example,translation '+
   'FROM ws_personal_cards WHERE user_id=$1 AND deleted_at IS NULL '+
   'AND lower(english)=lower($2) '+
   'ORDER BY id LIMIT 20',[userId,card.english]);
  let result=classifyLegacyMatch(card,shared.rows,personal.rows);
  if(result.status==='conflict'||result.status==='ambiguous')
    return {scope:'legacy-import',status:result.status,source:result.source,reviewed:false};
  let created=false;
  if(result.status==='new'){
    const count=await db.query(
     'SELECT count(*)::int AS total FROM ws_personal_cards WHERE user_id=$1 AND deleted_at IS NULL',
     [userId]);
    if(count.rows[0].total>=5000)throw fail('Kho từ cá nhân đã đạt 5000 thẻ',409);
    const inserted=await db.query(
     'INSERT INTO ws_personal_cards(user_id,topic,english,ipa,meaning,example,translation) '+
     'VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
     [userId,card.topic,card.english,card.ipa,card.meaning,card.example,card.translation]);
    result={source:'personal',id:inserted.rows[0].id};
    created=true;
  }
  // Never overwrite an existing decision, including remembered=false.
  // Conditional INSERT makes retries and concurrent reviews safe.
  let reviewed=false;
  if(payload.known){
    const table=result.source==='shared'
     ?'ws_learning_word_progress':'ws_personal_card_progress';
    const wordCol=result.source==='shared'?'word_id':'personal_word_id';
    const progress=await db.query(
     'INSERT INTO '+table+'(user_id,'+wordCol+',remembered,review_count,last_reviewed_at) '+
     'VALUES($1,$2,true,1,now()) ON CONFLICT(user_id,'+wordCol+') DO NOTHING '+
     'RETURNING '+wordCol,[userId,result.id]);
    if(progress.rows.length){
      const reviews=result.source==='shared'
       ?'ws_learning_flashcard_reviews':'ws_personal_card_reviews';
      await db.query(
       'INSERT INTO '+reviews+'(user_id,'+wordCol+',remembered) VALUES($1,$2,true)',
       [userId,result.id]);
      reviewed=true;
    }
  }
  return {scope:'legacy-import',status:created?'created':reviewed?'reviewed':
    payload.known?'already-reviewed':'already-present',
    source:result.source,word_id:result.id,reviewed};
}

async function lockImportActor(db,userId){
 // Serialize imports for the same player; accounts cannot access each other's cards.
 const owner=await db.query('SELECT id FROM ws_users WHERE id=$1 FOR UPDATE',[userId]);
 if(!owner.rows.length)throw fail('Tài khoản không tồn tại',401);
}

export async function importLegacyFlashcard(userId,payload){
 return transaction(async db=>{
  await lockImportActor(db,userId);
  return importLegacyCard(db,userId,payload);
 });
}

// An atomic DB transaction for each 20-card chunk. Clients confirm only once,
// then automatically send bounded chunks; a failed chunk leaves no partial writes.
export const LEGACY_BATCH_SIZE=20;
export async function importLegacyBatch(userId,payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    !Array.isArray(payload.cards)||payload.cards.length<1||
    payload.cards.length>LEGACY_BATCH_SIZE)
   throw fail('Mỗi lô chuyển phải có từ 1 đến 20 thẻ',400);
 // All payloads are validated before the first DB write.
 const cards=payload.cards.map(entry=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||
     typeof entry.known!=='boolean')
    throw fail('Dữ liệu chuyển thẻ không hợp lệ',400);
  return {card:normalizePersonalCard(entry.card),known:entry.known};
 });
 return transaction(async db=>{
  await lockImportActor(db,userId);
  const counts={created:0,reviewed:0,alreadyReviewed:0,
    alreadyPresent:0,conflict:0,ambiguous:0};
  for(const card of cards){
   const item=await importLegacyCard(db,userId,card);
   if(item.scope!=='legacy-import')throw fail('Chuyển dữ liệu chưa được xác nhận',500);
   if(item.status==='created')counts.created++;
   else if(item.status==='already-reviewed')counts.alreadyReviewed++;
   else if(item.status==='already-present')counts.alreadyPresent++;
   else if(item.status==='conflict')counts.conflict++;
   else if(item.status==='ambiguous')counts.ambiguous++;
   else if(item.status==='reviewed'){} // counted below
   else throw fail('Trạng thái chuyển từ không hợp lệ',500);
   if(item.reviewed===true)counts.reviewed++;
  }
  return {scope:'legacy-import-batch',processed:cards.length,counts};
 });
}
