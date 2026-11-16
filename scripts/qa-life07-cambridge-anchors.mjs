// LIFE-07 Phase-4 source-anchor QA; no certification, import or DB writes.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const a=read('vocab/editorial/LIFE-07-cambridge-anchors.json');
const stage=read('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const fail=m=>{throw Error('LIFE-07 anchor QA: '+m)};
if(a.status!=='SOURCE_ANCHORS_NOT_FULL_PHRASE_VALIDATION'||
 a.source_anchor_count!==9||a.records?.length!==9)fail('anchor inventory mismatch');
const names=new Set(stage.records.map(r=>r.english));
const seen=new Set();
for(const r of a.records){
 if(!names.has(r.expression)||seen.has(r.expression))fail('missing/duplicate expression');
 seen.add(r.expression);
 if(!r.source.startsWith('https://dictionary.cambridge.org/')||
    !r.uk_ipa.startsWith('/')||!r.uk_ipa.endsWith('/')||
    !r.anchor||!r.note||r.ipa_scope!=='headword_or_collocation_component_only'||
    r.phrase_ipa_verified!==false||r.phrase_cefr_verified!==false)
  fail('invalid evidence scope: '+r.expression);
 if(r.label!==null){
  if(!['A1','A2','B1','B2','C1','C2'].includes(r.label)||
   r.cefr_label_scope!=='headword_sense_only')fail('invalid CEFR label scope');
 }else if(r.cefr_label_scope!=='none')fail('invented label');
}
const side=a.records.find(r=>r.expression==='ask about side effects');
const proposed=stage.records.find(r=>r.english===side.expression);
if(side.label!=='C1'||proposed.proposed_cefr!=='B1')fail('source-vs-editorial review flag changed');
console.log(JSON.stringify({status:'PASS_ANCHOR_STRUCTURE_ONLY',
 anchors:a.records.length,direct_headword_sense_labels:a.records.filter(r=>r.label).length,
 phrase_cefr_certified:0,full_phrase_ipa_certified:0,
 unresolved_cefr_mismatch:['ask about side effects'],import_authorized:false,
 deploy_authorized:false},null,2));
