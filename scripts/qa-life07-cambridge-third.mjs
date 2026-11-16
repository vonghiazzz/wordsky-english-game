// LIFE-07 third Cambridge anchor audit; read-only; full phrases remain unverified.
import {readFileSync} from 'node:fs';
const load=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const parts=['vocab/editorial/LIFE-07-cambridge-anchors.json','vocab/editorial/LIFE-07-cambridge-anchors-extra.json','vocab/editorial/LIFE-07-cambridge-anchors-third.json'].map(load);
const draft=load('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const names=new Set(draft.records.map(r=>r.english));
const all=parts.flatMap(p=>p.records);
if(parts[0].records.length!==9||parts[1].records.length!==6||parts[2].records.length!==5||all.length!==20)throw Error('expected 20 anchors 9+6+5');
const seen=new Set();
for(const r of all){
 if(!names.has(r.expression)||seen.has(r.expression))throw Error('unrecognized or duplicate expression: '+r.expression);
 seen.add(r.expression);
 if(r.phrase_cefr_verified!==false||r.phrase_ipa_verified!==false)throw Error('full phrase source certainty falsified');
}
for(const r of parts[2].records){
 if(r.anchor_cefr===null||!['A1','A2','B1','B2','C1','C2'].includes(r.anchor_cefr)||
 !r.source_url.startsWith('https://dictionary.cambridge.org/')||!r.uk_ipa.startsWith('/')||
 r.editor_approved!==false)throw Error('incorrect third anchor');
}
console.log(JSON.stringify({status:'PASS_COMPONENT_METADATA_ONLY',total_anchor_expressions:20,
 full_phrase_cefr_verified:0,full_phrase_ipa_verified:0,approved:0,import_authorized:false},null,2));
