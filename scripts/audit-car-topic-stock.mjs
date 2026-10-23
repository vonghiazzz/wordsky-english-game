// Read-only per-topic WordSky CAR CEFR coverage audit.
// Usage: node audit-car-topic-stock.mjs https://YOUR-VERCEL-PREVIEW.vercel.app 8 NORMAL
const [base,stepsText='8',difficulty='NORMAL']=process.argv.slice(2);
if(!base||!/https:\/\//.test(base)){console.error('Usage: node audit-car-topic-stock.mjs https://preview-url 8 NORMAL');process.exit(1)}
const steps=Number(stepsText);
if(!Number.isInteger(steps)||steps<3||steps>30||!['EASY','NORMAL','HARD'].includes(difficulty)){console.error('Invalid steps/difficulty');process.exit(1)}
const response=await fetch(new URL('/api/topics',base));if(!response.ok)throw Error('GET /api/topics '+response.status);
const {topics}=await response.json();
const basicNeeded=(difficulty==='EASY'?2:1)*steps;
const needed=[basicNeeded,steps,steps];
const rows=topics.filter(t=>t.enabled!==false).map(t=>{
 const available=[Number(t.approved_a2||0),Number(t.approved_bonus||0),Number(t.approved_double||0)];
 const missing=needed.map((n,i)=>Math.max(0,n-available[i]));
 return {topic:t.title,approved_basic:available[0],approved_bonus:available[1],approved_double:available[2],missing_basic:missing[0],missing_bonus:missing[1],missing_double:missing[2],ready:missing.every(n=>n===0)};
});
console.table(rows);
console.log('READY:',rows.filter(r=>r.ready).length+'/'+rows.length,'TOPICS. Only APPROVED words are counted. No DB writes.');
