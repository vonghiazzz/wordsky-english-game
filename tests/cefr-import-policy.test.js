import test from 'node:test';
import assert from 'node:assert/strict';
import {decideCefrImport} from '../lib/cefr-import-policy.js';
const approved={english:'apple',meaning:'Quả táo',level:'A2'};
test('CEFR importer may safely approve an existing legacy word without duplicating it',()=>{
 assert.equal(decideCefrImport(undefined,approved),'insert');
 assert.equal(decideCefrImport({meaning:'  Quả   táo  ',cefr_level:null,cefr_review_status:'UNREVIEWED',enabled:true},approved),'update');
 assert.equal(decideCefrImport({meaning:'Quả táo',cefr_level:'A2',cefr_review_status:'APPROVED',enabled:true},approved),'skip');
});
test('CEFR importer rejects conflicting senses, reviewed labels and disabled records',()=>{
 assert.throws(()=>decideCefrImport({meaning:'Táo xanh',cefr_level:null,cefr_review_status:'UNREVIEWED'},approved),/Nghia tu/);
 assert.throws(()=>decideCefrImport({meaning:'Quả táo',cefr_level:'B2',cefr_review_status:'APPROVED'},approved),/khong ghi de/);
 assert.throws(()=>decideCefrImport({meaning:'Quả táo',cefr_level:'B1',cefr_review_status:'PROVISIONAL'},approved),/mau thuan/);
 assert.throws(()=>decideCefrImport({meaning:'Quả táo',cefr_level:null,cefr_review_status:'UNREVIEWED',enabled:false},approved),/bi an/);
});
