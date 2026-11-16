/**
 * LIFE-07 editorial inventory audit. No DB/network, no review/approval/import.
 * Usage: node scripts/qa-life07-inventory.mjs
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const load=(p)=>readFileSync(resolve(root,p),'utf8');
const normalize=x=>x.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase();
const fail=m=>{throw new Error('LIFE-07 inventory QA: '+m)};
const doc=load('docs/vocab-life07-editorial-inventory.md');
const roadmap=JSON.parse(load('vocab/life-1000-roadmap.json'));
const seed=JSON.parse(load('db/seed-vocabulary.json'));
const legacy=JSON.parse(load('vocab/cefr-provisional.json')).records;
const groups=roadmap.batches.find(x=>x.id==='LIFE-07')?.groups;
if(!groups||groups.length!==4)fail('roadmap LIFE-07 missing/changed');
const lines=doc.split(/\r?\n/u);
const seen=new Map();
const counts=new Map(groups.map(g=>[g.id,0]));
let group=null;
for(const line of lines){
 const heading=line.match(/^## (symptoms|pharmacy|habits|wellbeing) \(25\)$/u);
 if(heading){group=heading[1];continue}
 if(!/^\| \d+ \|/u.test(line))continue;
 if(!group)fail('entry before group heading');
 const cells=line.split('|').slice(1,-1).map(x=>x.trim());
 if(cells.length!==3||!/^\d+$/u.test(cells[0])||!cells[1]||!cells[2])
  fail('invalid inventory table entry');
 const row=Number(cells[0]);
 const expected=(counts.get(group)||0)+1;
 if(row!==expected)fail('non-consecutive row in '+group);
 counts.set(group,expected);
 const en=normalize(cells[1]),vi=normalize(cells[2]);
 if(seen.has(en))fail('duplicate within inventory: '+en);
 seen.set(en,{group,vi});
}
for(const g of groups){
 if(!counts.has(g.id)||counts.get(g.id)!==25)
  fail('expected 25 entries for '+g.id);
}
if(seen.size!==100)fail('expected exactly 100 distinct items');
const old=[];
for(const rows of Object.values(seed))for(const row of rows)old.push({english:row[0],meaning:row[2]});
old.push(...legacy);
for(let n=1;n<=6;n++){
 const name='vocab/batches/LIFE-'+String(n).padStart(2,'0')+'.json';
 old.push(...JSON.parse(load(name)).records);
}
const oldEnglish=new Set(old.map(x=>normalize(x.english)));
const oldCues=new Map();
for(const x of old){
 const cue=normalize(x.meaning||'');
 if(!oldCues.has(cue))oldCues.set(cue,new Set());
 oldCues.get(cue).add(normalize(x.english));
}
const seenCues=new Map();
for(const [en,r] of seen){
 if(oldEnglish.has(en))fail('duplicate prior English: '+en);
 if(oldCues.has(r.vi)&&[...oldCues.get(r.vi)].some(x=>x!==en))
  fail('Vietnamese cue collision with prior catalog: '+r.vi);
 if(seenCues.has(r.vi)&&seenCues.get(r.vi)!==en)
  fail('Vietnamese cue collision within inventory: '+r.vi);
 seenCues.set(r.vi,en);
}
console.log(JSON.stringify({
 status:'PASS_INVENTORY_ONLY',batch:'LIFE-07',candidates:seen.size,
 group_counts:Object.fromEntries(counts),seed_words:Object.values(seed).flat().length,
 legacy_drafts:legacy.length,prior_batches:6,prior_batch_words:600,
 compared_previous_items:old.length,english_exact_collisions:0,
 vietnamese_exact_cue_collisions:0,ipa_verified:false,cefr_verified:false,
 editorial_review_completed:false,db_checked:false,authorized_to_import:false,
 authorized_to_deploy:false
},null,2));
