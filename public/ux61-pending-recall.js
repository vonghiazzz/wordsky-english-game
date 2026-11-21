/* UX61.4 interim safety gate for six shared vocabulary cards whose Vietnamese
 * recall cues are not yet sense/POS-approved (issue #135, UX61.3 ledger).
 * Keep each word's original ID, SRS due date and review history untouched.
 * A content editor must explicitly review the ledger and remove a hold before
 * restoring auto-graded typed recall. This is NOT a synonym acceptance rule.
 */
const normalize=value=>String(value??'').normalize('NFKC').trim()
 .replace(/\s+/gu,' ').toLocaleLowerCase('vi');

// Match the exact shared card's topic, English headword and current VI cue.
// Other topics, personal words and already corrected content are unaffected.
const pendingCards=[
 ['Numbers','five','năm'],
 ['Time & Dates','year','năm'],
 ['School','assess','đánh giá'],
 ['School','evaluate','đánh giá'],
 ['Adjectives','significant','đáng kể'],
 ['Adjectives','substantial','đáng kể'],
].map(values=>values.map(normalize));

export function isPendingEditorialRecall(row){
 if(row?.source!=='shared')return false;
 const topic=normalize(row.topic),english=normalize(row.english),
  cue=normalize(row.meaning);
 return pendingCards.some(([t,e,c])=>t===topic&&e===english&&c===cue);
}
export function countPendingEditorialRecall(rows){
 if(!Array.isArray(rows))return 0;
 return rows.filter(isPendingEditorialRecall).length;
}
