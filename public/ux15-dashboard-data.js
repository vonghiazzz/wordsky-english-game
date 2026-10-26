/* UX-15: Browser-visible server vocabulary is separate from account progress
 * and from the legacy personal Flashcard deck. No implicit migration. */
import {parseServerCatalog, readCachedServerCatalog, saveCachedServerCatalog} from './ux13-vocab-sync.js';
export const SERVER_PROGRESS_KEY='wordsky_server_learned_v1';
export const SOURCE_PREFERENCE_KEY='wordsky_flashcard_source_v1';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const safeObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function parseServerProgress(raw) {
  if(raw===null)return {learned:{},error:null};
  try{
    const parsed=JSON.parse(raw);
    if(!safeObject(parsed) || Object.keys(parsed).length>10000 ||
       Object.entries(parsed).some(([key,value])=>!uuid.test(key)||value!==true))
      throw Error('Invalid UUID progress');
    return {learned:parsed,error:null};
  }catch{
    return {learned:{},error:'Trạng thái ghi nhớ kho máy chủ không hợp lệ. Dữ liệu cũ được giữ nguyên, chưa cho phép ghi đè.'};
  }
}
export function serverCatalogView(parsed,progress){
  if(!parsed||!Array.isArray(parsed.words))return null;
  const words=parsed.words.map(({word_id,topic,card})=>({
    key:'server:'+word_id,word_id,topic,english:card[0],ipa:card[1],meaning:card[2],
    example:card[3],translation:card[4]
  }));
  const learned={};
  for(const word of words)if(progress.learned[word.word_id]===true)learned[word.key]=true;
  return {source:'server',words,learned,initialized:true,error:progress.error};
}
export function saveServerProgress(storage,wordId,remembered){
  if(!uuid.test(wordId))throw Error('UUID từ không hợp lệ');
  const progress=parseServerProgress(storage.getItem(SERVER_PROGRESS_KEY));
  if(progress.error)throw Error(progress.error);
  const next={...progress.learned};
  if(remembered)next[wordId]=true;
  else delete next[wordId];
  storage.setItem(SERVER_PROGRESS_KEY,JSON.stringify(next));
  return next;
}
export function loadCachedCatalog(storage,now=Date.now()){
  return readCachedServerCatalog(storage,now);
}
export function validateAndCacheCatalog(storage,payload,now=Date.now()){
  const parsed=parseServerCatalog(payload);
  saveCachedServerCatalog(storage,payload,now); // optional; a blocked cache must not block online learning
  return parsed;
}
export function lastPersonalSelection(storage) {
  try{return storage.getItem(SOURCE_PREFERENCE_KEY)==='local'}catch{return false}
}
