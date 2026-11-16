// Read-only source-anchor extension integrity check. Never claims whole-phrase CEFR.
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p, import.meta.url),'utf8'));
const extra=read('vocab/editorial/LIFE-07-cambridge-anchors-extra.json');
const first=read('vocab/editorial/LIFE-07-cambridge-anchors.json');
const stage=read('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const fail=m=>{throw Error('LIFE07 extra anchors: '+m)};
if(extra.batch_id!=='LIFE-07'||extra.status!=='CAMBRIDGE_COMPONENT_ANCHORS_ONLY'||extra.records?.length!==6)fail('invalid extra anchor data');
if(first.records?.length!==9)fail('primary anchors unexpectedly changed');
const included=new Set(stage.records.map(x=>x.english));
const seen=new Set(first.records.map(x=>x.expression));
for(const r of extra.records){
 if(!included.has(r.expression)||seen.has(r.expression))fail('missing or duplicate expression: '+r.expression);
 seen.add(r.expression);
 if(!r.source_url.startsWith('https://dictionary.cambridge.org/')||!r.uk_ipa.startsWith('/')||
  r.phrase_ipa_verified!==false||r.phrase_cefr_verified!==false||r.editor_approved!==false)
  fail('invalid scope for '+r.expression);
 if(r.anchor_cefr!==null&&!['A1','A2','B1','B2','C1','C2'].includes(r.anchor_cefr))fail('unsafe CEFR');
}
const rash=extra.records.find(x=>x.expression==='break out in a rash');
if(rash.anchor_cefr!=='C2'||stage.records.find(x=>x.english===rash.expression)?.proposed_cefr!=='B2')fail('missing rash editorial flag');
console.log(JSON.stringify({result:'PASS_SOURCE_ANCHOR_STRUCTURE_ONLY',original:9,additional:6,total:15,whole_phrase_cefr_verified:0,whole_phrase_ipa_verified:0,authorized_to_import:false},null,2));
