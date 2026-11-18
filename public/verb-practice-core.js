// UX48: deterministic quiz checks; pure and independent of user progress and SRS.
import {listVerbEntries} from './verb-dictionary.js';
import {getApprovedVerbCefrLevel,VERB_CEFR_LEVELS} from './verb-cefr-sense-review.js';
export const QUIZ_LENGTH=10;
export const PAGE_SIZE=20;
export function paginateVerbs(entries,page,size=PAGE_SIZE){
 const pages=Math.max(1,Math.ceil(entries.length/size));
 const current=Math.min(pages,Math.max(1,Math.floor(Number(page)||1)));
 return {page:current,pages,items:entries.slice((current-1)*size,current*size),total:entries.length};
}
export function acceptedVerbForms(value){
 return String(value||'').toLowerCase().split('/').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);
}
export function isVerbAnswerCorrect(answer,target){
 const normalized=String(answer||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
 return acceptedVerbForms(target).includes(normalized);
}
export function createVerbQuiz({kind='all',cefrLevel=null,count=QUIZ_LENGTH,random=Math.random}={}){
 // UX53B: requested level is NEVER fulfilled from headword-only evidence.
 // Invalid or unapproved levels fail closed; legacy unfiltered practice is unchanged.
 const levelRequested=cefrLevel!==null&&cefrLevel!==undefined;
 if(levelRequested&&!VERB_CEFR_LEVELS.includes(cefrLevel))return [];
 const pool=listVerbEntries().filter(v=>(kind==='all'||v.kind===kind)&&
  (!levelRequested||getApprovedVerbCefrLevel(v.v1,v.meaning)===cefrLevel));
 const shuffled=[...pool];
 for(let i=shuffled.length-1;i>0;i--){
  const j=Math.floor(Math.min(.999999,Math.max(0,random()))*(i+1));
  [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
 }
 return shuffled.slice(0,Math.min(count,shuffled.length)).map((v,i)=>({
  index:i+1,v1:v.v1,v2:v.v2,v3:v.v3,meaning:v.meaning,
  target:['v1','v2','v3'][i%3]
 }));
}
