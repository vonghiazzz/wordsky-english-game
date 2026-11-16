// LIFE-07 stage-2 examples QA. Strictly offline. No DB or reviewer approval.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(resolve(root,p),'utf8');
const data=JSON.parse(read('vocab/editorial/LIFE-07-examples-draft.json'));
const inventory=read('docs/vocab-life07-editorial-inventory.md');
const fail=s=>{throw new Error('LIFE-07 examples: '+s)};
if(data.batch_id!=='LIFE-07'||data.status!=='EDITORIAL_ENRICHMENT_NOT_IMPORTABLE'||
   !Array.isArray(data.records)||data.records.length!==100)fail('unsafe stage or record count');
const expected=[];
let group='';
for(const line of inventory.split(/\r?\n/u)){
 const h=line.match(/^## (symptoms|pharmacy|habits|wellbeing) \(25\)$/u);
 if(h){group=h[1];continue}
 if(!/^\| \d+ \|/u.test(line))continue;
 const cells=line.split('|').slice(1,-1).map(x=>x.trim());
 if(cells.length!==3||!group)fail('malformed inventory');
 expected.push({group_id:group,english:cells[1],meaning:cells[2]});
}
const groups={symptoms:0,pharmacy:0,habits:0,wellbeing:0};
if(expected.length!==100)fail('inventory count changed');
for(let i=0;i<data.records.length;i++){
 const r=data.records[i],e=expected[i];
 if(r.group_id!==e.group_id||r.english!==e.english||r.meaning!==e.meaning)
  fail('record does not match inventory at position '+i);
 if(!Object.hasOwn(groups,r.group_id))fail('unexpected group');
 groups[r.group_id]++;
 if(typeof r.example!=='string'||!r.example.trim()||r.example.length>500||
    typeof r.translation!=='string'||!r.translation.trim()||r.translation.length>500)
  fail('missing example or translation at '+i);
 if(r.cefr_evidence_kind!=='contextual_inference'||r.cefr_source_label!==null||
    typeof r.source_url!=='string'||!r.source_url.startsWith('https://')||
    typeof r.source_note!=='string'||!r.source_note.includes('NOT independently certified'))
  fail('unsafe evidence claim at '+i);
 if('review_status' in r||'ipa' in r||'level' in r)
  fail('review/IPA/level must remain absent from this incomplete staging record');
}
if(Object.values(groups).some(n=>n!==25))fail('group count');
console.log(JSON.stringify({status:'PASS_STAGE2_ONLY',records:100,groups,
 examples_written:100,translations_written:100,source_specific_cefr_verified:0,
 ipa_verified:0,editorial_approval:false,ready_to_import:false,ready_to_deploy:false},null,2));
