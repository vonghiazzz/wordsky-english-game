// Intentionally fake approvals for LOCAL integration testing. NOT valid CEFR verification.
import fs from 'node:fs';
const dest=process.argv[2];
if(!dest)throw Error('Give a temporary output file path.');
const draft=JSON.parse(fs.readFileSync(new URL('../../vocab/cefr-provisional.json',import.meta.url),'utf8'));
const school='School - Trường học';
function pick(n,fn){const found=draft.records.filter(fn).slice(0,n);if(found.length!==n)throw Error('Fixture does not have the required staged draft words');return found}
const chosen=[
 ...pick(3,x=>x.level==='A2'&&x.topic===school),
 ...pick(3,x=>['B1','B2'].includes(x.level)&&x.topic===school),
 ...pick(3,x=>['C1','C2'].includes(x.level)&&x.topic===school),
 ...pick(3,x=>x.level==='A2'&&x.topic!==school),
];
const file={test_only:true,description:'SIMULATED APPROVALS FOR LOCAL TEST ONLY. NOT HUMAN-REVIEWED. NEVER DEPLOY.',records:chosen.map(x=>({...x,review_status:'APPROVED',source_note:'TEST ONLY: FAKE APPROVAL'}))};
fs.writeFileSync(dest,JSON.stringify(file,null,2));
console.log('Generated temporary local fixture: 12 fake-approved records (School A2/B1-C2 + global Easy).');
