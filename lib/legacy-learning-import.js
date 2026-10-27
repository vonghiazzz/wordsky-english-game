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
 if(candidates.length>1)return {status:'ambiguous',source:null,id:null};
 if(!candidates.length)return {status:'new',source:'personal',id:null};
 const only=candidates[0];
 return fingerprint(card)===fingerprint(only.word)
  ? {status:'matched',source:only.source,id:only.id}
  : {status:'conflict',source:only.source,id:null};
}

export async function importLegacyFlashcard(userId,payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    typeof payload.known!=='boolean')
   throw fail('Dữ liệu chuyển Flashcard cũ không hợp lệ',400);
 const card=normalizePersonalCard(payload.card);
 return transaction(async db=>{
  // Serializes imports on one account without locking other users.
  const owner=await db.query('SELECT id FROM ws_users WHERE id=$1 FOR UPDATE',[userId]);
  if(!owner.rows.length)throw fail('Tài khoản không tồn tại',401);
  const shared=await db.query(
   'SELECT w.id,t.title AS topic,w.english,w.ipa,w.meaning,w.example,w.translation '+
   'FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id '+
   'WHERE w.enabled=true AND t.enabled=true '+
   'AND lower(t.title)=lower($1) AND lower(w.english)=lower($2) '+
   'ORDER BY w.id LIMIT 3',[card.topic,card.english]);
  const personal=await db.query(
   'SELECT id,topic,english,ipa,meaning,example,translation '+
   'FROM ws_personal_cards WHERE user_id=$1 AND deleted_at IS NULL '+
   'AND lower(topic)=lower($2) AND lower(english)=lower($3) '+
   'ORDER BY id LIMIT 3',[userId,card.topic,card.english]);
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
 });
}
