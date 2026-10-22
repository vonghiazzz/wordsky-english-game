// Fail-closed policy for assigning approved CEFR metadata to vocabulary.
// Avoid overwriting existing English, meaning, IPA, example, or translation.
export const normalizeMeaning = value => String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi-VN');
export function decideCefrImport(existing, incoming){
 if(!existing)return 'insert';
 if(existing.enabled===false)throw Error('Tu da bi an; khong duoc tu dong cap nhat.');
 if(normalizeMeaning(existing.meaning)!==normalizeMeaning(incoming.meaning)){
  throw Error('Nghia tu da co khac ban nhap; can doi chieu thu cong truoc khi cap nhat CEFR.');
 }
 if(existing.cefr_review_status==='APPROVED'){
  if(existing.cefr_level!==incoming.level)throw Error('Tu da duyet co CEFR khac; khong ghi de nhan da duyet.');
  return 'skip';
 }
 if(existing.cefr_level && existing.cefr_level!==incoming.level){
  throw Error('Nhan CEFR cu va moi mau thuan; can duyet thu cong.');
 }
 return 'update';
}
