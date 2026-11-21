/* UX61.4 interim safety gate for six shared vocabulary cards whose Vietnamese
 * recall cues are not yet sense/POS-approved (issue #135, UX61.3 ledger).
 * Keep each word's original ID, SRS due date and review history untouched.
 * A content editor must explicitly review the ledger and remove a hold before
 * restoring auto-graded typed recall. This is NOT a synonym acceptance rule.
 */
const normalize=value=>String(value??'').normalize('NFKC').trim()
 .replace(/\s+/gu,' ').toLocaleLowerCase('vi');

// Match each shared card by topic and English headword until human signoff.
// A changed meaning alone must NOT silently lift the unreviewed-sense hold.
// Other topics and personal words are unaffected.
const pendingCards=[
 ['Numbers','five'],
 ['Time & Dates','year'],
 ['School','assess'],
 ['School','evaluate'],
 ['Adjectives','significant'],
 ['Adjectives','substantial'],
].map(values=>values.map(normalize));

export function isPendingEditorialRecall(row){
 if(row?.source!=='shared')return false;
 const topic=normalize(row.topic),english=normalize(row.english);
 return pendingCards.some(([t,e])=>t===topic&&e===english);
}
export function countPendingEditorialRecall(rows){
 if(!Array.isArray(rows))return 0;
 return rows.filter(isPendingEditorialRecall).length;
}
