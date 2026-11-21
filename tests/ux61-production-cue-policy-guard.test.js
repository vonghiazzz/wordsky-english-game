import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAmbiguousPublicCues,normalizeCue} from '../scripts/ux61-production-cue-policy-guard.mjs';

const rows=[
 ['4b406577-b4d7-43a5-903e-55e734dca399','Numbers - Số đếm','five','Năm'],
 ['81bf2f1f-a7ab-49f7-ac0e-088ea7bee93d','Time & Dates - Thời gian','year','NĂM'],
 ['850c23ad-1d31-4d64-ab9e-7b05744e10f6','School - Trường học','assess','đánh giá'],
 ['b7fb767d-b77c-4911-b45b-c4588747c2bc','School - Trường học','evaluate','ĐÁNH GIÁ'],
 ['ad2b5bf6-dcd1-4232-bfd2-a3765a467ae5','Adjectives - Tính từ','significant','đáng kể'],
 ['91001117-6921-488d-a052-34dbc248e838','Adjectives - Tính từ','substantial','  ĐÁNG KỂ  '],
 ['e9763bad-5abd-4059-af9a-d2eaad58eeec','Animals - Động vật','habitat','môi trường sống tự nhiên'],
 ['3ac5299c-6974-4060-a6b2-ed0577eea9b5','Nature - Thiên nhiên','habitat','môi trường sống'],
 ['cf607cdd-9c54-46d0-85b9-aa55888ac77d','Travel','take off','cất cánh']
].map(([word_id,topic,english,meaning])=>({word_id,topic,english,meaning}));

test('UX61.5 normalized bilingual cue audit matches three protected production collisions',()=>{
 assert.equal(normalizeCue(' ＮĂＭ '),'năm');
 const result=auditAmbiguousPublicCues(rows);
 assert.equal(result.total_words,9);
 assert.equal(result.collision_groups,3);
 assert.equal(result.affected_cards,6);
 assert.deepEqual(result.uncovered,[]);
 assert.deepEqual(result.collisions.map(c=>c.cue).sort(),['năm','đánh giá','đáng kể'].sort());
 assert.ok(result.collisions.every(group=>group.affected.every(card=>card.held)));
});

test('UX61.5 new ambiguous cue must block release until editorial policy handles it',()=>{
 const synthetic=[
  {word_id:'00000000-0000-4000-8000-000000000010',
   topic:'Commerce',english:'purchase',meaning:'mua'},
  {word_id:'00000000-0000-4000-8000-000000000011',
   topic:'Commerce',english:'buy',meaning:'MUA'}
 ];
 const result=auditAmbiguousPublicCues([...rows,...synthetic]);
 assert.equal(result.collision_groups,4);
 assert.equal(result.uncovered.length,2);
 assert.deepEqual(result.uncovered.map(c=>c.english),['purchase','buy']);
});

test('UX61.5 equal English in different topics is not a false ambiguity',()=>{
 const result=auditAmbiguousPublicCues(rows.filter(c=>c.english==='habitat'));
 assert.equal(result.collision_groups,0);
 assert.deepEqual(result.uncovered,[]);
});

test('UX61.5 malformed public cards are rejected before any release decision',()=>{
 assert.throws(()=>auditAmbiguousPublicCues(null),/array/);
 assert.throws(()=>auditAmbiguousPublicCues([{english:'word',meaning:'nghĩa'}]),/invalid/);
});
