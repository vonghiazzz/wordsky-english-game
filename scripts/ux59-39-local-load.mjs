// UX59.39. Executes only against local loopback (never Preview/Production).
import {runBoundedLoad} from '../lib/ux59-39-local-load.js';

const args=process.argv.slice(2);
const allowed=new Set(['--base','--requests','--concurrency','--rps']);
if(args.length%2)throw Error('Arguments must be --name value pairs');
const flags=new Map();
for(let i=0;i<args.length;i+=2){
  if(!allowed.has(args[i])||flags.has(args[i]))throw Error('Invalid/duplicate option: '+args[i]);
  flags.set(args[i],args[i+1]);
}
if(!flags.has('--base'))throw Error('--base http://127.0.0.1:<port> required');
const parse=(name,defaultValue)=>{
  if(!flags.has(name))return defaultValue;
  const text=flags.get(name);
  if(!/^[1-9][0-9]*$/.test(text))throw Error(name+' must be a positive integer');
  return Number(text);
};
const report=await runBoundedLoad({
  base:flags.get('--base'),
  requests:parse('--requests',100),
  concurrency:parse('--concurrency',4),
  rps:parse('--rps',10)
});
console.log('UX59.39 LOCAL LOAD REPORT '+JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY){
  const {appendFileSync}=await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## UX59.39 isolated localhost benchmark\n'+
    '- Requests: '+report.requests+'\n'+
    '- Throughput: '+report.throughputRps+' req/s\n'+
    '- P50 / P95 / P99: '+report.p50Ms+' / '+report.p95Ms+
      ' / '+report.p99Ms+' ms\n'+
    '- Errors: '+report.errors+' ('+report.errorRate+'%)\n'+
    '- This is a bounded local server smoke, not Vercel production capacity.\n');
}
if(report.errors!==0)process.exitCode=1;
