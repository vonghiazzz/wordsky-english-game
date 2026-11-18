import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupVerbForms} from '../public/verb-forms.js';
import {listVerbEntries,findVerbEntries} from '../public/verb-dictionary.js';
import {isVerbAnswerCorrect,createVerbQuiz,paginateVerbs} from '../public/verb-practice-core.js';

// UX52 batch-01: editorial ledger. V1/V2/V3 checked against Cambridge English Grammar Today
// https://dictionary.cambridge.org/grammar/british-grammar/table-of-irregular-verbs
// and Oxford University Press irregular verbs chart
// https://gs.ouponlinepractice.com/bookdata/gs3/resources/student/L3_02_Ref06.pdf
const rows=`arise|arose|arisen|phát sinh, xuất hiện
beat|beat|beaten|đánh bại, đánh
bend|bent|bent|uốn cong
bet|bet|bet|đặt cược
bind|bound|bound|buộc, ràng buộc
bite|bit|bitten|cắn
bleed|bled|bled|chảy máu
blow|blew|blown|thổi
burst|burst|burst|vỡ tung, bùng nổ
cling|clung|clung|bám chặt
creep|crept|crept|bò, trườn
deal|dealt|dealt|giải quyết, giao dịch
dig|dug|dug|đào
dream|dreamt / dreamed|dreamt / dreamed|mơ
feed|fed|fed|cho ăn, nuôi
fight|fought|fought|chiến đấu
flee|fled|fled|chạy trốn
forbid|forbade|forbidden|cấm
grind|ground|ground|nghiền, xay
hide|hid|hidden|giấu, trốn
hit|hit|hit|đánh, va vào
hurt|hurt|hurt|làm đau
kneel|knelt|knelt|quỳ
lay|laid|laid|đặt xuống, đẻ trứng
lead|led|led|dẫn dắt
lend|lent|lent|cho mượn
light|lit|lit|thắp sáng
quit|quit|quit|từ bỏ, nghỉ
ring|rang|rung|reo, gọi điện
rise|rose|risen|tăng lên, mọc lên
seek|sought|sought|tìm kiếm
shake|shook|shaken|lắc, rung
shoot|shot|shot|bắn, chụp ảnh
shrink|shrank|shrunk|co lại
shut|shut|shut|đóng lại
sing|sang|sung|hát
sink|sank|sunk|chìm
slide|slid|slid|trượt
spin|spun|spun|quay, xoay
spring|sprang|sprung|nhảy bật
spread|spread|spread|lan rộng, trải ra
steal|stole|stolen|đánh cắp
stick|stuck|stuck|dính, gắn
sting|stung|stung|đốt, chích
swear|swore|sworn|thề
sweep|swept|swept|quét
swing|swung|swung|đu đưa
tear|tore|torn|xé
throw|threw|thrown|ném
strike|struck|struck|đình công, đánh`.trim().split('\n').map(line=>line.split('|'));
test('UX52 batch01 has exactly 50 unique new V1/V2/V3/VI entries',()=>{
 assert.equal(rows.length,50);
 assert.equal(new Set(rows.map(r=>r[0])).size,50);
 const catalog=listVerbEntries();
 assert.ok(catalog.length>=191);
 assert.equal(new Set(catalog.map(r=>r.v1)).size,catalog.length);
 for(const [v1,v2,v3,meaning] of rows){
  const found=catalog.find(r=>r.v1===v1);
  assert.ok(found,'missing headword '+v1);
  assert.deepEqual(lookupVerbForms(v1),{v1,v2,v3,kind:'irregular'},v1);
  assert.equal(found.meaning,meaning,v1);
  assert.equal(found.kind,'irregular');
 }
});
test('UX52 inflected lookup and alternate past forms are accepted',()=>{
 assert.equal(findVerbEntries('arisen')[0].v1,'arise');
 assert.equal(findVerbEntries('fed')[0].v1,'feed');
 assert.equal(findVerbEntries('stolen')[0].v1,'steal');
 assert.equal(findVerbEntries('dreamt')[0].v1,'dream');
 assert.equal(findVerbEntries('dreamed')[0].v1,'dream');
 assert.ok(isVerbAnswerCorrect('dreamt','dreamt / dreamed'));
 assert.ok(isVerbAnswerCorrect('dreamed','dreamt / dreamed'));
 assert.equal(isVerbAnswerCorrect('dreamt','dreamt / dreamed'),true);
 assert.equal(isVerbAnswerCorrect('dreaming','dreamt / dreamed'),false);
 assert.equal(paginateVerbs(listVerbEntries(),10).items.length,20);
 assert.equal(createVerbQuiz({kind:'irregular',random:()=>0.42}).length,10);
});
