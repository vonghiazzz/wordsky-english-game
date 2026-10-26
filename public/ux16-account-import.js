/* UX-16: Explicit, lossless migration of UUID-keyed browser server-library
 * marks to WordSky's authenticated account progress.
 * Both catalogs must agree on UUID AND all six word fields, and existing
 * account decisions (including remembered:false) are never overwritten. */
import {exactFingerprint} from './ux10-account-core.js';

export function eligibleServerImports(serverCatalog, serverProgress, accountCatalog, accountWords) {
  if (serverProgress?.error) return {eligible:[],unmatched:0,alreadyReviewed:0,error:serverProgress.error};
  const remembered=serverProgress?.learned;
  if (!remembered || typeof remembered !== 'object' || Array.isArray(remembered)) {
    return {eligible:[],unmatched:0,alreadyReviewed:0,error:'Không thể đọc tiến độ kho máy chủ.'};
  }
  const reviewed=new Set((Array.isArray(accountWords)?accountWords:[]).map(row=>row.word_id));
  const accountById=new Map((Array.isArray(accountCatalog)?accountCatalog:[])
    .filter(row=>typeof row?.word_id==='string').map(row=>[row.word_id,row]));
  const localById=new Map((Array.isArray(serverCatalog?.words)?serverCatalog.words:[])
    .filter(row=>typeof row?.word_id==='string').map(row=>[row.word_id,row]));
  const eligible=[];
  let unmatched=0,alreadyReviewed=0;
  for(const [id,known] of Object.entries(remembered)) {
    if(known!==true)continue;
    const local=localById.get(id),account=accountById.get(id);
    // Never trust a UUID from stale storage or another Supabase project alone.
    if(!local||!account){
      unmatched++;
      continue;
    }
    const card=local.card;
    if(!Array.isArray(card)||card.length!==5||card.some(x=>typeof x!=='string')){
      unmatched++;
      continue;
    }
    const serverRow={topic:local.topic,english:card[0],ipa:card[1],
      meaning:card[2],example:card[3],translation:card[4]};
    if(exactFingerprint(serverRow)!==exactFingerprint(account)){
      unmatched++;
      continue;
    }
    if(reviewed.has(id)){
      alreadyReviewed++;
      continue;
    }
    eligible.push({word_id:id,english:card[0],remembered:true});
  }
  return {eligible,unmatched,alreadyReviewed,error:null};
}
