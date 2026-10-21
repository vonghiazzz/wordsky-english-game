import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'vocab/cefr-provisional.json'),'utf8'));
const seed=JSON.parse(fs.readFileSync(path.join(root,'db/seed-vocabulary.json'),'utf8'));
test('CEFR drafts remain provisional and inside original 26 topics',()=>{
 assert.equal(Object.keys(seed).length,26);
 assert.equal(source.records.length,117);
 assert.equal(new Set(source.records.map(x=>x.topic)).size,26);
 const seen=new Set();
 for(const c of source.records){
  assert.equal(c.review_status,'PROVISIONAL');
  assert.ok(Object.hasOwn(seed,c.topic));
  assert.ok(['A2','B1','B2','C1','C2'].includes(c.level));
  const key=c.topic+'::'+c.english.toLowerCase();assert.ok(!seen.has(key));seen.add(key);
  assert.ok(!seed[c.topic].some(x=>x[0].toLowerCase()===c.english.toLowerCase()),'do not overlap existing words in the same topic');
 }
});
test('dry run does not require or touch a database',()=>{
 const r=spawnSync(process.execPath,['scripts/import-cefr-approved.js'],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/DRY RUN/);assert.match(r.stdout,/"approved": 0/);
});
test('test-only fixture refuses preview and plain dry-run',()=>{
 const tmp=path.join(root,'dev/wordsky-v6-test/fixture.test-only.json');
 if(!fs.existsSync(tmp))return; // generated dynamically by local smoke script
 const r=spawnSync(process.execPath,['scripts/import-cefr-approved.js',`--file=${tmp}`],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});
 assert.notEqual(r.status,0);
});

test('all 26 topics included in review queue: 260 originals UNREVIEWED and 117 drafts PROVISIONAL',()=>{
 const queue=JSON.parse(fs.readFileSync(path.join(root,'vocab/cefr-review-all-topics.json'),'utf8'));
 assert.equal(queue.records.length,377);
 assert.equal(new Set(queue.records.map(x=>x.topic)).size,26);
 assert.equal(queue.records.filter(x=>x.review_status==='UNREVIEWED').length,260);
 assert.equal(queue.records.filter(x=>x.review_status==='PROVISIONAL').length,117);
 for(const topic of Object.keys(seed)){
  const legacy=queue.records.filter(x=>x.topic===topic&&x.review_status==='UNREVIEWED');
  assert.equal(legacy.length,seed[topic].length);
  assert.ok(legacy.every(x=>x.level===null),'No guessed CEFR for existing original words');
 }
});
test('dry-run of full 26-topic review queue does not approve or touch DB',()=>{
 const a=spawnSync(process.execPath,['scripts/import-cefr-approved.js','--file=vocab/cefr-review-all-topics.json'],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});
 assert.equal(a.status,0,a.stderr);
 assert.match(a.stdout,/"records": 377/);assert.match(a.stdout,/"approved": 0/);assert.match(a.stdout,/DRY RUN/);
});
test('cannot mark candidate APPROVED without reviewer and source metadata',()=>{
 const f=path.join(root,'vocab/cefr-provisional.json');
 const data=JSON.parse(fs.readFileSync(f,'utf8'));
 data.records=[{...data.records[0],review_status:'APPROVED'}];
 const temporary=path.join(root,'vocab/.cefr-test-temp.json');
 try{
  fs.writeFileSync(temporary,JSON.stringify(data));
  const a=spawnSync(process.execPath,['scripts/import-cefr-approved.js',`--file=${temporary}`],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8'});
  assert.notEqual(a.status,0);assert.match(a.stderr,/reviewed_by/);
 }finally{fs.rmSync(temporary,{force:true})}
});
