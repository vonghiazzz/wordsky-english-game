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

// Public shared word IDs verified with read-only Preview (365 cards) and
// staged Production (2,099 cards) vocabulary APIs on 2026-11-21.
// These environments use different UUIDs. Both are pinned so a topic rename
// does not silently remove the safety hold. Do not mutate SRS/history.
const pendingSharedIds=new Set([
 '7bccae74-7819-4456-85ee-b262d425546e', // five
 'c74d6d8c-da74-4562-a0ed-26edf47ef547', // year
 'dba50551-ef7a-4934-8437-16b0d6d2e544', // assess
 '3d186425-189f-44db-b910-980efce3e9d4', // evaluate
 '2cbd48a9-ccae-4922-bae9-3e4b223953df', // significant
 '2a45ef4a-3c78-4e65-b41f-da7a48a6b9aa', // substantial
 // Production shared IDs (staged production GET verification):
 '4b406577-b4d7-43a5-903e-55e734dca399', // five
 '81bf2f1f-a7ab-49f7-ac0e-088ea7bee93d', // year
 '850c23ad-1d31-4d64-ab9e-7b05744e10f6', // assess
 'b7fb767d-b77c-4911-b45b-c4588747c2bc', // evaluate
 'ad2b5bf6-dcd1-4232-bfd2-a3765a467ae5', // significant
 '91001117-6921-488d-a052-34dbc248e838', // substantial
]);

export function isPendingEditorialRecall(row){
 if(row?.source!=='shared')return false;
 const id=String(row.id??row.word_id??'').trim().toLowerCase();
 if(pendingSharedIds.has(id))return true;
 // Real public/SRS topics contain bilingual display names such as
 // "School - Trường học"; historical fixtures use the short English name.
 const topic=normalize(row.topic).split(/\s+-\s+/u)[0];
 const english=normalize(row.english);
 return pendingCards.some(([t,e])=>t===topic&&e===english);
}
export function countPendingEditorialRecall(rows){
 if(!Array.isArray(rows))return 0;
 return rows.filter(isPendingEditorialRecall).length;
}
