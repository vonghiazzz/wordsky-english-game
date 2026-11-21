/* UX61.8: static lexical sources for read-only pending-sense cards.
 * Not human review evidence, an accepted-answer list, or CEFR approval.
 * Never fetch arbitrary URLs derived from account or vocabulary input.
 */
import {isPendingEditorialRecall} from './ux61-pending-recall.js';

const SOURCES=Object.freeze({
 five:Object.freeze({partOfSpeech:'Số từ',url:'https://dictionary.cambridge.org/dictionary/english/five'}),
 year:Object.freeze({partOfSpeech:'Danh từ',url:'https://dictionary.cambridge.org/dictionary/english/year'}),
 assess:Object.freeze({partOfSpeech:'Động từ',url:'https://dictionary.cambridge.org/dictionary/english/assess'}),
 evaluate:Object.freeze({partOfSpeech:'Động từ',url:'https://dictionary.cambridge.org/dictionary/english/evaluate'}),
 significant:Object.freeze({partOfSpeech:'Tính từ',url:'https://dictionary.cambridge.org/dictionary/english/significant'}),
 substantial:Object.freeze({partOfSpeech:'Tính từ',url:'https://dictionary.cambridge.org/dictionary/english/substantial'})
});

export function referenceForPendingSense(row){
 if(!isPendingEditorialRecall(row))return null;
 const key=String(row.english??'').normalize('NFKC').trim().toLocaleLowerCase('en');
 const ref=Object.hasOwn(SOURCES,key)?SOURCES[key]:null;
 return ref?Object.freeze({partOfSpeech:ref.partOfSpeech,url:ref.url,
  reviewStatus:'PENDING_HUMAN_REVIEW'}):null;
}
