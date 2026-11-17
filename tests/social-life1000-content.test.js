import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const norm=s=>String(s??'').normalize('NFKC').trim().toLowerCase().replace(/[’]/gu,"'")
 .replace(/[?!.,]+$/gu,'').replace(/\s+/gu,' ');
const ids=Array.from({length:10},(_,i)=>'SOCIAL-'+String(i+1).padStart(2,'0'));
const drafts=ids.map(id=>read('vocab/batches/'+id+'.json'));
const all=drafts.flatMap(d=>d.records);

test('SOCIAL-1000: ten original editorial drafts with exactly 100 records each',()=>{
 assert.equal(drafts.length,10);
 for(const [i,d] of drafts.entries()){
  assert.equal(d.batch_id,ids[i]);
  assert.equal(d.status,'DRAFT');
  assert.equal(d.records.length,100);
 }
 assert.equal(all.length,1000);
});

test('SOCIAL-1000: every English text and Vietnamese cue is unique within expansion',()=>{
 const en=new Set(),vi=new Set();
 for(const r of all){
  const k=norm(r.english),v=norm(r.meaning);
  assert.ok(!en.has(k),'duplicate English: '+r.english);
  assert.ok(!vi.has(v),'duplicate Vietnamese cue: '+r.meaning);
  en.add(k);vi.add(v);
 }
 assert.equal(en.size,1000);
 assert.equal(vi.size,1000);
});

test('SOCIAL-1000: does not duplicate original WordSky seed, legacy drafts or LIFE-01..07',()=>{
 const seed=read('db/seed-vocabulary.json');
 const old=Object.values(seed).flatMap(cards=>cards.map(c=>({english:c[0],meaning:c[1]})))
  .concat(read('vocab/cefr-provisional.json').records)
  .concat(ids.slice(0,7).flatMap((_,i)=>read('vocab/batches/LIFE-'+String(i+1).padStart(2,'0')+'.json').records))
  .concat(read('vocab/cefr-approved-editorial-27.json').records);
 const en=new Set(old.map(r=>norm(r.english))),vi=new Set(old.map(r=>norm(r.meaning)));
 for(const r of all){
  assert.ok(!en.has(norm(r.english)),'existing English: '+r.english);
  assert.ok(!vi.has(norm(r.meaning)),'existing Vietnamese cue: '+r.english);
 }
});

test('SOCIAL-1000: WordSky schema and player-facing utterance length safety',()=>{
 const validLevels=new Set(['A1','A2','B1','B2','C1','C2']);
 for(const r of all){
  for(const name of ['topic','english','meaning','example','translation','group_id','level','part_of_speech','source_url','source_note']){
   assert.ok(typeof r[name]==='string'&&r[name].trim(),'missing '+name+' on '+r.english);
  }
  assert.ok(r.english.length<=80,'English too long: '+r.english);
  assert.ok(r.meaning.length<=180,'Vietnamese too long: '+r.english);
  assert.ok(r.example.length<=250,'Example too long: '+r.english);
  assert.ok(r.translation.length<=250,'Translation too long: '+r.english);
  assert.ok(r.english.trim().split(/\s+/u).length>=2,'not a complete phrase: '+r.english);
  assert.ok(validLevels.has(r.level),'invalid suggested level: '+r.english);
  assert.match(r.example,/^[\s\S]+[.?!]$/u);
  assert.match(r.translation,/^[\s\S]+[.?!]$/u);
  assert.equal(norm(r.example),norm(r.english),'mismatched original utterance: '+r.english);
  assert.equal(norm(r.translation),norm(r.meaning),'mismatched Vietnamese translation: '+r.english);
  assert.ok(r.source_url.startsWith('https://learnenglish.britishcouncil.org/'));
 }
});

test('SOCIAL-1000: every level and IPA is explicitly NOT independently approved',()=>{
 for(const r of all){
  assert.equal(r.review_status,'PROVISIONAL','no fake CEFR approvals');
  assert.equal(r.cefr_evidence_kind,'contextual_inference');
  assert.equal(r.cefr_source_label,null);
  assert.equal(r.editorial_status,'AI_DRAFT_NEEDS_BILINGUAL_REVIEW');
  assert.equal(r.ipa_quality,'PENDING');
  assert.equal(r.ipa,'','never manufacture IPA of a complete utterance');
  assert.ok(!('reviewed_by' in r),'do not invent a reviewer');
  assert.ok(!('reviewed_at' in r),'do not invent a signoff date');
 }
});

test('SOCIAL-1000: ten targeted social and daily-life topics are existing WordSky topics',()=>{
 const expected=[
  'Everyday Conversation - Giao tiếp hằng ngày',
  'Social Relationships - Quan hệ xã hội',
  'Home - Nhà cửa',
  'Shopping - Mua sắm',
  'Restaurant - Nhà hàng',
  'Jobs - Nghề nghiệp',
  'Feelings - Cảm xúc',
  'Travel - Du lịch',
  'Technology - Công nghệ',
  'Daily Life'
 ];
 assert.deepEqual(drafts.map(d=>d.records[0].topic),expected);
 for(let i=0;i<10;i++){
  assert.ok(drafts[i].records.every(r=>r.topic===expected[i]));
 }
});
