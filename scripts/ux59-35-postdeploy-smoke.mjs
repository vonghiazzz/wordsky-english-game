// UX59.35: read-only production verification for the exact reviewed main SHA.
import assert from 'node:assert/strict';

const sha=process.env.GITHUB_SHA||'';
const repository=process.env.GITHUB_REPOSITORY||'';
const token=process.env.GITHUB_TOKEN||'';
const origin='https://wordsky-english-game.vercel.app';
assert.match(sha,/^[0-9a-f]{40}$/);
assert.equal(repository,'vonghiazzz/wordsky-english-game');
assert.ok(token,'Missing GITHUB_TOKEN');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function getProductionStatus(){
  const res=await fetch('https://api.github.com/repos/'+repository+'/commits/'+sha+'/status',{
    headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28'},
    signal:AbortSignal.timeout(12000)
  });
  assert.equal(res.status,200,'Cannot verify GitHub commit status');
  const data=await res.json();
  const found=data.statuses?.find(x=>x.context==='Vercel'&&x.state==='success'&&x.target_url);
  if(!found)return null;
  const url=new URL(found.target_url);
  assert.equal(url.protocol,'https:');
  assert.equal(url.hostname,'vercel.com');
  assert.ok(url.pathname.startsWith('/nghias-projects-6f5417e1/wordsky-english-game/'),
    'Vercel success belongs to another project');
  return found.target_url;
}
let target=null;
for(let i=0;i<72;i++){
  target=await getProductionStatus();
  if(target)break;
  if(i<71)await pause(10000);
}
assert.ok(target,'No Vercel success for exact main SHA after 12 minutes');
console.log('PASS: exact main commit '+sha.slice(0,8)+' has Vercel success');

const samples=[];
async function check(path,status,contentType,validate){
  const url=new URL(path,origin);
  assert.equal(url.origin,origin);
  let last;
  for(let i=0;i<5;i++){
    try{
      const started=performance.now();
      const res=await fetch(url,{
        method:'GET',redirect:'manual',
        headers:{'cache-control':'no-cache','user-agent':'WordSky-UX59.35-ReadOnly'},
        signal:AbortSignal.timeout(12000)
      });
      assert.equal(res.status,status,'Unexpected status at '+url.pathname);
      const type=res.headers.get('content-type')||'';
      assert.ok(type.includes(contentType),'Unexpected content type at '+url.pathname);
      if(validate)validate(await res.json());
      else await res.arrayBuffer();
      const durationMs=Math.round(performance.now()-started);
      samples.push({path:url.pathname,status,durationMs});
      console.log('PASS GET '+url.pathname+' '+status+' '+durationMs+'ms');
      return;
    }catch(err){
      last=err;
      if(i<4)await pause(3000);
    }
  }
  throw Error('GET '+url.pathname+' failed: '+last.message);
}
await check('/',200,'text/html');
await check('/progress.html',200,'text/html');
await check('/learn.html',200,'text/html');
await check('/verbs.html',200,'text/html');
await check('/ux10-progress.js',200,'javascript');
await check('/api/auth/me',200,'application/json',body=>{
  assert.equal(body.actor,null,'Anonymous user unexpectedly authenticated');
});
await check('/api/learning/me/summary',401,'application/json');
await check('/api/learning/srs/queue?status=due&page=0&size=20',401,'application/json');
assert.equal(samples.length,8,'Expected eight completed read-only GET checks');
const ordered=samples.map(s=>s.durationMs).sort((a,b)=>a-b);
const p95=ordered[Math.ceil(0.95*ordered.length)-1];
const max=ordered.at(-1);
console.log('UX59.38 DIAGNOSTIC LATENCY (one GET per route, not a load test): '+JSON.stringify({
  samples:samples.length,p95Ms:p95,maxMs:max,routes:samples
}));
console.log('UX59.38 POST-DEPLOY READ-ONLY GET: 8/8 PASS');
if(process.env.GITHUB_STEP_SUMMARY){
  const {appendFileSync}=await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## UX59.35 post-deploy QA\n'+
    '- SHA: '+sha+'\n- Vercel: exact-SHA success\n'+
    '- Live GET: 8/8 PASS\n- Deployment status: '+target+'\n');
}
