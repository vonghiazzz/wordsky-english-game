// LIFE-07 alternative-answer review QA. Offline, read-only, not player grading.
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const review=read('vocab/editorial/LIFE-07-answer-ambiguity-review.json');
const draft=read('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const fail=m=>{throw new Error('LIFE-07 alternatives: '+m)};
if(review.batch_id!=='LIFE-07'||review.status!=='ANSWER_AMBIGUITY_REVIEW_ONLY'||
   review.records?.length!==100||draft.records?.length!==100)fail('stage guard');
const summary={HIGH:0,MEDIUM:0,LOW:0};let proposed=0;
for(let i=0;i<100;i++){
 const r=review.records[i],d=draft.records[i];
 if(r.english!==d.english||r.meaning!==d.meaning||r.group_id!==d.group_id)
  fail('inventory drift '+i);
 if(!Object.hasOwn(summary,r.risk))fail('invalid risk '+i);
 summary[r.risk]++;
 if(r.grading_mode!=='NOT_AUTHORIZED'||r.review_status!=='PENDING_BILINGUAL_REVIEW'||
    !Array.isArray(r.accepted_answers_approved)||r.accepted_answers_approved.length)
  fail('premature accepted answer authorization '+i);
 if(!Array.isArray(r.proposed_variants_for_review))fail('missing review variants '+i);
 const variants=new Set();
 for(const value of r.proposed_variants_for_review){
  if(typeof value!=='string'||!value.trim()||variants.has(value.trim().toLowerCase())||
     value.trim().toLowerCase()===r.english.toLowerCase())fail('bad proposed variant '+i);
  variants.add(value.trim().toLowerCase());
 }
 if(variants.size)proposed++;
}
if(summary.HIGH!==12||summary.MEDIUM!==38||summary.LOW!==50||proposed!==43)
 fail('risk counts changed without QA decision');
console.log(JSON.stringify({status:'PASS_REVIEW_METADATA_ONLY',
 total:100,risk:summary,items_with_proposed_variants:proposed,
 authorized_accepted_answers:0,grading_changes:0,editorial_approval:false,
 production_changes:false},null,2));
