import {sql,transaction} from './db.js';
import {fail} from './game.js';
import {validateFlashcardReview,summarizeAccountReviews} from './learning-progress-core.js';
export async function recordFlashcardReview(userId,payload) {
 let review;
 try {review=validateFlashcardReview(payload)} catch (e) {throw fail(e.message,400)}
 return transaction(async db => {
  const word=await db.query('SELECT w.id FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id WHERE w.id=$1 AND w.enabled=true AND t.enabled=true',[review.word_id]);
  if (!word.rows.length) throw fail('Từ vựng không tồn tại hoặc đã bị ẩn',404);
  const saved=await db.query('INSERT INTO ws_learning_flashcard_reviews(user_id,word_id,remembered) VALUES($1,$2,$3) RETURNING reviewed_at',[userId,review.word_id,review.remembered]);
  await db.query('INSERT INTO ws_learning_word_progress(user_id,word_id,remembered,review_count,last_reviewed_at) VALUES($1,$2,$3,1,$4) ON CONFLICT(user_id,word_id) DO UPDATE SET remembered=EXCLUDED.remembered,review_count=ws_learning_word_progress.review_count+1,last_reviewed_at=EXCLUDED.last_reviewed_at',[userId,review.word_id,review.remembered,saved.rows[0].reviewed_at]);
  return {scope:'account',word_id:review.word_id,remembered:review.remembered,reviewed_at:saved.rows[0].reviewed_at};
 });
}
export async function getFlashcardProgress(userId) {
 const {rows}=await sql('SELECT p.word_id,p.remembered,p.review_count,p.last_reviewed_at,w.english,w.meaning,t.title AS topic FROM ws_learning_word_progress p JOIN ws_words w ON w.id=p.word_id JOIN ws_topics t ON t.id=w.topic_id WHERE p.user_id=$1 AND w.enabled=true AND t.enabled=true ORDER BY p.last_reviewed_at DESC,p.word_id ASC',[userId]);
 return {scope:'account',summary:summarizeAccountReviews(rows),words:rows};
}

// Used only for authenticated, exact-match reconciliation with legacy Flashcards.
// Expose full card fields so the client never equates a custom deck with a DB word by name alone.
export async function getFlashcardCatalog() {
 const {rows}=await sql('SELECT w.id AS word_id,t.title AS topic,w.english,w.ipa,w.meaning,w.example,w.translation FROM ws_words w JOIN ws_topics t ON t.id=w.topic_id WHERE w.enabled=true AND t.enabled=true ORDER BY t.title,w.english,w.id LIMIT 5001');
 if (rows.length>5000) throw fail('Kho từ quá lớn để đồng bộ',503);
 return {scope:'catalog',words:rows};
}
