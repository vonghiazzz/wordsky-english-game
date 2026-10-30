import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/index.js';
import {isDatabaseTargetConfigured,resolveDatabaseUrl} from '../lib/db-target.js';

const productionRef='ilyhbhoqswsioxxpuvcb';
const isolatedRef='abcdeabcdeabcdeabcde';
const prodUrl=`postgresql://postgres.${productionRef}:synthetic@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
const previewUrl=`postgresql://postgres.${isolatedRef}:synthetic@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
const validPreview={
 VERCEL_ENV:'preview',DATABASE_URL:prodUrl,
 WORDSKY_PREVIEW_DB_REF:isolatedRef,
 WORDSKY_PREVIEW_DATABASE_URL:previewUrl
};

async function requestHealth(testEnv){
 const keys=['VERCEL_ENV','DATABASE_URL','WORDSKY_PREVIEW_DB_REF','WORDSKY_PREVIEW_DATABASE_URL'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const key of keys){
   if(testEnv[key]===undefined)delete process.env[key];
   else process.env[key]=testEnv[key];
  }
  const req={method:'GET',url:'/api/health',query:{rest:'health'},headers:{}};
  const headers={},res={
   statusCode:200,
   setHeader:(key,value)=>{headers[key]=value;},
   end(value){this.body=String(value);}
  };
  await handler(req,res);
  return {status:res.statusCode,headers,body:JSON.parse(res.body)};
 }finally{
  for(const key of keys){
   if(before[key]===undefined)delete process.env[key];
   else process.env[key]=before[key];
  }
 }
}

test('UX37 production health keeps its boolean configured-target contract',async()=>{
 const reply=await requestHealth({VERCEL_ENV:'production',DATABASE_URL:prodUrl});
 assert.equal(reply.status,200);
 assert.deepEqual(reply.body,{ok:true,service:'wordsky-v4',database:true});
 assert.equal(reply.headers['cache-control'],'no-store');
 assert.equal(isDatabaseTargetConfigured({VERCEL_ENV:'production',DATABASE_URL:prodUrl}),true);
 assert.equal(isDatabaseTargetConfigured({VERCEL_ENV:'production'}),false);
});

test('UX37 isolated Preview health reports a verified configured target without DB I/O',async()=>{
 const reply=await requestHealth(validPreview);
 assert.equal(reply.status,200);
 assert.deepEqual(reply.body,{ok:true,service:'wordsky-v4',database:true});
 assert.equal(resolveDatabaseUrl(validPreview),previewUrl);
 assert.equal(isDatabaseTargetConfigured(validPreview),true);
 assert.doesNotMatch(JSON.stringify(reply),/postgresql:|synthetic|pooler/);
});

test('UX37 denied Preview target remains fail-closed while health reports false',async()=>{
 for(const invalid of [
  {VERCEL_ENV:'preview',DATABASE_URL:prodUrl},
  {...validPreview,WORDSKY_PREVIEW_DB_REF:productionRef},
  {...validPreview,WORDSKY_PREVIEW_DATABASE_URL:prodUrl},
  {...validPreview,WORDSKY_PREVIEW_DATABASE_URL:'https://example.com/'},
  {...validPreview,DATABASE_URL:previewUrl+'?application_name=old'}
 ]){
  const reply=await requestHealth(invalid);
  assert.equal(reply.status,200);
  assert.equal(reply.body.database,false);
  assert.equal(reply.body.ok,true);
  assert.equal(isDatabaseTargetConfigured(invalid),false);
  assert.throws(()=>resolveDatabaseUrl(invalid),e=>e.status===503);
 }
});

test('UX37 health returns false when no DB is configured and never claims connectivity',async()=>{
 const reply=await requestHealth({VERCEL_ENV:'preview'});
 assert.equal(reply.status,200);
 assert.equal(reply.body.database,false);
 assert.deepEqual(Object.keys(reply.body).sort(),['database','ok','service']);
 const source=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(source,/database:isDatabaseTargetConfigured\(\)/);
 assert.doesNotMatch(source,/database:!!process\.env\.DATABASE_URL/);
});
