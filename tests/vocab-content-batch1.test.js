import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const seed=JSON.parse(readFileSync(new URL('../db/seed-vocabulary.json',import.meta.url),'utf8'));
const expectedBatch={
 'Daily Life':['wash dishes','get dressed','take a shower','set the table'],
 'Food':['vegetable','cheese','sandwich','noodles'],
 'School - Trường học':['textbook','dictionary','classmate','timetable'],
 'Travel - Du lịch':['boarding pass','luggage','destination','departure'],
 'Technology - Công nghệ':['charger','battery','browser','attachment']
};
const norm=value=>String(value).normalize('NFKC').trim().replace(/\s+/gu,' ');
const vi=value=>norm(value).toLocaleLowerCase('vi');
const en=value=>norm(value).toLocaleLowerCase('en');

test('Vocabulary Batch 1 appends exactly 20 cards to five existing topics',()=>{
 const topics=Object.entries(seed);
 assert.equal(topics.length,26);
 assert.equal(topics.reduce((sum,[,cards])=>sum+cards.length,0),280);
 for(const [topic,cards] of topics){
  assert.equal(cards.length,topic in expectedBatch?14:10,
   'Unexpected card count for '+topic);
 }
 for(const [topic,answers] of Object.entries(expectedBatch)){
  assert.ok(Array.isArray(seed[topic]),topic);
  assert.deepEqual(seed[topic].slice(-4).map(card=>card[0]),answers);
  assert.equal(new Set(answers).size,4);
 }
});

test('Batch 1 preserves old entries, exact tuple schema and no duplicate English across catalog',()=>{
 const english=new Set(),pairs=new Set();
 for(const [topic,cards] of Object.entries(seed)){
  for(const card of cards){
   assert.ok(Array.isArray(card)&&card.length===5,topic);
   for(const [i,value] of card.entries()){
    assert.equal(typeof value,'string');
    assert.ok(norm(value).length>0,'Blank field '+topic+' '+i);
    assert.ok(value.length<500,'Oversized field '+topic+' '+i);
    assert.doesNotMatch(value,/[\u0000-\u001f\u007f]/u);
   }
   const key=en(card[0]),localKey=topic+'\0'+key;
   assert.equal(english.has(key),false,'Duplicate English: '+key);
   assert.equal(pairs.has(localKey),false,'Duplicate topic/word: '+localKey);
   english.add(key);pairs.add(localKey);
  }
 }
 assert.equal(english.size,280);
});

test('Batch 1 does not introduce a new ambiguous Vietnamese cue',()=>{
 const byCue=new Map();
 for(const rows of Object.values(seed)){
  for(const [english,,meaning] of rows){
   const cue=vi(meaning);
   if(!byCue.has(cue))byCue.set(cue,new Set());
   byCue.get(cue).add(en(english));
  }
 }
 const conflicts=[...byCue].filter(([,answers])=>answers.size>1);
 assert.deepEqual(conflicts.map(([cue,answers])=>[cue,[...answers].sort()]),
  [['năm',['five','year']]]);
 for(const [topic,added] of Object.entries(expectedBatch)){
  for(const english of added){
   const row=seed[topic].find(r=>r[0]===english);
   assert.ok(row,english);
   assert.equal(byCue.get(vi(row[2])).size,1);
  }
 }
});

test('Batch 1 avoids answer leaks in the newly added Vietnamese meaning',()=>{
 for(const [topic,words] of Object.entries(expectedBatch)){
  for(const english of words){
   const word=seed[topic].find(row=>row[0]===english);
   assert.ok(word);
   assert.equal(vi(word[2]).includes(en(english)),false,
    'English clue leaked in '+topic+': '+english);
   assert.equal(vi(word[3]).length>0,true);
   assert.equal(vi(word[4]).length>0,true);
  }
 }
});

test('Batch 1 content changes do not update existing seed words on repeat import',()=>{
 const seedScript=readFileSync(new URL('../scripts/seed.js',import.meta.url),'utf8');
 assert.match(seedScript,/ON CONFLICT\(topic_id,english\) DO NOTHING/);
 assert.doesNotMatch(seedScript,/DELETE FROM ws_words|TRUNCATE ws_words/i);
});

test('Batch 1 does not overlap pre-existing PROVISIONAL CEFR drafts',()=>{
 const drafts=JSON.parse(readFileSync(new URL('../vocab/cefr-provisional.json',import.meta.url),'utf8'));
 const draftKeys=new Set(drafts.records.map(c=>c.topic+'\0'+en(c.english)));
 for(const [topic,rows] of Object.entries(seed))
  for(const row of rows)
   assert.equal(draftKeys.has(topic+'\0'+en(row[0])),false,
    'No seed/CEFR draft overlap: '+topic+' / '+row[0]);
});
