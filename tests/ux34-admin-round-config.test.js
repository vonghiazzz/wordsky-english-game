import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('function cardRoundDefaultDuration(');
const end=app.indexOf('function renderRounds()',start);
assert.ok(start>=0&&end>start,'Card round helpers must exist');
const context={};
vm.runInNewContext(app.slice(start,end)+
 '\nthis.api={cardRoundDefaultDuration,cardRoundAdjustedDuration,adminRoundPenalty};',context);
const {cardRoundDefaultDuration,cardRoundAdjustedDuration,adminRoundPenalty}=context.api;

test('UX34 Admin presets use half duration for MEMORY at every grid size',()=>{
 for(const [pairs,matrix,memory] of [[8,180,90],[12,240,120],[18,360,180],[32,480,240],[50,720,360],[72,1200,600],[128,1800,900]]){
  assert.equal(cardRoundDefaultDuration('MATRIX',pairs),matrix);
  assert.equal(cardRoundDefaultDuration('MEMORY',pairs),memory);
 }
 assert.equal(cardRoundDefaultDuration('MATCH',18),null);
 assert.equal(cardRoundDefaultDuration('MATRIX',128),1800);
 assert.equal(cardRoundDefaultDuration('MATRIX',129),null);
});
test('UX34 Admin changing grid updates preset, preserves custom duration',()=>{
 assert.equal(cardRoundAdjustedDuration('MATRIX',18,50,360),720);
 assert.equal(cardRoundAdjustedDuration('MATRIX',8,12,180),240);
 assert.equal(cardRoundAdjustedDuration('MEMORY',12,128,120),900);
 assert.equal(cardRoundAdjustedDuration('MATRIX',50,72,720),1200);
 assert.equal(cardRoundAdjustedDuration('MEMORY',18,50,180),360);
 assert.equal(cardRoundAdjustedDuration('MEMORY',50,72,360),600);
 assert.equal(cardRoundAdjustedDuration('MEMORY',18,50,220),220);
 assert.equal(cardRoundAdjustedDuration('MEMORY',72,50,900),900);
 assert.equal(cardRoundAdjustedDuration('BOMB',8,10,90),90);
});
test('UX34 Card round penalties are independent; legacy modes use default',()=>{
 assert.equal(adminRoundPenalty('MATRIX',10,75),10);
 assert.equal(adminRoundPenalty('MEMORY',0,75),0);
 assert.equal(adminRoundPenalty('MEMORY',25,0),25);
 for(const mode of ['MATCH','BOMB','CAR'])assert.equal(adminRoundPenalty(mode,10,75),75);
 assert.match(app,/data-k="penalty" min="0" max="1000"/);
 assert.match(app,/penalty:adminRoundPenalty\(r\.mode,r\.penalty,penalty\)/);
 assert.match(app,/cardRoundAdjustedDuration\(rd\.mode,previousPairs,rd\.question_count,previousDuration\)/);
});

test('UX35 competition Editor includes all supported grid sizes',()=>{
 for(const [n,label] of [[8,'4 × 4'],[12,'5 × 5'],[18,'6 × 6'],[32,'8 × 8'],[50,'10 × 10'],[72,'12 × 12'],[128,'16 × 16']]){
  assert.ok(app.includes("n:"+n+",label:'"+label),"Missing "+label);
 }
 assert.match(app,/if\(c\.empty\)return '<div class="matrix-card-space"/);
});
