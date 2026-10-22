// Read-only coverage report for 26 established topics; no network or DB access.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const original=JSON.parse(fs.readFileSync(path.join(root,'db/seed-vocabulary.json'),'utf8'));
const file=path.resolve(process.argv.find(x=>x.startsWith('--file='))?.slice(7)||path.join(root,'vocab/cefr-review-all-topics.json'));
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=Array.isArray(data)?data:data.records;
if(!Array.isArray(rows))throw Error('Missing records array');
const hasTier=(x,t)=>t==='A2'?x.level==='A2':t==='BONUS'?['B1','B2'].includes(x.level):['C1','C2'].includes(x.level);
const groups=['A2','BONUS','DOUBLE'];
const report=[];
for(const title of Object.keys(original)){
 const own=rows.filter(x=>x.topic===title);
 const counts=Object.fromEntries(groups.map(t=>[t,own.filter(x=>hasTier(x,t)&&x.review_status==='APPROVED').length]));
 const draft=Object.fromEntries(groups.map(t=>[t,own.filter(x=>hasTier(x,t)&&x.review_status==='PROVISIONAL').length]));
 report.push({topic:title,reviewed_A2:counts.A2,reviewed_B1_B2:counts.BONUS,reviewed_C1_C2:counts.DOUBLE,draft_A2:draft.A2,draft_B1_B2:draft.BONUS,draft_C1_C2:draft.DOUBLE,normal3_ready:counts.A2>=3&&counts.BONUS>=3&&counts.DOUBLE>=3,normal12_ready:counts.A2>=12&&counts.BONUS>=12&&counts.DOUBLE>=12});
}
console.table(report);
const all=rows.filter(x=>Object.hasOwn(original,x.topic));
console.log(JSON.stringify({topics:report.length,cards:all.length,unreviewed:all.filter(x=>x.review_status==='UNREVIEWED').length,provisional:all.filter(x=>x.review_status==='PROVISIONAL').length,approved:all.filter(x=>x.review_status==='APPROVED').length,normal3_ready:report.filter(x=>x.normal3_ready).length,normal12_ready:report.filter(x=>x.normal12_ready).length},null,2));
