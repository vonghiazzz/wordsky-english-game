// SOCIAL-105 — pure release candidate validation. No database, no approval mutation.
import {createHash} from 'node:crypto';
export const SOCIAL_BATCH_IDS=Array.from({length:10},(_,i)=>'SOCIAL-'+String(i+1).padStart(2,'0'));
export const SOCIAL_TOPICS=[
 'Everyday Conversation - Giao tiếp hằng ngày','Social Relationships - Quan hệ xã hội',
 'Home - Nhà cửa','Shopping - Mua sắm','Restaurant - Nhà hàng',
 'Jobs - Nghề nghiệp','Feelings - Cảm xúc','Travel - Du lịch',
 'Technology - Công nghệ','Daily Life'
];
export const SOCIAL_HEADER=['item_id','batch_id','topic','english','meaning_vi','example_en','translation_vi','proposed_cefr','cefr_review_status','ipa_status','bilingual_review','sense_review','reviewer','reviewed_at','review_notes'];
export const norm=s=>String(s??'').normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[’]/gu,"'").replace(/[?!.,]+$/gu,'').replace(/\s+/gu,' ');
export const hashCard=r=>createHash('sha256').update(JSON.stringify([r.topic,norm(r.english),norm(r.meaning),r.example,r.translation,r.level])).digest('hex');
export function parseReviewCsv(input){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(ch==='"'){
   if(quoted&&input[i+1]==='"'){field+='"';i++} else quoted=!quoted;
  }else if(ch===','&&!quoted){row.push(field);field='';}
  else if(ch==='\n'&&!quoted){row.push(field);rows.push(row);row=[];field='';}
  else if(ch!=='\r'){field+=ch;}
 }
 if(quoted)throw Error('Unterminated editorial CSV');
 if(row.length||field.length){row.push(field);rows.push(row);}
 const header=rows.shift();
 if(JSON.stringify(header)!==JSON.stringify(SOCIAL_HEADER))throw Error('Unexpected editorial CSV headers');
 return rows.filter(row=>row.length>1).map((row,i)=>{
  if(row.length!==SOCIAL_HEADER.length)throw Error('Invalid CSV column count at '+(i+2));
  return Object.fromEntries(SOCIAL_HEADER.map((key,j)=>[key,row[j]]));
 });
}
export function planSocialBatch(batch,reviewRows,{requireEditorial=true}={}){
 if(!batch||!SOCIAL_BATCH_IDS.includes(batch.batch_id)||batch.status!=='DRAFT'||batch.records?.length!==100)
  throw Error('Invalid 100-card SOCIAL batch');
 const batchIndex=SOCIAL_BATCH_IDS.indexOf(batch.batch_id),topic=SOCIAL_TOPICS[batchIndex];
 const table=new Map(reviewRows.map(row=>[row.item_id,row]));
 const seenEnglish=new Set(),seenVi=new Set(),eligible=[],pending=[];
 for(let i=0;i<batch.records.length;i++){
  const r=batch.records[i],id=batch.batch_id+'-'+String(i+1).padStart(3,'0'),q=table.get(id);
  if(!q)throw Error('Missing editorial row: '+id);
  if(r.topic!==topic||q.batch_id!==batch.batch_id||q.topic!==topic)throw Error('Topic mismatch: '+id);
  if(!r.english?.trim()||!r.meaning?.trim()||!r.example?.trim()||!r.translation?.trim()||r.ipa!=='')
   throw Error('Incomplete or invalid phrase: '+id);
  if(r.review_status!=='PROVISIONAL'||!['A1','A2','B1','B2','C1','C2'].includes(r.level))
   throw Error('Invalid candidate learning level/status: '+id);
  if([q.english,q.meaning_vi,q.example_en,q.translation_vi,q.proposed_cefr].some((s,j)=>s!==[r.english,r.meaning,r.example,r.translation,r.level][j]))
   throw Error('Editorial/source data mismatch: '+id);
  if(seenEnglish.has(norm(r.english))||seenVi.has(norm(r.meaning)))throw Error('Duplicate within batch: '+id);
  seenEnglish.add(norm(r.english));seenVi.add(norm(r.meaning));
  const reviewed=['cefr_review_status','bilingual_review','sense_review'].every(k=>q[k]==='APPROVED');
  const provenance=q.reviewer.trim()&&/^\d{4}-\d{2}-\d{2}T/.test(q.reviewed_at)&&!Number.isNaN(Date.parse(q.reviewed_at))&&q.review_notes.trim();
  if(reviewed&&provenance)eligible.push({...r,item_id:id,content_sha256:hashCard(r),editorial_reviewer:q.reviewer,editorial_reviewed_at:q.reviewed_at,editorial_review_notes:q.review_notes});
  else pending.push(id);
 }
 if(requireEditorial&&pending.length)throw Error('Editorial gate BLOCKED: '+pending.length+' pending items in '+batch.batch_id);
 return {batch_id:batch.batch_id,topic,total:100,eligible,pending};
}
