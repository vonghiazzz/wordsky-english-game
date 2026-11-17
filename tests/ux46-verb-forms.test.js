import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lookupVerbForms} from '../public/verb-forms.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('UX46 irregular verb forms match core reference',()=>{
 for(const [word,v2,v3] of [
  ['go','went','gone'],['eat','ate','eaten'],['write','wrote','written'],
  ['be','was / were','been'],['get','got','got / gotten'],
  ['read','read','read'],['see','saw','seen']
 ])assert.deepEqual(lookupVerbForms(word),{v1:word,v2,v3,kind:'irregular'});
});
test('UX46 regular inflection matches rules',()=>{
 for(const [word,past] of [
  ['work','worked'],['live','lived'],['study','studied'],
  ['stop','stopped'],['plan','planned'],['play','played'],['try','tried']
 ])assert.deepEqual(lookupVerbForms(word),{v1:word,v2:past,v3:past,kind:'regular'});
});
test('UX46 fail closed on phrases and unknown or ambiguous words',()=>{
 for(const term of [
  'have a lot in common','set the table','go home','I have eaten',
  'apple','habitat','make up','',null,'hello!','unknownverb'
 ])assert.equal(lookupVerbForms(term),null,String(term));
});
test('UX46 case normalization and no account or database mutation',()=>{
 assert.deepEqual(lookupVerbForms('  GO  '),lookupVerbForms('go'));
 const module=read('public/verb-forms.js');
 assert.doesNotMatch(module,/fetch\(|localStorage|sessionStorage|\.query\(|\bUPDATE\b|\bINSERT\b/);
 const screen=read('public/ux10-progress.js');
 assert.match(screen,/lookupVerbForms\(card\.english\)/);
 assert.match(screen,/meaning\.append\(details\)/);
 assert.match(screen,/details\.append\(summary,grid/);
});
