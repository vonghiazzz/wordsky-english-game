export function validateFlashcardReview(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Review payload không hợp lệ');
 const word_id = input.word_id;
 if (typeof word_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(word_id)) throw new Error('word_id UUID không hợp lệ');
 if (typeof input.remembered !== 'boolean') throw new Error('remembered phải là boolean');
 return {word_id: word_id.toLowerCase(), remembered: input.remembered};
}
export function summarizeAccountReviews(rows) {
 const known = rows.filter(row => row.remembered === true).length;
 return {reviewed: rows.length, known, needs_review: rows.length - known};
}
