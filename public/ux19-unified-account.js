/* UX-19: one authoritative My Learning result per signed-in WordSky user.
 * The UI never derives signed-in totals from device storage or cached catalogs. */
const validSource=new Set(['shared','personal']);
export function buildUnifiedAccountView(result,expectedActorId) {
 if(!result||result.scope!=='unified-account'||result.actor_id!==expectedActorId||
    !Array.isArray(result.words)||!result.summary||
    result.words.length>10000)throw Error('Dữ liệu My Learning theo tài khoản không hợp lệ.');
 const words=[],learned={},ids=new Set();
 const perSource={shared:{total:0,known:0,reviewed:0},personal:{total:0,known:0,reviewed:0}};
 for(const item of result.words){
  if(!item||!validSource.has(item.source)||typeof item.id!=='string'||
     typeof item.topic!=='string'||typeof item.english!=='string'||
     ['ipa','meaning','example','translation'].some(field=>typeof item[field]!=='string')||
     typeof item.remembered!=='boolean'||typeof item.reviewed!=='boolean'||
     item.remembered&&!item.reviewed)throw Error('Có thẻ không hợp lệ trong My Learning.');
  const key=item.source+':'+item.id;
  if(ids.has(key))throw Error('My Learning chứa ID bị lặp.');
  ids.add(key);
  const part=perSource[item.source];part.total++;
  if(item.remembered)part.known++;
  if(item.reviewed)part.reviewed++;
  const word={key,source:item.source,word_id:item.source==='shared'?item.id:undefined,
   personal_word_id:item.source==='personal'?item.id:undefined,
   topic:item.topic,english:item.english,ipa:item.ipa,meaning:item.meaning,
   example:item.example,translation:item.translation,reviewed:item.reviewed};
  if(item.remembered)learned[key]=true;
  words.push(word);
 }
 const all={total:words.length,
   known:perSource.shared.known+perSource.personal.known,
   reviewed:perSource.shared.reviewed+perSource.personal.reviewed};
 const assertions=[['total',all.total],['known',all.known],['reviewed',all.reviewed],
  ['review',all.total-all.known]];
 for(const [key,value] of assertions)if(result.summary[key]!==value)
   throw Error('Thống kê My Learning không nhất quán.');
 for(const source of ['shared','personal']){
  const summary=result.summary[source],part=perSource[source];
  if(!summary||summary.total!==part.total||summary.known!==part.known||
     summary.reviewed!==part.reviewed||summary.review!==part.total-part.known)
    throw Error('Thống kê từ vựng không nhất quán.');
 }
 return {source:'unified',words,learned,initialized:true,error:null,
   summary:result.summary};
}
