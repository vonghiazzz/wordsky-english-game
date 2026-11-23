import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBlindReviewTemplate,compareBlindReviewForms}
 from '../lib/ux61-9-blind-review.js';

const ui=readFileSync(new URL('../tools/ux61-11-reviewer-form.html',import.meta.url),'utf8');
const packet=JSON.parse(readFileSync(
 new URL('../docs/ux61-8-editorial-evidence.json',import.meta.url),'utf8'));
const templateA=JSON.parse(readFileSync(
 new URL('../docs/ux61-9-review-templates/ux61-9-REVIEWER_A.json',import.meta.url),'utf8'));
const templateB=JSON.parse(readFileSync(
 new URL('../docs/ux61-9-review-templates/ux61-9-REVIEWER_B.json',import.meta.url),'utf8'));

test('UX61.11 offline review form uses no automatic network, third-party code or HTML injection',()=>{
 assert.match(ui,/<html lang="vi">/);
 assert.match(ui,/connect-src 'none'/);
 assert.match(ui,/default-src 'none'/);
 assert.match(ui,/form-action 'none'/);
 assert.doesNotMatch(ui,/<script\s+src\s*=/i);
 assert.doesNotMatch(ui,/<iframe|<object|<embed/ig);
 assert.doesNotMatch(ui,/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket|EventSource/);
 assert.doesNotMatch(ui,/\.innerHTML\s*=/);
 assert.match(ui,/el\.textContent=String\(value\?\?''\)/);
 assert.match(ui,/label\.textContent=labelText/);
 assert.match(ui,/URL\.createObjectURL\(blob\)/);
 assert.match(ui,/setTimeout\(\(\)=>URL\.revokeObjectURL\(url\),1000\)/);
 assert.match(ui,/source_url!=='https:\/\/dictionary\.cambridge\.org\/dictionary\/english\/'/);
 assert.match(ui,/link\.rel='noopener noreferrer'/);
 assert.match(ui,/link\.target='_blank'/);
});

test('UX61.11 only accepts the expected six words and two reviewer codes',()=>{
 for(const code of ['REVIEWER_A','REVIEWER_B']){
  assert.match(ui,new RegExp(code));
  const template=code==='REVIEWER_A'?templateA:templateB;
  assert.deepEqual(template,createBlindReviewTemplate(packet,code));
  assert.equal(template.cards.length,6);
  assert.ok(template.cards.every(c=>c.decision===null));
 }
 for(const word of ['five','year','assess','evaluate','significant','substantial'])
  assert.ok(ui.includes("'"+word+"'"));
 assert.match(ui,/input\.cards\.length!==6/);
 assert.match(ui,/reviewed_source_url/);
 assert.match(ui,/card\.english/);
});

test('UX61.11 completed but unverified forms remain blocked by existing strict review policy',()=>{
 const a=structuredClone(templateA),b=structuredClone(templateB);
 for(const form of [a,b])form.cards.forEach((card,i)=>{
  card.decision='suitable_for_adjudication';
  card.proposed_prompt_vi='Tình huống khác nhau mẫu '+(i+1)+'; cần người thật thẩm định';
  card.accepted_english=[card.english];
  card.reasoning='Synthetic example, not linguistic or identity approval';
  card.reviewed_source_url=card.source_url;
 });
 const report=compareBlindReviewForms(packet,a,b);
 assert.equal(report.forms_complete,true);
 assert.equal(report.independent_people_verified,false);
 assert.equal(report.semantic_accuracy_verified,false);
 assert.equal(report.authorized_to_grade_srs,false);
 assert.equal(report.requires_human_adjudication,true);
});
