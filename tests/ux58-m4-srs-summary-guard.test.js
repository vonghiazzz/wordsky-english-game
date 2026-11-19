import test from 'node:test';
import assert from 'node:assert/strict';
import {srsReviewCards} from '../public/ux24-srs-panel.js';

const actor='12345678-1234-4234-8234-123456789abc';
const queue=()=>({
 scope:'account-srs',actor_id:actor,
 status:'due',topic:'',page:0,total:0,total_pages:0,
 words:[],topics:[],summary:{due:2,new:3,upcoming:4,total:9}
});

test('UX58 QA: valid account summary remains accepted',()=>{
 const payload=queue();
 assert.equal(srsReviewCards(payload,actor),payload);
});

test('UX58 QA: SRS cards fail closed on absent or malformed global summary',()=>{
 const p=queue();
 for(const summary of [
  undefined,null,{},[],{due:1,new:2,upcoming:3,total:8},
  {...p.summary,total:8},{...p.summary,due:-1},
  {...p.summary,new:'3'},{...p.summary,upcoming:NaN}
 ]){
  assert.throws(()=>srsReviewCards({...p,summary},actor));
 }
});

test('UX58 QA: actor mismatch prevents another account plan from rendering',()=>{
 const p=queue();
 assert.throws(()=>srsReviewCards(p,'another-account'));
 assert.throws(()=>srsReviewCards({...p,actor_id:'another-account'},actor));
});

test('UX58 QA: paginated row total is not substituted for global summary',()=>{
 const p=queue();
 const withPage={...p,total:1,words:[{
  id:'12345678-1234-4234-8234-123456789abc',
  source:'shared',review_count:0,status:'new',english:'book',topic:'School'
 }]};
 assert.equal(srsReviewCards(withPage,actor),withPage);
});
