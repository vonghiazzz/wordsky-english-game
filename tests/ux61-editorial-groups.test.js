/* UX61.7 display-only comparison of temporarily held ambiguous cues.
 * Synthetic fixtures; no network, SQL, accounts or SRS mutation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPendingEditorialCards,normalizeEditorialCue} from '../public/ux61-editorial-groups.js';

const examples=[
 ['Numbers - Số đếm','five','ＮĂＭ','She has five books.'],
 ['Time & Dates - Thời gian','year',' Năm  ','I learn English this year.'],
 ['School - Trường học','assess','đánh giá','The teacher will assess our progress.'],
 ['School - Trường học','evaluate','ĐÁNH GIÁ','We must evaluate the results carefully.'],
 ['Adjectives - Tính từ','significant','đáng kể','There was a significant improvement.'],
 ['Adjectives - Tính từ','substantial','ĐÁNG KỂ','The team made substantial progress.'],
].map(([topic,english,meaning,example],i)=>({
 id:'ux61-7-'+i,source:'shared',topic,english,meaning,example
}));

test('UX61.7 groups six protected rows into three Vietnamese cues, preserving source examples',()=>{
 const original=structuredClone(examples);
 const groups=groupPendingEditorialCards(examples);
 assert.deepEqual(groups.map(g=>g.cue),['năm','đánh giá','đáng kể']);
 assert.deepEqual(groups.map(g=>g.words.map(w=>w.english)),[
  ['five','year'],['assess','evaluate'],['significant','substantial']
 ]);
 assert.deepEqual(groups.flatMap(g=>g.words.map(w=>w.example)),examples.map(x=>x.example));
 assert.deepEqual(examples,original,'Rendering helper must never mutate queue rows');
 assert.equal(normalizeEditorialCue('  ＮĂＭ  '),'năm');
});

test('UX61.7 never groups personal words or unrelated shared vocabulary into held references',()=>{
 const extra=[
  {id:'new-1',source:'personal',topic:'School',english:'assess',meaning:'đánh giá'},
  {id:'new-2',source:'shared',topic:'School',english:'grade',meaning:'đánh giá'},
  {id:'new-3',source:'shared',topic:'Nature',english:'habitat',meaning:'môi trường sống'},
  {id:'new-4',source:'shared',topic:'School',english:'evaluate',meaning:' '},
 ];
 const groups=groupPendingEditorialCards([...examples,...extra]);
 assert.equal(groups.reduce((n,g)=>n+g.words.length,0),6);
 assert.deepEqual(groupPendingEditorialCards(null),[]);
 assert.deepEqual(groupPendingEditorialCards([]),[]);
});

test('UX61.7 a single held card can be viewed without inventing its counterpart',()=>{
 const rows=groupPendingEditorialCards([examples[2]]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].words.length,1);
 assert.equal(rows[0].words[0].english,'assess');
});
