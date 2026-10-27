// UX-24E release flags: a Production deploy or a Preview flag must NOT
// unlock account SRS. The owner must separately approve BOTH Production
// switches after database migration, backfill and authenticated QA.
// No Production SRS variable is set by this repository.
export function srsEnabled(env=process.env){
 if(env.VERCEL_ENV==='production')
  return env.WORDSKY_SRS_PRODUCTION_ENABLED==='true'&&
    env.WORDSKY_SRS_PRODUCTION_SHADOW_ENABLED==='true';
 return env.WORDSKY_SRS_PREVIEW_ENABLED==='true';
}
export function srsScheduleWritesEnabled(env=process.env){
 if(env.VERCEL_ENV==='production')return srsEnabled(env);
 return env.WORDSKY_SRS_SHADOW_ENABLED==='true';
}
