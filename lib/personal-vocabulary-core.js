// UX-17: validate browser uploads before writing private account vocabulary.
const letter = /^[a-z][a-z '\-]*$/i;
const field = (value,max,label,{allowEmpty=false}={}) => {
  if(typeof value !== 'string') throw Error(label+' phải là văn bản.');
  const clean=value.normalize('NFC').trim();
  if((!allowEmpty&&!clean)||clean.length>max) throw Error(label+' không hợp lệ.');
  return clean;
};
export function validatePersonalCard(value) {
  if(!value || typeof value!=='object'||Array.isArray(value))throw Error('Thẻ từ không hợp lệ.');
  const topic=field(value.topic,80,'Chủ đề');
  const english=field(value.english,80,'Từ tiếng Anh');
  if(!letter.test(english)) throw Error('Từ tiếng Anh có ký tự không được hỗ trợ.');
  const ipa=field(value.ipa,100,'Phiên âm',{allowEmpty:true});
  const meaning=field(value.meaning,180,'Nghĩa');
  const example=field(value.example,300,'Ví dụ',{allowEmpty:true});
  const translation=field(value.translation,300,'Bản dịch',{allowEmpty:true});
  if(typeof value.remembered!=='boolean')throw Error('Trạng thái ghi nhớ không hợp lệ.');
  const import_key=topic.toLocaleLowerCase('en')+':'+english.toLocaleLowerCase('en');
  if(import_key.length>220)throw Error('Định danh nhập quá dài.');
  return {topic,english,ipa,meaning,example,translation,remembered: value.remembered,import_key};
}
export function validatePersonalBatch(payload) {
  if(!payload||!Array.isArray(payload.cards)||payload.cards.length===0||payload.cards.length>20)
    throw Error('Mỗi lượt chỉ nhập từ 1 đến 20 từ.');
  const cards=payload.cards.map(validatePersonalCard);
  const seen=new Set();
  for(const item of cards){
    if(seen.has(item.import_key))throw Error('Có từ trùng trong cùng một lượt nhập.');
    seen.add(item.import_key);
  }
  return cards;
}
export function validatePersonalUpdate(payload) {
  if(!Number.isInteger(payload?.expected_version)||payload.expected_version<1)
    throw Error('Thiếu phiên bản để bảo vệ thay đổi đồng thời.');
  return {card:validatePersonalCard(payload),expected_version:payload.expected_version};
}
