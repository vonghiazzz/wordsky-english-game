import {sql,transaction} from './db.js';
import {fail} from './game.js';
import {validatePersonalBatch,validatePersonalUpdate} from './personal-vocabulary-core.js';

function validated(fn,data) {
  try{return fn(data)}catch(e){throw fail(e.message,400)}
}
export async function listPersonalVocabulary(userId) {
  const {rows}=await sql('SELECT id,topic,english,ipa,meaning,example,translation,remembered,version,updated_at FROM public.ws_user_vocabulary WHERE user_id=$1 ORDER BY topic,english,id LIMIT 5001',[userId]);
  if(rows.length>5000)throw fail('Kho từ cá nhân vượt giới hạn 5000 từ',503);
  return {scope:'personal-account',cards:rows};
}
// All-or-nothing per batch. Idempotent import, never overwrites an existing
// user cloud edit (even remembered:false).
export async function importPersonalVocabulary(userId,payload) {
  const cards=validated(validatePersonalBatch,payload);
  return transaction(async db=>{
    const total=await db.query('SELECT count(*)::int AS total FROM public.ws_user_vocabulary WHERE user_id=$1',[userId]);
    if(Number(total.rows[0].total)+cards.length>5000)throw fail('Kho từ cá nhân tối đa 5000 từ',409);
    let inserted=0;
    for(const item of cards){
      const result=await db.query(
        'INSERT INTO public.ws_user_vocabulary (user_id,import_key,topic,english,ipa,meaning,example,translation,remembered) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,import_key) DO NOTHING RETURNING id',
        [userId,item.import_key,item.topic,item.english,item.ipa,item.meaning,item.example,item.translation,item.remembered]);
      inserted+=result.rowCount;
    }
    return {scope:'personal-account',inserted,already_existing:cards.length-inserted};
  });
}
export async function updatePersonalVocabulary(userId,cardId,payload) {
  const {card,expected_version}=validated(validatePersonalUpdate,payload);
  const result=await sql(
    'UPDATE public.ws_user_vocabulary SET topic=$3,english=$4,ipa=$5,meaning=$6,example=$7,translation=$8,remembered=$9,version=version+1,updated_at=now() WHERE user_id=$1 AND id=$2 AND version=$10 RETURNING id,topic,english,ipa,meaning,example,translation,remembered,version,updated_at',
    [userId,cardId,card.topic,card.english,card.ipa,card.meaning,card.example,card.translation,card.remembered,expected_version]
  );
  if(result.rows.length)return {scope:'personal-account',card:result.rows[0]};
  const existing=await sql('SELECT 1 FROM public.ws_user_vocabulary WHERE user_id=$1 AND id=$2',[userId,cardId]);
  throw fail(existing.rows.length?'Dữ liệu đã thay đổi ở thiết bị khác; hãy tải lại.':'Không tìm thấy thẻ từ cá nhân',existing.rows.length?409:404);
}
