/*
 * Read-only WordSky LIFE-1000 QA. Uses repository public seed + existing
 * provisional drafts ONLY, never live user/Production vocabulary or DB.
 *
 * npm run vocab:plan automatically validates every saved LIFE-NN JSON batch.
 * Optional --file=vocab/batches/LIFE-01.json validates one file explicitly.
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
const dir=resolve(root,'vocab/batches');
const validName=/^LIFE-(0[1-9]|10)\.json$/;
const stored=existsSync(dir)?readdirSync(dir).filter(name=>name.endsWith('.json')).sort():[];
if(stored.some(name=>!validName.test(name)))
 throw Error('Unexpected JSON in vocab/batches; only LIFE-01..10.json allowed');
console.log('LIFE-1000 roadmap QA (read-only, NO IMPORT)');
console.log(JSON.stringify(plan,null,2));

const requested=args.length?args[0]:null;
let selected=stored;
if(requested!==null){
 if(!/^--file=vocab\/batches\/LIFE-(0[1-9]|10)\.json$/.test(requested))
  throw Error('Candidate must be a repository-local LIFE-NN JSON under vocab/batches');
 const name=requested.slice('--file=vocab/batches/'.length);
 if(!stored.includes(name))throw Error('Requested candidate file does not exist: '+name);
 selected=[name];
}
const files=new Map(stored.map(name=>[name,read(join('vocab/batches',name))]));
for(const name of selected){
 const batch=files.get(name);
 const priorRecords=[];
 for(const [other,data] of files){
  if(other===name)continue;
  if(!data||data.status!=='DRAFT'||!Array.isArray(data.records))
   throw Error('Malformed other batch: '+other);
  priorRecords.push(...data.records);
 }
 const report=validateLife1000Candidates({roadmap,seed,drafts,priorRecords,batch});
 console.log('PROVISIONAL CANDIDATES ONLY — reviewer signoff still required: '+name);
 console.log(JSON.stringify(report,null,2));
}
console.log('PASS: '+selected.length+' saved batch(es) structurally checked; no topic creation, no approval and no deployment');
