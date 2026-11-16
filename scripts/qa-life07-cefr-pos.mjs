// Offline LIFE-07 stage-3 QA. This does NOT approve CEFR or import any vocabulary.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const load=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const stage=load('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const prior=load('vocab/editorial/LIFE-07-examples-draft.json');
const roadmap=load('vocab/life-1000-roadmap.json');
const fail=m=>{throw Error('LIFE-07 stage3: '+m)};
if(stage.status!=='EDITORIAL_ENRICHMENT_NOT_IMPORTABLE'||stage.batch_id!=='LIFE-07'||
 stage.schema!=='life07-cefr-pos-stage3-v1'||stage.records?.length!==100||
 prior.records?.length!==100)fail('missing data or unsafe status');
const definitions=roadmap.batches.find(x=>x.id==='LIFE-07')?.groups;
if(definitions?.length!==4)fail('roadmap groups missing');
const quota=Object.fromEntries(definitions.map(g=>[g.id,0]));
const dist={A1:0,A2:0,B1:0,B2:0};
for(let i=0;i<100;i++){
 const a=stage.records[i],b=prior.records[i];
 for(const key of ['group_id','english','meaning','example','translation','source_url']){
  if(a[key]!==b[key])fail('drift at '+i+': '+key);
 }
 if(!Object.hasOwn(quota,a.group_id))fail('unknown group');
 quota[a.group_id]++;
 if(a.part_of_speech!=='verb phrase')fail('POS not reviewed at '+i);
 if(!Object.hasOwn(dist,a.proposed_cefr))fail('unexpected CEFR proposal');
 dist[a.proposed_cefr]++;
 if(a.cefr_source_label!==null||a.cefr_evidence_kind!=='contextual_inference'||
    !a.source_note.includes('NOT an exact dictionary'))fail('falsified CEFR provenance');
 if('ipa' in a||'review_status' in a||'level' in a)fail('unsafe premature full batch fields');
}
if(Object.values(quota).some(n=>n!==25))fail('group quota');
if(JSON.stringify(dist)!==JSON.stringify({A1:6,A2:29,B1:43,B2:22}))fail('distribution drift');
console.log(JSON.stringify({status:'PASS_EDITORIAL_STAGE3_ONLY',groups:quota,distribution:dist,
 record_count:100,source_certified_cefr_count:0,ipa_verified_count:0,
 ready_for_vocab_batch:false,import_authorized:false,production_deployment_authorized:false},null,2));
