import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 validateLife1000Roadmap,validateLife1000Candidates
} from '../lib/vocab-life1000-gate.js';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const plan=read('vocab/life-1000-roadmap.json');
const seed=read('db/seed-vocabulary.json');
const drafts=read('vocab/cefr-provisional.json').records;
const copy=value=>JSON.parse(JSON.stringify(value));
const makeBatch=()=>{
 const definition=plan.batches[0];
 return {
  batch_id:definition.id,status:'DRAFT',
  records:definition.groups.flatMap(section=>Array.from({length:25},(_,index)=>{
   const n=section.id+'-'+index;
   return {
    group_id:section.id,topic:section.topic,
    english:'synthetic phrase '+n,
    ipa:'/synthetic/',
    meaning:'Nghĩa thử nghiệm riêng '+n,
    example:'Synthetic example for '+n+'.',
    translation:'Ví dụ kiểm thử '+n+'.',
    part_of_speech:'phrase',
    level:'A2',review_status:'PROVISIONAL',
    source_url:'https://dictionary.cambridge.org/dictionary/english/example',
    cefr_evidence_kind:'contextual_inference',
    cefr_source_label:null,
    source_note:'SYNTHETIC UNIT-TEST DATA ONLY; not a real dictionary-level validation.'
   };
  }))
 };
};

test('LIFE-1000 roadmap contains 10 ordered batches, 40 sections and exactly 1000 planned words',()=>{
 const report=validateLife1000Roadmap(plan,seed);
 assert.equal(report.batches,10);
 assert.equal(report.sections,40);
 assert.equal(report.planned_words,1000);
 assert.equal(report.existing_topics,26);
 assert.equal(report.proposed_topics,7);
 assert.equal(report.authorized_to_import,false);
 assert.equal(report.authorized_to_deploy,false);
 assert.equal(report.new_topics_created,false);
 for(const topic of plan.proposed_topics)assert.equal(Object.hasOwn(seed,topic.name),false);
});

test('LIFE-1000 validates a synthetic 100-word DRAFT but never approves or imports it',()=>{
 const summary=validateLife1000Candidates({roadmap:plan,seed,drafts,batch:makeBatch()});
 assert.equal(summary.lexical_candidates,100);
 assert.equal(summary.proposed_level_count,100);
 assert.equal(summary.all_items_provisional,true);
 assert.equal(summary.independent_review_completed,false);
 assert.equal(summary.candidate_import_authorized,false);
 assert.equal(summary.production_deployment_authorized,false);
 assert.deepEqual(summary.groups.map(x=>x.count),[25,25,25,25]);
});

test('LIFE-1000 rejects non-100 batches and missing 25-word group quotas',()=>{
 for(const n of [0,1,99,101]){
  const batch=makeBatch();batch.records.length=n;
  assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch}),/exactly 100 DRAFT/);
 }
 const b=makeBatch();
 b.records[0].group_id=b.records[25].group_id;
 b.records[0].topic=b.records[25].topic;
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:b}),/25 entries/);
});

test('LIFE-1000 blocks duplicate English across seed, provisional drafts, and prior batches',()=>{
 const existing=makeBatch();
 existing.records[0].english='wake';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:existing}),/duplicate English/);
 const draft=makeBatch();
 draft.records[0].english=drafts[0].english;
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:draft}),/duplicate English/);
 const previous=makeBatch();
 assert.throws(()=>validateLife1000Candidates({
  roadmap:plan,seed,drafts,priorRecords:[previous.records[0]],batch:previous
 }),/duplicate English/);
 const repeated=makeBatch();
 repeated.records[1].english=repeated.records[0].english.toUpperCase();
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:repeated}),/duplicate English/);
});

test('LIFE-1000 rejects cue ambiguity, unauthorized user identity and fake APPROVED records',()=>{
 const conflict=makeBatch();conflict.records[0].meaning='Đi bộ';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:conflict}),/cue collides/);
 const within=makeBatch();within.records[1].meaning=within.records[0].meaning;
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:within}),/ambiguous new Vietnamese cue/);
 const approved=makeBatch();approved.records[0].review_status='APPROVED';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:approved}),/invalid provisional CEFR/);
 const identity=makeBatch();identity.records[0].reviewed_by='forged-reviewer';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:identity}),/safe draft schema/);
});

test('LIFE-1000 rejects fake source labels, invalid URLs and topic/group injection',()=>{
 const labeled=makeBatch();labeled.records[0].cefr_source_label='A2';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:labeled}),/contextual inference/);
 const contradictory=makeBatch();
 contradictory.records[0].cefr_evidence_kind='exact_sense_label';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:contradictory}),/source evidence/);
 const badUrl=makeBatch();badUrl.records[0].source_url='http://localhost:8000/fake';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:badUrl}),/source URL/);
 const wrongTopic=makeBatch();wrongTopic.records[0].topic='Everyday Conversation - Giao tiếp hằng ngày';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:wrongTopic}),/wrong topic/);
 const wrongGroup=makeBatch();wrongGroup.records[0].group_id='not-in-roadmap';
 assert.throws(()=>validateLife1000Candidates({roadmap:plan,seed,drafts,batch:wrongGroup}),/wrong topic/);
});

test('LIFE-1000 roadmap modifications cannot silently add topics or make unsafe activation',()=>{
 for(const modifier of [
  p=>{p.batches.pop()},
  p=>{p.batches[0].groups[0].target_words=30},
  p=>{p.batches[0].groups[0].topic='Surprise Topic'},
  p=>{p.proposed_topics[0].name='Daily Life'},
  p=>{p.proposed_topics[0].activation='ACTIVE'},
  p=>{p.suggested_cefr_mix.A1=999},
  p=>{p.policies.import='WRITE_TO_PRODUCTION'}
 ]){
  const p=copy(plan);modifier(p);
  assert.throws(()=>validateLife1000Roadmap(p,seed),/LIFE-1000 preflight/);
 }
});
