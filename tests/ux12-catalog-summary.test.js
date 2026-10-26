import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicVocabularySummary} from '../public/ux12-catalog-summary.js';

test('UX12 makes the server vocabulary count explicit without confusing it with local Flashcards',()=>{
 const payload={topics:[{enabled:true,word_count:260},{enabled:true,word_count:105},{enabled:false,word_count:500}]};
 assert.deepEqual(publicVocabularySummary(payload),{words:365,topics:2});
 assert.equal(payload.topics[0].word_count,260,'API data not mutated');
});
test('UX12 never invents counts from partial or malformed server responses',()=>{
 assert.equal(publicVocabularySummary(null),null);
 assert.equal(publicVocabularySummary({topics:[{enabled:true,word_count:'365'}]}),null);
 assert.equal(publicVocabularySummary({topics:[{enabled:true,word_count:-1}]}),null);
 assert.equal(publicVocabularySummary({topics:[{enabled:true,word_count:2.5}]}),null);
 assert.equal(publicVocabularySummary({topics:[]}).words,0);
});
test('UX12 UI contrasts backend count with browser-only data and preserves storage',()=>{
 const html=readFileSync(new URL('../public/progress.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/ux10-progress.js',import.meta.url),'utf8');
 assert.match(html,/id="ws10PublicCatalog"/);
 assert.match(js,/fetch\('\/api\/topics'/);
 assert.match(js,/Bộ Flashcard trên thiết bị là danh sách riêng/);
 assert.match(js,/publicCatalog.hidden = !serverVocabularySummary/);
 assert.doesNotMatch(js,/localStorage.clear\(/);
});
