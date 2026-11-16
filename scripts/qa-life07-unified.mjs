// LIFE-07 unified audit. Offline only: evidence bookkeeping, not dictionary re-verification.
import {readFileSync} from 'node:fs';
const load=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const paths=[
 'vocab/editorial/LIFE-07-cambridge-anchors.json',
 'vocab/editorial/LIFE-07-cambridge-anchors-extra.json',
 'vocab/editorial/LIFE-07-cambridge-anchors-third.json',
 'vocab/editorial/LIFE-07-cambridge-anchors-fourth.json'
];
const parts=paths.map(load);
const expected=[9,6,5,3];
const draft=load('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const inventory=load('vocab/editorial/LIFE-07-examples-draft.json');
const fail=m=>{throw Error('LIFE-07 unified audit: '+m)};
if(draft.records?.length!==100||inventory.records?.length!==100)fail('incomplete source');
const names=new Set(draft.records.map(r=>r.english));
const anchorNames=new Set();
let labeled=0;
for(let i=0;i<parts.length;i++){
 if(parts[i].records?.length!==expected[i])fail('anchor file count changed: '+paths[i]);
 for(const r of parts[i].records){
  const expression=r.expression;
  if(!names.has(expression)||anchorNames.has(expression))fail('unknown/duplicate anchor: '+expression);
  anchorNames.add(expression);
  const wholeCefr=r.phrase_cefr_verified??r.whole_phrase_cefr_verified;
  const wholeIpa=r.phrase_ipa_verified??r.whole_phrase_ipa_verified;
  if(wholeCefr!==false||wholeIpa!==false)fail('unfounded full phrase claim');
  const label=i===0?r.label:i===3?r.anchor_cefr:r.anchor_cefr;
  if(label!==null)labeled++;
 }
}
const distribution={};
for(const r of draft.records){
 if(r.cefr_source_label!==null||r.cefr_evidence_kind!=='contextual_inference'||
    r.proposed_cefr===undefined)fail('unreviewed CEFR certainty');
 distribution[r.proposed_cefr]=(distribution[r.proposed_cefr]||0)+1;
}
if(anchorNames.size!==23)fail('anchor coverage count');
console.log(JSON.stringify({status:'PASS_METADATA_ONLY',records:100,distinct_anchor_expressions:23,
 component_sense_cefr_labels:labeled,certified_full_phrase_cefr:0,
 certified_full_phrase_ipa:0,proposed_levels:distribution,
 editorial_approved:false,import_authorized:false,deploy_authorized:false},null,2));
