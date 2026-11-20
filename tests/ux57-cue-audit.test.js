import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditSharedCueCollisions} from '../scripts/audit-ux57-cues.mjs';
import {gradeRecall} from '../public/ux28-practice-core.js';

const realStyleFixture=[
 {id:'five-1',english:'five',meaning:'Năm',topic:'Numbers'},
 {id:'year-2',english:'year',meaning:' năm ',topic:'Time & Dates'},
 {id:'assess-3',english:'assess',meaning:'đánh giá',topic:'School'},
 {id:'evaluate-4',english:'evaluate',meaning:'ĐÁNH   GIÁ',topic:'School'},
 {id:'significant-5',english:'significant',meaning:'đáng kể',topic:'Adjectives'},
 {id:'substantial-6',english:'substantial',meaning:'ĐÁNG  KỂ',topic:'Adjectives'},
 {id:'habitat-7',english:'habitat',meaning:'môi trường sống tự nhiên',topic:'Animals'},
 {id:'habitat-8',english:'habitat',meaning:'môi trường sống',topic:'Nature'},
];

test('UX57 editorial offline audit detects exactly three ambiguous VI cue groups and six cards',()=>{
 const report=auditSharedCueCollisions({words:realStyleFixture,scope:'public-vocabulary'});
 assert.equal(report.eligible_shared_words,8);
 assert.equal(report.ambiguous_cue_groups,3);
 assert.equal(report.affected_cards,6);
 assert.deepEqual(report.collisions.map(g=>g.vietnamese_cue),
  ['năm','đáng kể','đánh giá'].sort());
 const pairs=report.collisions.map(g=>g.cards.map(c=>c.english).sort().join('/'));
 assert.deepEqual(pairs.sort(),['five/year','assess/evaluate','significant/substantial'].sort());
 assert.ok(!report.collisions.flatMap(g=>g.cards).some(c=>c.english==='habitat'),
  'Repeated English headword with distinct meanings is not a same-cue alternative');
});

test('UX57 accepts actual public vocabulary API word_id format',()=>{
 const publicRows=realStyleFixture.map(({id,...rest})=>({word_id:id,...rest}));
 const report=auditSharedCueCollisions({scope:'public-vocabulary',words:publicRows});
 assert.equal(report.eligible_shared_words,8);
 assert.equal(report.ambiguous_cue_groups,3);
 assert.equal(report.affected_cards,6);
 assert.deepEqual(report,
  auditSharedCueCollisions({words:realStyleFixture}));
});

test('UX57 audit has deterministic order independent of input order and formatting',()=>{
 const a=auditSharedCueCollisions(realStyleFixture);
 const b=auditSharedCueCollisions([...realStyleFixture].reverse());
 assert.deepEqual(a,b);
 assert.equal(a.ambiguous_cue_groups,3);
});

test('UX57 offline audit excludes disabled and personal words; does not expose user data',()=>{
 const fixture=[...realStyleFixture,
  {id:'private-9',source:'personal',english:'hidden',meaning:'năm',user_id:'user-secret'},
  {id:'disabled-10',english:'hidden2',meaning:'năm',enabled:false},
  {id:'hidden-topic',english:'hidden3',meaning:'năm',topic_enabled:false},
 ];
 const report=auditSharedCueCollisions(fixture);
 assert.equal(report.skipped_rows,3);
 assert.equal(report.eligible_shared_words,8);
 assert.equal(report.affected_cards,6);
 const printable=JSON.stringify(report);
 assert.equal(printable.includes('user-secret'),false);
 assert.equal(printable.includes('private-9'),false);
});

test('UX57 audit fails closed on malformed and duplicate public records',()=>{
 assert.throws(()=>auditSharedCueCollisions({wrong:[]}),/Expected JSON array/);
 assert.throws(()=>auditSharedCueCollisions([null]),/Invalid vocabulary/);
 assert.throws(()=>auditSharedCueCollisions([{id:'x',meaning:'năm'}]),/Missing word_id\/id/);
 assert.throws(()=>auditSharedCueCollisions([realStyleFixture[0],realStyleFixture[0]]),/Duplicate public word ID/);
 assert.throws(()=>auditSharedCueCollisions([{...realStyleFixture[0],word_id:'different'}]),/Conflicting word_id/);
});

test('UX57 confirms exact-match typed recall does not automatically accept ambiguous English alternatives',()=>{
 assert.equal(gradeRecall('year','five').correct,false);
 assert.equal(gradeRecall('evaluate','assess').correct,false);
 assert.equal(gradeRecall('substantial','significant').correct,false);
 assert.equal(gradeRecall('ASsEss','assess').correct,true);
});

test('UX57 offline CLI reports ambiguities and optional editorial-release gate',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wordsky-ux57-'));
 try{
  const file=join(dir,'public-vocabulary.json');
  writeFileSync(file,JSON.stringify({words:realStyleFixture}));
  const script=new URL('../scripts/audit-ux57-cues.mjs',import.meta.url).pathname;
  const cmd=process.execPath;
  const result=spawnSync(cmd,[script,'--input',file],{encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).ambiguous_cue_groups,3);
  const strict=spawnSync(cmd,[script,'--input',file,'--fail-on-collisions'],
   {encoding:'utf8',timeout:15000});
  assert.equal(strict.status,2);
  assert.equal(JSON.parse(strict.stdout).affected_cards,6);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
