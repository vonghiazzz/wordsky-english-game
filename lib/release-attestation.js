// UX59.10: public, read-only deployment identity. Git metadata is provided by
// Vercel at runtime, not by a client header or a file shared across builds.
const SHA=/^[0-9a-f]{40}$/;
export function releaseIdentity(env={}){
 const sha=String(env.VERCEL_GIT_COMMIT_SHA||'').toLowerCase();
 const ref=String(env.VERCEL_GIT_COMMIT_REF||'');
 const target=String(env.VERCEL_ENV||'');
 if(!SHA.test(sha)||!['preview','production'].includes(target)||!ref||
    (target==='production'&&ref!=='main'))return null;
 return {commit_sha:sha,git_ref:ref,environment:target};
}
export function expectedReleaseIdentity(payload,sha){
 if(!SHA.test(String(sha||'')))throw Error('Invalid expected release SHA');
 if(!payload||payload.commit_sha!==sha||payload.environment!=='production'||payload.git_ref!=='main')
  throw Error('Production release commit mismatch or missing attestation');
 return true;
}
