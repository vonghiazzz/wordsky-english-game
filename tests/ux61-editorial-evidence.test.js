/* UX61.8 editorial evidence is a PENDING reference packet, never approval.
 * Pure fixtures: no production writes, cookies, user data or SRS mutation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePendingEditorialPacket} from '../lib/ux61-8-editorial-preflight.js';
import {referenceForPendingSense} from '../public/ux61-editorial-sources.js';

const packet=JSON.parse(readFileSync(new URL('../docs/ux61-8-editorial-evidence.json',import.meta.url),'utf8'));
const makeRows=()=>packet.cards.map(c=>({
 word_id:c.word_id,english:c.english,topic:c.topic,
 meaning:c.existing_meaning,example:c.original_example,
 translation:c.original_translation,source:'shared'
}));
const clone=x=>structuredClone(x);

test('UX61.8 strict production evidence snapshot keeps six cues pending and grading disabled',()=>{
 const rows=makeRows(),untouched=clone(rows);
 const report=validatePendingEditorialPacket(packet,rows);
 assert.equal(report.scope,'offline-unapproved-reference-check-only');
 assert.equal(report.matched_cards,6);
 assert.equal(report.collision_groups,3);
 assert.equal(report.pending_human_review,6);
 assert.equal(report.verified_approvals,0);
 assert.equal(report.safe_to_use_as_reference,true);
 assert.equal(report.authorized_to_activate_prompts,false);
 assert.equal(report.authorized_to_grade_srs,false);
 assert.equal(report.authorized_to_modify_cefr,false);
 assert.equal(report.independent_reviewer_identity_verified,false);
 assert.match(report.exact_card_snapshot_sha256,/^[0-9a-f]{64}$/);
 assert.deepEqual(rows,untouched,'Reference validation cannot mutate learning data');
});

test('UX61.8 review record claims cannot create approval or unlock SRS',()=>{
 const edits=[
  p=>{p.decision_status='APPROVED'},
  p=>{p.release_gate.allow_graded_srs_activation=true},
  p=>{p.release_gate.allow_auto_apply=true},
  p=>{p.release_gate.allow_cefr_mutation=true},
  p=>{p.cards[0].review.status='APPROVED'},
  p=>{p.cards[0].review.reviewed_by='owner'},
  p=>{p.cards[0].review.reviewed_at='2026-11-21T12:00:00Z'},
  p=>{p.cards[0].review.accepted_english=['five']},
  p=>{p.cards[0].review.approved_prompt_vi='Số đếm 5'},
  p=>{p.cards[0].review.independent_receipts=[{decision:'approve'}]},
  p=>{p.cards[0].approved=true},
  p=>{p.cards[0].review.approved=true},
  p=>{p.cards[2].candidate_contextual_cue_vi='đánh giá năng lực học'},
 ];
 for(const edit of edits){
  const candidate=clone(packet);edit(candidate);
  assert.throws(()=>validatePendingEditorialPacket(candidate,makeRows()),
   undefined,'Unsafe review modification should fail');
 }
});

test('UX61.8 strict source drift gate rejects changed word IDs, senses, examples and removal',()=>{
 const edits=[
  rows=>rows.splice(0,1),
  rows=>{rows[0].meaning='số đếm 5'},
  rows=>{rows[1].topic='New topic'},
  rows=>{rows[2].english='evaluate'},
  rows=>{rows[3].example='Changed English example.'},
  rows=>{rows[4].translation='Bản dịch khác.'},
  rows=>{rows[5].word_id='00000000-0000-4000-8000-000000000099'}
 ];
 for(const edit of edits){
  const rows=makeRows();edit(rows);
  assert.throws(()=>validatePendingEditorialPacket(packet,rows));
 }
 const extra=[...makeRows(),{word_id:'00000000-0000-4000-8000-000000000088',
  english:'newword',topic:'Other',meaning:'nghĩa',example:'Example',translation:'Ví dụ'}];
 const r=validatePendingEditorialPacket(packet,extra);
 assert.equal(r.matched_cards,6,'Unrelated shared words are not blocked');
 assert.equal(r.source_word_count_changed,true);
});

test('UX61.8 allowlisted dictionary links only for held shared cards, never grade answers',()=>{
 const rows=makeRows();
 for(const w of rows){
  const ref=referenceForPendingSense(w);
  assert.ok(ref);
  assert.match(ref.url,/^https:\/\/dictionary\.cambridge\.org\/dictionary\/english\/[a-z]+$/);
  assert.equal(ref.reviewStatus,'PENDING_HUMAN_REVIEW');
  assert.ok(ref.partOfSpeech.length>2);
  assert.equal(referenceForPendingSense({...w,source:'personal'}),null);
 }
 assert.equal(referenceForPendingSense({source:'shared',english:'habitat',topic:'Nature'}),null);
 assert.equal(referenceForPendingSense({source:'shared',english:'purchase',topic:'Commerce'}),null);
 const ui=readFileSync(new URL('../public/ux28-practice.js',import.meta.url),'utf8');
 assert.match(ui,/referenceForPendingSense\(word\)/);
 assert.match(ui,/link\.href=evidence\.url/);
 assert.match(ui,/link\.rel='noopener noreferrer'/);
 assert.match(ui,/link\.textContent='Đối chiếu nghĩa trên Cambridge \(chưa phê duyệt\)'/);
 assert.equal(ui.includes('innerHTML'),false);
 assert.match(ui,/if\(confirm\.actor\?\.role!=='player'\|\|confirm\.actor\.id!==id\)/);
});
