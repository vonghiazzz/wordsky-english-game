import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupVerbForms} from '../public/verb-forms.js';
import {listVerbEntries,findVerbEntries} from '../public/verb-dictionary.js';
import {isVerbAnswerCorrect,paginateVerbs} from '../public/verb-practice-core.js';
// UX52 batch02: irregular patterns cross-checked with Cambridge English Grammar Today,
// Cambridge University Press irregular verbs, and regular -ed spelling conventions.
const rows=`breed|bred|bred|sinh sản, gây giống|irregular
burn|burnt / burned|burnt / burned|đốt cháy, bị bỏng|irregular
forgive|forgave|forgiven|tha thứ|irregular
freeze|froze|frozen|đóng băng|irregular
hang|hung|hung|treo|irregular
lean|leant / leaned|leant / leaned|dựa, nghiêng|irregular
shine|shone|shone|chiếu sáng, tỏa sáng|irregular
spill|spilt / spilled|spilt / spilled|làm đổ, tràn|irregular
speed|sped|sped|tăng tốc|irregular
stink|stank|stunk|bốc mùi hôi|irregular
broadcast|broadcast|broadcast|phát sóng|irregular
overcome|overcame|overcome|vượt qua, khắc phục|irregular
mistake|mistook|mistaken|nhầm lẫn|irregular
undo|undid|undone|hoàn tác, tháo ra|irregular
upset|upset|upset|làm buồn, làm xáo trộn|irregular
achieve|achieved|achieved|đạt được|regular
advise|advised|advised|khuyên, tư vấn|regular
allow|allowed|allowed|cho phép|regular
announce|announced|announced|thông báo|regular
apologize|apologized|apologized|xin lỗi|regular
appear|appeared|appeared|xuất hiện|regular
apply|applied|applied|nộp đơn, áp dụng|regular
approve|approved|approved|phê duyệt|regular
avoid|avoided|avoided|tránh|regular
believe|believed|believed|tin tưởng|regular
borrow|borrowed|borrowed|mượn|regular
celebrate|celebrated|celebrated|ăn mừng, kỷ niệm|regular
collect|collected|collected|thu thập|regular
complain|complained|complained|phàn nàn|regular
confirm|confirmed|confirmed|xác nhận|regular
connect|connected|connected|kết nối|regular
consider|considered|considered|cân nhắc|regular
continue|continued|continued|tiếp tục|regular
create|created|created|tạo ra|regular
depend|depended|depended|phụ thuộc|regular
discover|discovered|discovered|khám phá|regular
discuss|discussed|discussed|thảo luận|regular
educate|educated|educated|giáo dục|regular
encourage|encouraged|encouraged|khuyến khích|regular
enter|entered|entered|đi vào, nhập|regular
expect|expected|expected|mong đợi|regular
follow|followed|followed|theo dõi, đi theo|regular
happen|happened|happened|xảy ra|regular
imagine|imagined|imagined|tưởng tượng|regular
introduce|introduced|introduced|giới thiệu|regular
offer|offered|offered|đề nghị, cung cấp|regular
perform|performed|performed|thực hiện, biểu diễn|regular
protect|protected|protected|bảo vệ|regular
provide|provided|provided|cung cấp|regular
support|supported|supported|hỗ trợ|regular`.split('\n').map(line=>line.split('|'));
test('UX52 batch02 adds 50 unique complete entries, 15 irregular and 35 regular',()=>{
 assert.equal(rows.length,50);
 assert.equal(new Set(rows.map(r=>r[0])).size,50);
 assert.equal(rows.filter(r=>r[4]==='irregular').length,15);
 assert.equal(rows.filter(r=>r[4]==='regular').length,35);
 const all=listVerbEntries();
 assert.equal(all.length,241);
 assert.equal(new Set(all.map(r=>r.v1)).size,241);
 for(const [v1,v2,v3,meaning,kind] of rows){
  assert.deepEqual(lookupVerbForms(v1),{v1,v2,v3,kind},v1);
  const entry=all.find(r=>r.v1===v1);
  assert.ok(entry, v1);
  assert.equal(entry.meaning,meaning,v1);
  assert.equal(entry.kind,kind,v1);
 }
});
test('UX52 batch02 supports dual variants and V2/V3 lookup',()=>{
 for(const form of ['burnt','burned']) {
  assert.equal(findVerbEntries(form)[0].v1,'burn');
  assert.ok(isVerbAnswerCorrect(form,'burnt / burned'));
 }
 for(const form of ['leant','leaned']) assert.equal(findVerbEntries(form)[0].v1,'lean');
 for(const form of ['spilt','spilled']) assert.equal(findVerbEntries(form)[0].v1,'spill');
 assert.equal(findVerbEntries('forgiven')[0].v1,'forgive');
 assert.equal(findVerbEntries('applied')[0].v1,'apply');
 assert.equal(findVerbEntries('mistook')[0].v1,'mistake');
 const last=paginateVerbs(listVerbEntries(),13);
 assert.equal(last.pages,13);
 assert.equal(last.items.length,1);
});
