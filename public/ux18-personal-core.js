import {exactFingerprint} from './ux10-account-core.js';
const clean=value=>typeof value==='string'?value.trim():'';
const key=(topic,english)=>clean(topic).toLocaleLowerCase('en')+'\u0000'+clean(english).toLocaleLowerCase('en');
export function readBrowserPersonal(storage){
  const original=storage.getItem('wordsky_vocab_v2');
  if(original===null)return {words:[],learned:{},error:null};
  try{
    if(original.length>2_000_000)throw Error('Bộ từ quá lớn');
    const data=JSON.parse(original),topics=data.topics||data;
    if(!topics||typeof topics!=='object'||Array.isArray(topics))throw Error('Chủ đề không hợp lệ');
    const learnedRaw=storage.getItem('wordsky_learned')||'{}';
    if(learnedRaw.length>1_000_000)throw Error('Lịch sử quá lớn');
    const learned=JSON.parse(learnedRaw);
    if(!learned||typeof learned!=='object'||Array.isArray(learned))throw Error('Tiến độ không hợp lệ');
    const words=[],seen=new Set();
    for(const [topic,rows] of Object.entries(topics)){
      if(typeof topic!=='string'||!topic.trim()||topic.length>80||!Array.isArray(rows))throw Error('Chủ đề không hợp lệ');
      for(const row of rows){
        if(!Array.isArray(row)||row.length!==5||row.some(x=>typeof x!=='string'))throw Error('Thẻ không hợp lệ');
        const identity=key(topic,row[0]);
        if(seen.has(identity))throw Error('Từ trùng lặp trong bộ cá nhân');
        seen.add(identity);
        words.push({topic,english:row[0],ipa:row[1],meaning:row[2],example:row[3],translation:row[4],
          known:learned[topic+':'+row[0].toLowerCase()]===true});
        if(words.length>5000)throw Error('Bộ cá nhân vượt giới hạn 5000 từ');
      }
    }
    return {words,learned,error:null};
  }catch(e){return {words:[],learned:{},error:'Dữ liệu Flashcard trên thiết bị không hợp lệ: '+e.message+'. Không tự ghi đè dữ liệu.'}}
}
export function planBrowserPersonalImport(snapshot,serverWords,serverProgress){
 if(snapshot.error)return {entries:[],conflicts:0,existing:0,error:snapshot.error};
 const byName=new Map();
 for(const word of serverWords||[])byName.set(key(word.topic,word.english),word);
 const reviewed=new Set((serverProgress||[]).map(w=>w.personal_word_id));
 const entries=[];let conflicts=0,existing=0;
 for(const word of snapshot.words){
  const account=byName.get(key(word.topic,word.english));
  if(!account){entries.push({type:'create',word});continue}
  if(exactFingerprint(word)!==exactFingerprint(account)){conflicts++;continue}
  existing++;
  if(word.known&&!reviewed.has(account.id))entries.push({type:'remember',word,id:account.id});
 }
 return {entries,conflicts,existing,error:null};
}
