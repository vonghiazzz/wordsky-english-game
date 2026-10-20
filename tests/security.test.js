import test from 'node:test';import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,issueSession,parseSession,normalizeName,username} from '../lib/security.js';
test('password hashing',()=>{let hash=hashPassword('StrongPassword42!');assert.equal(verifyPassword('StrongPassword42!',hash),true);assert.equal(verifyPassword('wrong',hash),false)});
test('signed session, expiration and tampering',()=>{const secret='x'.repeat(64);const s=issueSession({role:'player',id:'abc'},secret,60);assert.equal(parseSession(s,secret)?.id,'abc');assert.equal(parseSession(s+'a',secret),null);assert.equal(parseSession(s,'z'.repeat(64)),null);assert.equal(parseSession(issueSession({role:'guest',id:'x'},secret,-1),secret),null)});
test('name validation',()=>{assert.equal(username('Nghia_1'),'nghia_1');assert.throws(()=>username('a'));assert.equal(normalizeName('  My   Name '),'My Name')});
