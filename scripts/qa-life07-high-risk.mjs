// Read-only high-risk reviewer checklist gate, no gameplay mutation.
import {readFileSync} from 'node:fs';
const load=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const review=load('vocab/editorial/LIFE-07-high-risk-review-decisions.json');
const source=load('vocab/editorial/LIFE-07-answer-ambiguity-review.json');
const fail=x=>{throw Error('LIFE07 high-risk QA: '+x)};
if(review.batch_id!=='LIFE-07'||review.status!=='HIGH_RISK_SEMANTIC_REVIEW_PENDING'||
 !Array.isArray(review.records)||review.records.length!==12)fail('review must be 12 pending records');
const expected=source.records.filter(r=>r.risk==='HIGH');
if(expected.length!==12)fail('risk source drift');
const names=new Set();
let conflicts=0;
for(let i=0;i<review.records.length;i++){
 const r=review.records[i],original=expected[i];
 if(!original||r.english!==original.english||r.group_id!==original.group_id||
 r.meaning!==original.meaning||r.priority!=='HIGH')fail('review source drift');
 if(names.has(r.english))fail('duplicate entry');
 names.add(r.english);
 if(!r.sense_boundary||!r.editorial_note||!Array.isArray(r.possible_equivalent_phrasings_for_editor)||
 !Array.isArray(r.non_equivalent_or_unsafe_examples_for_editor)||
 r.non_equivalent_or_unsafe_examples_for_editor.length===0)fail('missing editor boundary');
 const alternatives=new Set(r.possible_equivalent_phrasings_for_editor.map(x=>x.toLowerCase().trim()));
 const exclusions=new Set(r.non_equivalent_or_unsafe_examples_for_editor.map(x=>x.toLowerCase().trim()));
 if([...alternatives].some(x=>exclusions.has(x)))fail('same answer both candidate and excluded');
 if(!Array.isArray(r.approved_accepted_answers)||r.approved_accepted_answers.length!==0||
 r.reviewer_signed_off!==false||r.gameplay_approved!==false)fail('unauthorized approval');
 if(r.cefr_conflict_flag!==null)conflicts++;
}
if(conflicts!==2)fail('CEFR review flags should be 2');
console.log(JSON.stringify({status:'PASS_REVIEW_METADATA_ONLY',reviewed_for_triage:12,
 approved_answers:0,cefr_conflict_flags:conflicts,human_signoff:0,
 grading_authorized:false,production_release_authorized:false},null,2));
