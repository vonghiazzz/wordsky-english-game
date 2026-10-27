import {exactFingerprint} from './ux10-account-core.js';

const identity=card=>card.topic.normalize('NFC').trim().toLocaleLowerCase('en')+
 '\u0000'+card.english.normalize('NFC').trim().toLocaleLowerCase('en');
const validCard=word=>word&&typeof word==='object'&&
 [['topic',80,true],['english',80,true],['ipa',120,false],
  ['meaning',180,true],['example',500,false],['translation',500,false]]
 .every(([field,max,required])=>typeof word[field]==='string'&&
  word[field].length<=max&&(!required||word[field].trim().length>0));

export function planThreeWayLegacyImport(snapshot,account){
 if(snapshot?.error)return {error:snapshot.error,entries:[]};
 if(!Array.isArray(snapshot?.words)||!account||account.scope!=='unified-account'||
    !Array.isArray(account.words)||typeof account.actor_id!=='string')
  return {error:'Chưa xác minh đủ hai kho từ theo tài khoản. Không chuyển dữ liệu.',entries:[]};
 const candidates=new Map(),bySpelling=new Map();
 for(const word of account.words){
  if(!validCard(word)||!['shared','personal'].includes(word.source)||
     typeof word.id!=='string'||typeof word.reviewed!=='boolean')
    return {error:'Kho từ từ máy chủ không hợp lệ. Không chuyển dữ liệu.',entries:[]};
  const k=identity(word);
  if(!candidates.has(k))candidates.set(k,[]);
  candidates.get(k).push(word);
  const spelling=word.english.normalize('NFC').trim().toLocaleLowerCase('en');
  bySpelling.set(spelling,(bySpelling.get(spelling)||0)+1);
 }
 const entries=[],counts={
  shared:0,personal:0,newCards:0,reviewable:0,alreadyReviewed:0,
  conflicts:0,ambiguous:0,invalid:0,unchanged:0
 };
 for(const word of snapshot.words){
  if(!validCard(word)||typeof word.known!=='boolean'){
   counts.invalid++;continue;
  }
  const matches=candidates.get(identity(word))||[];
  if(matches.length>1){counts.ambiguous++;continue;}
  if(!matches.length){
   if(bySpelling.has(word.english.normalize('NFC').trim().toLocaleLowerCase('en'))){
    counts.conflicts++;continue;
   }
   entries.push({type:'create',word});
   counts.newCards++;continue;
  }
  const existing=matches[0];
  if(exactFingerprint(word)!==exactFingerprint(existing)){
   counts.conflicts++;continue;
  }
  counts[existing.source]++;
  if(word.known){
   if(existing.reviewed){counts.alreadyReviewed++;continue;}
   entries.push({type:existing.source==='shared'?'remember-shared':'remember-personal',
    word,id:existing.id,source:existing.source});
   counts.reviewable++;
  }else counts.unchanged++;
 }
 return {error:null,entries,counts};
}
