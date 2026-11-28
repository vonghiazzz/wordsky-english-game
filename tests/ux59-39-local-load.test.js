import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {
  validateLocalTarget,validateLoadConfig,percentile,runBoundedLoad,STATIC_PATHS
} from '../lib/ux59-39-local-load.js';

test('UX59.39 rejects production, preview, domain aliases and unsafe URLs',()=>{
  const disallowed=[
    'https://wordsky-english-game.vercel.app',
    'https://preview.vercel.app',
    'http://wordsky-english-game.vercel.app',
    'http://localhost:3333',
    'http://127.0.0.2:3333',
    'http://127.0.0.1.nip.io:3333',
    'http://127.0.0.1:3333/api/auth/me',
    'http://127.0.0.1:3333/?action=write',
    'http://user:pass@127.0.0.1:3333/',
    'http://127.0.0.1:80/'
  ];
  for(const url of disallowed){
    assert.throws(()=>validateLocalTarget(url),undefined,url);
  }
  assert.equal(validateLocalTarget('http://127.0.0.1:32195/'),
    'http://127.0.0.1:32195');
});

test('UX59.39 enforces strict workload and concurrency ceilings',()=>{
  for(const config of [
    {requests:251,concurrency:4,rps:10},
    {requests:100,concurrency:13,rps:10},
    {requests:100,concurrency:4,rps:31},
    {requests:2,concurrency:3,rps:10},
    {requests:-1,concurrency:1,rps:10},
    {requests:10,concurrency:2,rps:2.5}
  ]){
    assert.throws(()=>validateLoadConfig({
      base:'http://127.0.0.1:32195',...config
    }));
  }
  assert.equal(STATIC_PATHS.length,5);
  for(const path of STATIC_PATHS)assert.ok(path.startsWith('/'));
});

test('UX59.39 nearest-rank percentiles are deterministic',()=>{
  assert.equal(percentile([40,10,30,20],0.5),20);
  assert.equal(percentile([40,10,30,20],0.95),40);
  assert.equal(percentile([40,10,30,20],0.99),40);
  assert.equal(percentile([],0.5),null);
});

async function withServer(responder,run){
  const requests=[];
  const server=http.createServer((req,res)=>{
    requests.push({method:req.method,url:req.url,authorization:req.headers.authorization,
      cookie:req.headers.cookie});
    responder(req,res);
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  try{return await run(base,requests);}
  finally{await new Promise(resolve=>server.close(resolve));}
}
test('UX59.39 sends bounded anonymous GET requests to local WordSky static paths',async()=>{
  await withServer((_req,res)=>{
    res.writeHead(200,{'content-type':'text/html'});
    res.end('local fixture');
  },async(base,requests)=>{
    const report=await runBoundedLoad({base,requests:20,concurrency:4,rps:25});
    assert.equal(report.requests,20);
    assert.equal(report.errors,0);
    assert.equal(report.errorRate,0);
    assert.equal(report.statuses['200'],20);
    assert.ok(report.maxInFlight<=4);
    assert.ok(report.p50Ms>=0&&report.p95Ms>=report.p50Ms);
    assert.ok(report.p99Ms>=report.p95Ms);
    assert.ok(report.throughputRps>0);
    assert.equal(requests.length,20);
    assert.deepEqual(new Set(requests.map(r=>r.url)),new Set(STATIC_PATHS));
    for(const item of requests){
      assert.equal(item.method,'GET');
      assert.equal(item.authorization,undefined);
      assert.equal(item.cookie,undefined);
    }
  });
});
test('UX59.39 reports non-200 errors instead of mislabeling them as success',async()=>{
  await withServer((req,res)=>{
    res.writeHead(req.url==='/verbs.html'?503:200);
    res.end('fixture');
  },async(base)=>{
    const report=await runBoundedLoad({base,requests:10,concurrency:2,rps:25});
    assert.equal(report.errors,2);
    assert.equal(report.errorRate,20);
    assert.equal(report.statuses['503'],2);
    assert.equal(report.statuses['200'],8);
  });
});
