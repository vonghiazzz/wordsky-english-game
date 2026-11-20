// UX57 P0: offline, account-free, deterministic collision audit for shared
// vocabulary used as Vietnamese-to-English typed recall prompts.
// No network/database access or SRS policy changes.
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const compare=(a,b)=>a<b?-1:a>b?1:0;
const text=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/gu,' ');
const normalizeCue=value=>text(value).toLocaleLowerCase('vi');
const normalizeEnglish=value=>text(value).toLocaleLowerCase('en-US');

export function auditSharedCueCollisions(payload){
 const rows=Array.isArray(payload)?payload:payload?.words;
 if(!Array.isArray(rows))throw new TypeError('Expected JSON array or public vocabulary payload with words array');
 const byCue=new Map(),ids=new Set();
 let eligible=0,skipped=0;
 for(const [index,row] of rows.entries()){
  if(!row||typeof row!=='object'||Array.isArray(row))
   throw new TypeError('Invalid vocabulary record at position '+index);
  // Never include personal vocabulary or disabled entries in a public
  // editorial report. This tool must NOT ingest authenticated user history.
  if(row.enabled===false||row.topic_enabled===false||
     (row.source!==undefined&&row.source!=='shared')){
   skipped++;continue;
  }
  if(typeof row.id!=='string'||!row.id.trim()||
     typeof row.english!=='string'||typeof row.meaning!=='string')
   throw new TypeError('Missing id, english or meaning at position '+index);
  const cue=normalizeCue(row.meaning),en=normalizeEnglish(row.english);
  if(!cue||!en){skipped++;continue;}
  const id=row.id.trim();
  if(ids.has(id))throw new Error('Duplicate public word ID in input');
  ids.add(id);eligible++;
  const words=byCue.get(cue)||[];
  words.push({id,english:text(row.english),english_key:en,
   topic:typeof row.topic==='string'?text(row.topic):''});
  byCue.set(cue,words);
 }
 const collisions=[];
 for(const [cue,words] of byCue){
  if(new Set(words.map(w=>w.english_key)).size<2)continue;
  const entries=words.sort((a,b)=>compare(a.english_key,b.english_key)||compare(a.id,b.id))
   .map(({id,english,topic})=>({id,english,topic}));
  collisions.push({vietnamese_cue:cue,distinct_english:
   new Set(words.map(w=>w.english_key)).size,cards:entries});
 }
 collisions.sort((a,b)=>compare(a.vietnamese_cue,b.vietnamese_cue));
 return {policy:'ux57-offline-ambiguous-cue-v1',
  input_rows:rows.length,eligible_shared_words:eligible,skipped_rows:skipped,
  ambiguous_cue_groups:collisions.length,
  affected_cards:collisions.reduce((total,g)=>total+g.cards.length,0),
  collisions};
}

async function main(args){
 if(args.length<2||args[0]!=='--input'||!args[1]||
     args.some((x,i)=>i>1&&x!=='--fail-on-collisions'))
  throw Error('Usage: node scripts/audit-ux57-cues.mjs --input public-words.json [--fail-on-collisions]');
 const path=resolve(args[1]);
 const {size}=await stat(path);
 if(size>16*1024*1024)throw Error('Vocabulary fixture is too large (16MB max)');
 const report=auditSharedCueCollisions(JSON.parse(await readFile(path,'utf8')));
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(args.includes('--fail-on-collisions')&&report.ambiguous_cue_groups)process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 main(process.argv.slice(2)).catch(e=>{
  console.error('UX57 offline cue audit failed: '+e.message);
  process.exitCode=1;
 });
