// LIFE-07 complete candidate integrity guard. Offline/read-only.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateLife1000Candidates} from '../lib/vocab-life1000-gate.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const roadmap=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const drafts=read('vocab/cefr-provisional.json').records;
const priorRecords=Array.from({length:6},(_,i)=>read('vocab/batches/LIFE-'+String(i+1).padStart(2,'0')+'.json')).flatMap(x=>x.records);
const batch=read('vocab/batches/LIFE-07.json');
const stage=read('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const fail=m=>{throw Error('LIFE-07 candidate QA: '+m)};
const report=validateLife1000Candidates({roadmap,seed,drafts,priorRecords,batch});
if(report.lexical_candidates!==100||report.authorized_to_import||
   report.production_deployment_authorized||!report.all_items_provisional)fail('unsafe validator output');
const expectedKeys=['group_id','topic','english','ipa','meaning','example','translation',
 'part_of_speech','level','review_status','source_url','cefr_evidence_kind',
 'cefr_source_label','source_note'].sort().join('|');
const breakdown={};
for(let i=0;i<100;i++){
 const r=batch.records[i],s=stage.records[i];
 if(Object.keys(r).sort().join('|')!==expectedKeys)fail('wrong 14-field schema at '+i);
 for(const key of ['group_id','english','meaning','example','translation','part_of_speech','source_url']){
  if(r[key]!==s[key])fail('stage drift '+i+' '+key);
 }
 if(r.level!==s.proposed_cefr||r.review_status!=='PROVISIONAL'||
  r.cefr_evidence_kind!=='contextual_inference'||r.cefr_source_label!==null||
  !r.source_note.includes('NOT independently verified')||
  !r.source_note.includes('NO APPROVAL OR IMPORT AUTHORIZATION'))fail('unsafe evidence '+i);
 if(!r.ipa.startsWith('/')||!r.ipa.endsWith('/')||r.ipa.length<6)fail('missing draft IPA '+i);
 breakdown[r.group_id]=(breakdown[r.group_id]||0)+1;
}
if(Object.keys(breakdown).length!==4||Object.values(breakdown).some(n=>n!==25))fail('group quota');
console.log(JSON.stringify({status:'PASS_DRAFT_STRUCTURE_ONLY',batch:'LIFE-07',
 candidates:100,prior_comparison_items:280+117+600,groups:breakdown,
 provisional_ipa:100,source_verified_full_phrase_ipa:0,
 cefr_estimates:100,source_certified_full_phrase_cefr:0,
 reviewer_approved:0,ready_to_import:false,ready_to_deploy:false},null,2));
