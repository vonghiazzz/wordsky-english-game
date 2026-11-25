// UX59.14 production guest QA. Read-only, no credentials and no user mutations.
import assert from 'node:assert/strict';

export const publicOrigin='https://wordsky-english-game.vercel.app';
export const protectedPaths=Object.freeze([
 '/api/learning/srs/queue?status=due&page=0&size=1',
 '/api/learning/daily-activity',
 '/api/learning/insights'
]);
async function getJSON(path,{fetcher=fetch,origin=publicOrigin}={}){
 assert.equal(origin,publicOrigin,'Production origin must be fixed');
 assert.ok(path==='/api/auth/me'||protectedPaths.includes(path),'Unapproved QA route');
 const response=await fetcher(origin+path,{
  method:'GET',redirect:'manual',cache:'no-store',
  headers:{accept:'application/json','Cache-Control':'no-store'},
  signal:AbortSignal.timeout(15000)
 });
 assert.ok([200,401,403,404].includes(response.status),path+' unexpected status '+response.status);
 const mime=response.headers.get('content-type')||'';
 assert.match(mime,/application\/json/i,path+' must be JSON');
 const data=await response.json();
 assert.ok(data&&typeof data==='object'&&!Array.isArray(data),'Invalid response shape');
 return {status:response.status,data};
}
export async function assertGuestIsolation(options={}){
 const session=await getJSON('/api/auth/me',options);
 assert.equal(session.status,200,'Anonymous auth state unavailable');
 assert.equal(session.data.actor,null,'Guest request unexpectedly authenticated');
 const results=[];
 for(const path of protectedPaths){
  const response=await getJSON(path,options);
  assert.ok([401,403,404].includes(response.status),path+' exposed private data to guest');
  assert.equal(typeof response.data.error,'string',path+' missing safe API error');
  assert.ok(!Object.hasOwn(response.data,'words')&&!Object.hasOwn(response.data,'actor_id'),
   path+' leaked account data');
  results.push({path,status:response.status});
 }
 return {result:'PASS_PRODUCTION_GUEST_ISOLATION',auth_status:session.status,protected_routes:results,
  note:'No credentials, cookies, POST requests or production data writes'};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 console.log(JSON.stringify(await assertGuestIsolation()));
}
