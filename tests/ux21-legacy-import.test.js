import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planThreeWayLegacyImport} from '../public/ux21-legacy-reconciliation.js';
import {classifyLegacyMatch} from '../lib/legacy-learning-import.js';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const word=(topic,english,meaning,known=false)=>({
 topic,english,meaning,ipa:'',example:'',translation:'',known
});
const accountWord=(source,n,card,reviewed=false,remembered=false)=>({
 ...card,id:id(n),source,reviewed,remembered
});
const snapshot=words=>({words,learned:{},error:null});
const summary=words=>({scope:'unified-account',actor_id:id(999),words});
test('UX21 a matching shared card is reviewed by UUID instead of being duplicated as personal',()=>{
 const w=word('Food','apple','Táo',true);
 const plan=planThreeWayLegacyImport(snapshot([w]),summary([
  accountWord('shared',1,w,false)
 ]));
 assert.deepEqual(plan.entries.map(x=>x.type),['remember-shared']);
 assert.equal(plan.entries[0].id,id(1));
 assert.equal(plan.counts.shared,1);
 assert.equal(plan.counts.newCards,0);
 assert.deepEqual(classifyLegacyMatch(w,[{...w,id:id(1)}],[]),
  {status:'matched',source:'shared',id:id(1)});
});
test('UX21 existing remembered=false is a decision and must never be overwritten',()=>{
 const w=word('Food','apple','Táo',true);
 const p=planThreeWayLegacyImport(snapshot([w]),summary([
  accountWord('shared',1,w,true,false)
 ]));
 assert.equal(p.entries.length,0);
 assert.equal(p.counts.alreadyReviewed,1);
});
test('UX21 exact account-owned word is matched; only missing remembered flag is eligible',()=>{
 const a=word('Sports','badminton','Cầu lông',true);
 const p=planThreeWayLegacyImport(snapshot([a]),summary([
  accountWord('personal',2,a,false,false)
 ]));
 assert.deepEqual(p.entries.map(x=>x.type),['remember-personal']);
 assert.equal(p.counts.newCards,0);
});
test('UX21 only genuinely new cards become new personal cards, once',()=>{
 const a=word('Other','unusual-word-ux21','Nghĩa thử nghiệm',true);
 const p=planThreeWayLegacyImport(snapshot([a]),summary([]));
 assert.equal(p.entries.length,1);
 assert.equal(p.entries[0].type,'create');
 assert.equal(p.counts.newCards,1);
 const once=planThreeWayLegacyImport(snapshot([a]),summary([
  accountWord('personal',2,a,true,true)
 ]));
 assert.equal(once.entries.length,0);
});
test('UX21 changed meanings are conflicts rather than false exact matches',()=>{
 const local=word('Food','apple','Một quả táo',true);
 const shared=word('Food','apple','Táo');
 const p=planThreeWayLegacyImport(snapshot([local]),summary([
  accountWord('shared',1,shared,false,false)
 ]));
 assert.equal(p.entries.length,0);assert.equal(p.counts.conflicts,1);
 assert.equal(classifyLegacyMatch(local,[{...shared,id:id(1)}],[]).status,'conflict');
});
test('UX21 cross-topic same English is held for manual review instead of blindly creating',()=>{
 const local=word('Food','apple','Táo',true);
 const other=word('Fruits','apple','Táo');
 const p=planThreeWayLegacyImport(snapshot([local]),summary([
  accountWord('shared',1,other,false,false)
 ]));
 assert.equal(p.entries.length,0);assert.equal(p.counts.conflicts,1);
 assert.equal(classifyLegacyMatch(local,[{...other,id:id(1)}],[]).status,'conflict');
});
test('UX21 shared and personal duplicate identity is ambiguous even when exact',()=>{
 const local=word('Food','apple','Táo',true);
 const p=planThreeWayLegacyImport(snapshot([local]),summary([
  accountWord('shared',1,local,false,false),accountWord('personal',2,local,false,false)
 ]));
 assert.equal(p.entries.length,0);assert.equal(p.counts.ambiguous,1);
 assert.equal(classifyLegacyMatch(local,[{...local,id:id(1)}],
  [{...local,id:id(2)}]).status,'ambiguous');
});
test('UX21 other-topic same English does not block a unique exact identity',()=>{
 const local=word('Food','apple','Táo',true);
 const a=word('Fruits','apple','Táo'),b=word('Food','apple','Táo');
 const p=planThreeWayLegacyImport(snapshot([local]),summary([
  accountWord('shared',1,a,false,false),accountWord('shared',2,b,false,false)
 ]));
 assert.deepEqual(p.entries.map(x=>x.id),[id(2)]);
 assert.equal(classifyLegacyMatch(local,[{...a,id:id(1)},{...b,id:id(2)}],[]).id,id(2));
});
test('UX21 not-remembered local shared card needs no account review',()=>{
 const local=word('Food','apple','Táo',false);
 const p=planThreeWayLegacyImport(snapshot([local]),summary([
  accountWord('shared',1,local,false,false)
 ]));
 assert.equal(p.entries.length,0);assert.equal(p.counts.unchanged,1);
});
test('UX21 malformed client snapshot or server response fails closed',()=>{
 const w=word('Food','apple','Táo',true);
 assert.ok(planThreeWayLegacyImport({error:'malformed',words:[]},summary([])).error);
 assert.ok(planThreeWayLegacyImport(snapshot([w]),{scope:'wrong',words:[]}).error);
 assert.ok(planThreeWayLegacyImport(snapshot([w]),summary([{
  ...accountWord('shared',1,w),reviewed:'no'
 }])).error);
 const p=planThreeWayLegacyImport(snapshot([word('Food','x'.repeat(90),'Nghĩa')]),summary([]));
 assert.equal(p.entries.length,0);assert.equal(p.counts.invalid,1);
});
test('UX21 imports use one atomic transaction, signed actor, and conflict-safe progress',()=>{
 const src=readFileSync(new URL('../lib/legacy-learning-import.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
 assert.match(src,/return transaction\(async db=>/);
 assert.match(src,/SELECT id FROM ws_users WHERE id=\$1 FOR UPDATE/);
 assert.match(src,/WHERE user_id=\$1 AND deleted_at IS NULL/);
 assert.match(src,/ON CONFLICT\(user_id,/);
 assert.match(src,/DO NOTHING/);
 assert.match(src,/if\(progress.rows.length\)/);
 assert.match(src,/ws_learning_flashcard_reviews/);
 assert.match(src,/ws_personal_card_reviews/);
 assert.match(api,/importLegacyFlashcard\(userId,input\)/);
 assert.match(api,/if\(input.expected_actor_id!==undefined&&input.expected_actor_id!==userId\)/);
});
test('UX21 UI only invokes safe import API after opt-in and preflight revalidation',()=>{
 const ui=readFileSync(new URL('../public/ux18-personal.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/personal.html',import.meta.url),'utf8');
 assert.match(ui,/planThreeWayLegacyImport\(snapshot,unifiedSnapshot\)/);
 assert.match(ui,/learning\/me\/summary/);
 assert.match(ui,/window.confirm\('Chuyển '/);
 assert.match(ui,/plan.entries.slice\(0,20\)/);
 assert.match(ui,/signature\(latest.entries.slice\(0,20\)\)!==signature\(batch\)/);
 assert.match(ui,/learning\/import\/legacy/);
 assert.doesNotMatch(ui,/localStorage.setItem/);
 assert.match(html,/kho từ chung và từ cá nhân/);
 assert.match(html,/href="\/learn.html\?legacy=1#manage"/);
});
