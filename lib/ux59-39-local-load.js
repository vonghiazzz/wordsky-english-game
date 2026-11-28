// UX59.39: bounded, read-only LOCAL benchmark. Never send load to a deployed host.
import {performance} from 'node:perf_hooks';

export const STATIC_PATHS=Object.freeze([
  '/','/progress.html','/learn.html','/verbs.html','/ux10-progress.js'
]);
export const LIMITS=Object.freeze({requests:250,concurrency:12,rps:30});

export function validateLocalTarget(base){
  if(typeof base!=='string')throw Error('A local --base URL is required');
  const url=new URL(base);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||
     url.pathname!=='/'||url.search||url.hash||url.username||url.password){
    throw Error('Load target must be http://127.0.0.1:<port>/ only');
  }
  const port=Number(url.port);
  if(!Number.isInteger(port)||port<1024||port>65535){
    throw Error('Load target port must be 1024..65535');
  }
  return url.origin;
}
export function validateLoadConfig({base,requests,concurrency,rps}){
  const origin=validateLocalTarget(base);
  for(const [name,value,max] of [
    ['requests',requests,LIMITS.requests],
    ['concurrency',concurrency,LIMITS.concurrency],
    ['rps',rps,LIMITS.rps]
  ]){
    if(!Number.isInteger(value)||value<1||value>max){
      throw Error(name+' must be an integer between 1 and '+max);
    }
  }
  if(concurrency>requests)throw Error('concurrency cannot exceed requests');
  return origin;
}
export function percentile(values,fraction){
  if(!Array.isArray(values)||!values.length) return null;
  if(typeof fraction!=='number'||fraction<0||fraction>1)throw Error('Invalid percentile');
  const sorted=values.slice().sort((a,b)=>a-b);
  return sorted[Math.max(0,Math.ceil(fraction*sorted.length)-1)];
}
export function summarize(samples,elapsedMs,maxInFlight){
  const durations=samples.map(s=>s.durationMs);
  const errors=samples.filter(s=>!s.ok).length;
  const statuses={};
  for(const sample of samples){
    const key=String(sample.status);
    statuses[key]=(statuses[key]||0)+1;
  }
  const round=v=>Math.round(v*100)/100;
  return {
    environment:'isolated-loopback',
    workload:'anonymous GET of five local static routes',
    requests:samples.length,
    completed:samples.length,
    errors,
    errorRate:round(100*errors/samples.length),
    elapsedMs:round(elapsedMs),
    throughputRps:round(samples.length*1000/elapsedMs),
    p50Ms:round(percentile(durations,0.50)),
    p95Ms:round(percentile(durations,0.95)),
    p99Ms:round(percentile(durations,0.99)),
    maxInFlight,
    statuses,
    note:'Local controlled-sample diagnostics; NOT production capacity or 10k users.'
  };
}
export async function runBoundedLoad({
  base,requests=100,concurrency=4,rps=10,fetcher=fetch
}={}){
  const origin=validateLoadConfig({base,requests,concurrency,rps});
  const start=performance.now();
  const samples=new Array(requests);
  let cursor=0,inFlight=0,maxInFlight=0;
  async function worker(){
    while(true){
      const index=cursor++;
      if(index>=requests) return;
      // One global start slot per request; even high concurrency cannot burst.
      const due=start+(index*1000/rps);
      const delay=due-performance.now();
      if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));
      const path=STATIC_PATHS[index%STATIC_PATHS.length];
      const url=new URL(path,origin);
      const begun=performance.now();
      let status='network-error',ok=false;
      inFlight++;
      maxInFlight=Math.max(maxInFlight,inFlight);
      try{
        const response=await fetcher(url,{
          method:'GET',redirect:'manual',cache:'no-store',
          headers:{'user-agent':'WordSky-UX59.39-Local-Only'},
          signal:AbortSignal.timeout(4000)
        });
        status=response.status;
        await response.arrayBuffer();
        ok=status===200;
      }catch{
        // Errors are counted without printing URL, tokens or response data.
      }finally{
        samples[index]={
          path,status,ok,
          durationMs:Math.round((performance.now()-begun)*100)/100
        };
        inFlight--;
      }
    }
  }
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  const report=summarize(samples,performance.now()-start,maxInFlight);
  report.settings={requests,concurrency,requestedRps:rps,target:'loopback-only'};
  return report;
}
