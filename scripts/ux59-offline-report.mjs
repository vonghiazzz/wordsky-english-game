// UX59 M1: deterministic hypothetical scenario report, no DB/network access.
// Usage: node scripts/ux59-offline-report.mjs
import {compareOfflineSchedules} from '../lib/ux59-srs-offline.js';

export const AS_OF='2026-11-19T08:00:00.000Z';
const at=(day,hour=0)=>new Date(Date.parse('2026-11-19T00:00:00.000Z')+day*86400000+hour*3600000).toISOString();
const history=(outcomes,offset=0)=>outcomes.map((remembered,i)=>({
 id:'event-'+(i+1),remembered,reviewed_at:at(offset+i,0)
}));
export function exampleFixtures(){
 return [
  {key:'shared:new',history:[]},
  {key:'shared:first-success',history:history([true],-1)},
  {key:'shared:success-streak',history:history([true,true,true],-10)},
  {key:'personal:single-need',history:history([false,true],-2)},
  {key:'personal:double-need',history:history([false,false,true],-2)},
  {key:'shared:triple-need',history:history([false,false,false,true],-3)},
  // A shorter initial due can advance a later success too early.
  {key:'shared:followup-divergence',history:[
   {id:'event-1',remembered:false,reviewed_at:'2026-11-17T00:00:00.000Z'},
   {id:'event-2',remembered:false,reviewed_at:'2026-11-17T01:00:00.000Z'},
   {id:'event-3',remembered:true,reviewed_at:'2026-11-18T00:00:00.000Z'},
   {id:'event-4',remembered:true,reviewed_at:'2026-11-18T13:00:00.000Z'}
  ]},
  {key:'shared:still-need',history:history([false,false],-1)},
  {key:'personal:success-after-gap',history:history([true,false,true],-10)}
 ];
}
export function makeReport(){
 const comparison=compareOfflineSchedules(exampleFixtures(),{now:AS_OF});
 return {
  ...comparison,
  as_of:AS_OF,
  dataset:'9 synthetic scenarios; no real learner data',
  interpretation:'Counterfactual schedule replay on fixed histories only. A shorter initial due can advance streaks and yield a LATER due than control. No retention benefit is proven.',
  limitation:'No reliable recall outcome, attendance, or compliance behavior; candidate would alter future histories.',
  controls:'No database, network, personal data, schedule migration, feature flag, or production writes.'
 };
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 process.stdout.write(JSON.stringify(makeReport(),null,2)+'\n');
}
