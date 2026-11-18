import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupVerbForms} from '../public/verb-forms.js';
import {listVerbEntries,findVerbEntries} from '../public/verb-dictionary.js';
import {paginateVerbs,isVerbAnswerCorrect} from '../public/verb-practice-core.js';

// UX52 batch03: editorial review of regular spelling and Vietnamese glosses.
// Regular -ed rules: https://dictionary.cambridge.org/grammar/british-grammar/past-simple-i-worked
const expected=`adapt|adapted|thích nghi
admire|admired|ngưỡng mộ
affect|affected|ảnh hưởng
afford|afforded|có khả năng chi trả
arrange|arranged|sắp xếp
assist|assisted|hỗ trợ
attach|attached|đính kèm, gắn
attend|attended|tham dự
attract|attracted|thu hút
behave|behaved|cư xử
belong|belonged|thuộc về
book|booked|đặt chỗ
brush|brushed|chải, cọ
carry|carried|mang, vận chuyển
charge|charged|tính phí, sạc
communicate|communicated|giao tiếp
complete|completed|hoàn thành
concentrate|concentrated|tập trung
contact|contacted|liên hệ
count|counted|đếm
cover|covered|bao phủ, che
damage|damaged|gây hư hại
decorate|decorated|trang trí
decrease|decreased|giảm
demand|demanded|đòi hỏi
design|designed|thiết kế
destroy|destroyed|phá hủy
divide|divided|chia, phân chia
earn|earned|kiếm được
exchange|exchanged|trao đổi
exist|existed|tồn tại
express|expressed|bày tỏ
fail|failed|thất bại
fill|filled|lấp đầy, điền
form|formed|hình thành
gather|gathered|tụ họp, thu thập
greet|greeted|chào hỏi
guess|guessed|đoán
handle|handled|xử lý
identify|identified|nhận diện, xác định
inform|informed|thông báo
insist|insisted|khăng khăng, nhất quyết
interrupt|interrupted|ngắt lời
investigate|investigated|điều tra
locate|located|xác định vị trí
maintain|maintained|duy trì, bảo trì
mention|mentioned|đề cập
notice|noticed|nhận thấy
observe|observed|quan sát
obtain|obtained|đạt được, nhận được
participate|participated|tham gia
promise|promised|hứa
publish|published|xuất bản
realize|realized|nhận ra
recognize|recognized|nhận diện, nhận ra
recommend|recommended|đề xuất, giới thiệu
reduce|reduced|giảm bớt
refuse|refused|từ chối
remind|reminded|nhắc nhở`.trim().split('\n').map(line=>line.split('|'));
test('UX52 batch03 adds 59 uniquely checked V1/V2/V3 and Vietnamese glosses',()=>{
 assert.equal(expected.length,59);
 assert.equal(new Set(expected.map(row=>row[0])).size,59);
 const all=listVerbEntries();
 assert.equal(all.length,300);
 assert.equal(new Set(all.map(row=>row.v1)).size,300);
 for(const [v1,v2,meaning] of expected){
  assert.deepEqual(lookupVerbForms(v1),{v1,v2,v3:v2,kind:'regular'},v1);
  const found=all.find(row=>row.v1===v1);
  assert.ok(found,'missing '+v1);
  assert.equal(found.meaning,meaning,v1);
  assert.equal(findVerbEntries(v2).some(row=>row.v1===v1),true,v2);
  assert.equal(isVerbAnswerCorrect(v2,found.v3),true,v1);
 }
});
test('UX52 has exactly fifteen pages and preserves filtered lookup',()=>{
 const all=listVerbEntries();
 const pages=Array.from({length:15},(_,i)=>paginateVerbs(all,i+1));
 assert.equal(pages.every(p=>p.items.length===20),true);
 assert.equal(new Set(pages.flatMap(p=>p.items.map(r=>r.v1))).size,300);
 assert.equal(findVerbEntries('identified','regular')[0].v1,'identify');
 assert.equal(findVerbEntries('carried','regular')[0].v1,'carry');
 assert.equal(findVerbEntries('recommend','irregular').length,0);
});
