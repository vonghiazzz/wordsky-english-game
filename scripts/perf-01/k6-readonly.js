/**
 * WordSky PERF-01 k6 read-only baseline.
 *
 * Local-only: refuses all remote URLs, even if a user supplies one.
 * Before running: validate .env with the PERF-01 Node preflight, use an
 * isolated local PostgreSQL instance, and set PERF_LOCAL_DB_ACK accordingly.
 *
 * No login, cookies, POST, PATCH, DELETE, arena joins or SRS writes.
 * Requests per generator are capped; 10,000 concurrent VUs are NOT enabled.
 */
import http from 'k6/http';
import {check,sleep,fail} from 'k6';

const PROFILES={
  smoke:{
    stages:[{duration:'10s',target:1},{duration:'20s',target:1},{duration:'5s',target:0}],
    maxVus:1,rps:2,
  },
  baseline:{
    stages:[{duration:'20s',target:5},{duration:'60s',target:10},{duration:'15s',target:0}],
    maxVus:10,rps:10,
  },
  step50:{
    stages:[
      {duration:'30s',target:10},{duration:'30s',target:25},
      {duration:'60s',target:50},{duration:'20s',target:0}
    ],
    maxVus:50,rps:25,
  },
};
const selected=String(__ENV.PERF_PROFILE||'smoke');
const target=String(__ENV.PERF_TARGET||'http://127.0.0.1:3000');
if(!Object.prototype.hasOwnProperty.call(PROFILES,selected))
  throw new Error('PERF-01 rejects unknown load profile');
if(__ENV.PERF_LOCAL_DB_ACK!=='I_VERIFIED_ISOLATED_LOCAL_POSTGRES')
  throw new Error('PERF-01 requires explicit isolated-local-Postgres acknowledgement');
if(!['http://127.0.0.1:3000','http://localhost:3000'].includes(target))
  throw new Error('PERF-01 refuses remote/production/preview URLs. Use isolated localhost only.');
const selectedProfile=PROFILES[selected];

export const options={
  scenarios:{
    public_readonly:{
      executor:'ramping-vus',stages:selectedProfile.stages,
      gracefulRampDown:'5s',gracefulStop:'5s',
      exec:'publicVisitor'
    }
  },
  rps:selectedProfile.rps,
  discardResponseBodies:true,
  maxRedirects:0,
  userAgent:'WordSky-PERF01-Local-ReadOnly/1.0',
  thresholds:{
    http_req_failed:[{threshold:'rate<0.01',abortOnFail:true,delayAbortEval:'20s'}],
    http_req_duration:[{threshold:'p(95)<1000',abortOnFail:true,delayAbortEval:'30s'},'p(99)<2500'],
    checks:['rate>0.99']
  },
};
const paths=[
  {path:'/',tag:'home',weight:60},
  {path:'/api/topics',tag:'topics',weight:25},
  {path:'/api/learning/vocabulary',tag:'vocabulary',weight:15},
];
function choosePath(){
  let sample=Math.random()*100;
  for(const candidate of paths){
    sample-=candidate.weight;
    if(sample<0)return candidate;
  }
  return paths[0];
}
export function setup(){
  const checkHealth=http.get(target+'/api/health',{
    redirects:0,timeout:'8s',tags:{endpoint:'health-precheck'}
  });
  if(checkHealth.status!==200)fail('Local API health failed: stop load test');
  return {safe:true};
}
export function publicVisitor(){
  const endpoint=choosePath();
  const res=http.get(target+endpoint.path,{
    redirects:0,timeout:'8s',tags:{endpoint:endpoint.tag}
  });
  check(res,{'HTTP 200 (GET only)':r=>r.status===200},
    {endpoint:endpoint.tag});
  sleep(2+Math.random()*2);
}
export default publicVisitor;
