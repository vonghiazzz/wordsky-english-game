import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditPublicRecallCues} from '../lib/qa-s1a-recall-cue-audit.js';
import {gradeRecall} from '../public/ux28-practice-core.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/ux57-public-cue-review.json',import.meta.url),'utf8'));
const lexical=fixture.cards.map(({source,topic,english,meaning})=>({source,topic,english,meaning}));

test('UX57 fixture contains only eight public, approved, human-review candidates',()=>{
  assert.equal(fixture.scope,'public-shared-vocabulary-only');
  assert.equal(fixture.status,'REVIEW_REQUIRED_NOT_APPROVED_CORRECTION');
  assert.equal(lexical.length,8);
  assert.ok(fixture.cards.every(x=>x.source==='shared'&&x.review_status==='APPROVED'));
  assert.ok(fixture.cards.every(x=>typeof x.example==='string'&&x.example.length>0));
});

test('UX57 catches all three ambiguous Vietnamese prompts without automatic synonyms',()=>{
  const report=auditPublicRecallCues(lexical);
  assert.deepEqual(report.cue_collisions.map(x=>x.cue),['đáng kể','đánh giá','năm']);
  assert.deepEqual(report.cue_collisions.find(x=>x.cue==='năm').english,['five','year']);
  assert.deepEqual(report.cue_collisions.find(x=>x.cue==='đánh giá').english,['assess','evaluate']);
  assert.deepEqual(report.cue_collisions.find(x=>x.cue==='đáng kể').english,['significant','substantial']);
  assert.equal(report.candidate_flags_are_not_translation_errors,true);
  assert.equal(report.accepted_answer_variants_created,false);
  assert.equal(report.grading_or_srs_changed,false);
});

test('UX57 catches one same-English, multiple-meaning headword across topics',()=>{
  const report=auditPublicRecallCues(lexical);
  assert.equal(report.multiple_meaning_count,1);
  assert.deepEqual(report.multiple_meanings.map(x=>x.english),['habitat']);
  assert.deepEqual(report.multiple_meanings[0].meanings,['môi trường sống','môi trường sống tự nhiên']);
});

test('UX57 review flags do not change strict recall correctness or SRS',()=>{
  for(const [typed,expected] of [
    ['year','five'],['five','year'],
    ['evaluate','assess'],['assess','evaluate'],
    ['substantial','significant'],['significant','substantial']
  ])assert.equal(gradeRecall(typed,expected).correct,false);
  assert.equal(gradeRecall('  FIVE  ','five').correct,true);
});

test('UX57 collision audit remains deterministic across input ordering',()=>{
  const a=auditPublicRecallCues(lexical);
  const b=auditPublicRecallCues([...lexical].reverse());
  assert.deepEqual(a,b);
});
