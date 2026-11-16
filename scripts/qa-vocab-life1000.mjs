/*
 * Read-only WordSky LIFE-1000 QA. Uses repository public seed + existing
 * provisional drafts ONLY, never live user/Production vocabulary or DB.
 *
 * Usage:
 *   node scripts/qa-vocab-life1000.mjs
 *   node scripts/qa-vocab-life1000.mjs --file=vocab/batches/LIFE-01.json
 */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 validateLife1000Roadmap,validateLife1000Candidates
} from '../lib/vocab-life1000-gate.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=relative=>JSON.parse(readFileSync(resolve(root,relative),'utf8'));
const roadmap=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const drafts=read('vocab/cefr-provisional.json').records;
const plan=validateLife1000Roadmap(roadmap,seed);
const args=process.argv.slice(2);
if(args.length>1)throw Error('Only one offline --file argument is allowed');
console.log('LIFE-1000 roadmap QA (read-only, NO IMPORT)');
console.log(JSON.stringify(plan,null,2));
if(args.length){
 const arg=args[0];
 if(!/^--file=vocab\/batches\/LIFE-(0[1-9]|10)\.json$/.test(arg))
  throw Error('Candidate must be a repository-local LIFE-NN JSON under vocab/batches');
 const relative=arg.slice('--file='.length);
 const batch=read(relative);
 const batchDir=resolve(root,'vocab/batches');
 const priorRecords=[];
 if(existsSync(batchDir)){
  for(const file of readdirSync(batchDir).sort()){
   if(!/^LIFE-(0[1-9]|10)\.json$/.test(file)||file===relative.split('/').pop())continue;
   const previous=read(join('vocab/batches',file));
   if(!previous||previous.status!=='DRAFT'||!Array.isArray(previous.records))
    throw Error('Malformed prior batch: '+file);
   priorRecords.push(...previous.records);
  }
 }
 const report=validateLife1000Candidates({roadmap,seed,drafts,priorRecords,batch});
 console.log('PROVISIONAL CANDIDATES ONLY — reviewer signoff still required');
 console.log(JSON.stringify(report,null,2));
}
console.log('PASS: offline contract; no topic creation, no approval and no deployment');
