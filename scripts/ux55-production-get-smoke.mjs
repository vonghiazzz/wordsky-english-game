/**
 * UX55 public-production GET-only smoke.
 * No cookies, secrets, auth tokens, POSTs, DB operations or user progress writes.
 * Validates the deployed public service, NOT an interactive visual QA signoff.
 */
import assert from 'node:assert/strict';

const origin='https://wordsky-english-game.vercel.app';
const maxBytes=2_000_000;
async function readPublic(path,{type='text',max=maxBytes}={}){
  assert.ok(/^\/[a-zA-Z0-9/_-]*(?:\.[a-z]+)?$/.test(path),'Invalid GET path');
  let last;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      const url=new URL(path,origin);
      const response=await fetch(url,{
        method:'GET',redirect:'manual',
        signal:AbortSignal.timeout(15000),
        headers:{accept:type==='json'?'application/json':'text/html, text/javascript, */*'}
      });
      assert.equal(response.status,200,path+' returned HTTP '+response.status);
      const mime=response.headers.get('content-type')||'';
      assert.match(mime,type==='json'?/application\/json/i:type==='css'?/text\/css/i:/text\/html|javascript/i,path+' unexpected MIME '+mime);
      const raw=await response.text();
      assert.ok(raw.length>0&&raw.length<=max,path+' response empty or too large');
      return type==='json'?JSON.parse(raw):raw;
    }catch(error){
      last=error;
      if(attempt===2)throw Error(path+' GET failed: '+error.message,{cause:error});
    }
  }
  throw last;
}
// UX59.7 checks the actual public domain, not just a READY Git deployment.
// A stale alias must fail this smoke even if GitHub/Vercel builds succeeded.
const progress=await readPublic('/progress.html');
assert.match(progress,/id="ws24Srs"/,'My Learning SRS panel missing on production domain');
assert.match(progress,/\/ux24-srs-panel\.js/,'SRS panel entrypoint missing on production domain');
const panelJs=await readPublic('/ux24-srs-panel.js');
assert.match(panelJs,/export function srsDueBreakdown\(/,'UX59.4 account totals absent on public domain');
assert.match(panelJs,/export function srsVisibleRows\(/,'UX59.5 account refresh guard absent on public domain');
assert.match(panelJs,/srsDueLabel\(/,'UX59.3 due label absent on public domain');
const panelCss=await readPublic('/ux24-srs-panel.css',{type:'css'});
assert.match(panelCss,/ws59-due-label/,'UX59.3 overdue badge stylesheet absent');
assert.match(panelCss,/#ws24Count/,'UX59.4 mobile summary stylesheet absent');

const page=await readPublic('/verbs.html');
assert.match(page,/id="ws54Level"/,'CEFR selector missing');
assert.match(page,/<option value="A1"/,'A1 option missing');
for(const level of ['A2','B1','B2','C1']){
  assert.match(page,new RegExp('<option value="'+level+'" disabled>'),level+' must remain disabled');
}
assert.match(page,/id="ws48Start"/,'Verb practice start button missing');
const js=await readPublic('/verbs.js');
assert.match(js,/function refreshQuizAvailability\(/,'CEFR quiz availability gate missing');
assert.match(js,/ws54Level\.addEventListener\('change'/,'CEFR change handler missing');
const health=await readPublic('/api/health',{type:'json'});
assert.equal(health.ok,true,'API health not OK');
const topics=await readPublic('/api/topics',{type:'json'});
assert.ok(Array.isArray(topics.topics)&&topics.topics.length>0,'No public topics');
const vocab=await readPublic('/api/learning/vocabulary',{type:'json'});
assert.equal(vocab.scope,'catalog');
assert.ok(Array.isArray(vocab.words)&&vocab.words.length>0,'No public vocabulary');
assert.ok(vocab.words.every(w=>typeof w.english==='string'&&typeof w.meaning==='string'),'Vocabulary fields invalid');
console.log(JSON.stringify({
  result:'PASS_READ_ONLY_PUBLIC_PRODUCTION',
  checked:['/progress.html','/ux24-srs-panel.js','/ux24-srs-panel.css','/verbs.html','/verbs.js','/api/health','/api/topics','/api/learning/vocabulary'],
  topics:topics.topics.length,
  vocabulary:vocab.words.length,
  note:'Counts are observations only; no CEFR approval, user history or interactive browser acceptance asserted.'
}));
