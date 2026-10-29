/* UX27: learn from game mistakes without rewriting the learner's SRS history.
 * Source of truth: existing user-owned ws_solo_runs JSONB, no new table/migration.
 * Every SQL query is account-scoped and uses the server-authenticated actor.
 */
import {sql} from './db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WORDS_PER_RUN = 30;
const MAX_NOTEBOOK_WORDS = 200;

export function validWrongWordIds(state) {
  if (!state || !Array.isArray(state.wrongWordIds)) return [];
  return [...new Set(state.wrongWordIds.filter(
    id => typeof id === 'string' && UUID.test(id)
  ))].slice(0, MAX_WORDS_PER_RUN);
}

// Only call this after authorizing the Solo run and confirming a terminal state.
// Never send word/meaning pairs (or their server word IDs) during active play.
export async function getFinishedRunWrongWords(db, state) {
  if (!state || state.status === 'PLAYING') return [];
  const ids = validWrongWordIds(state);
  if (!ids.length) return [];
  const r = await db.query(
    'SELECT w.id::text AS word_id,w.english,w.meaning,w.ipa,'+
    't.title AS topic,w.cefr_level FROM ws_words w '+
    'JOIN ws_topics t ON t.id=w.topic_id '+
    'WHERE w.id=ANY($1::uuid[]) ORDER BY array_position($1::uuid[],w.id)',
    [ids]
  );
  return r.rows;
}

// Only complete, account-owned runs count. Old/anonymous runs are not retroactively
// attributed to an account; gameplay errors without an identifiable word are omitted.
export async function getAccountGameMistakeNotebook(userId) {
  const r = await sql(
    'SELECT w.id::text AS word_id,w.english,w.meaning,w.ipa,w.example,'+
    'w.translation,w.cefr_level,t.title AS topic,'+
    'count(DISTINCT sr.id)::int AS mistake_runs,'+
    'max(sr.finished_at) AS last_seen_at,'+
    'array_agg(DISTINCT sr.mode ORDER BY sr.mode) AS modes,'+
    'coalesce(p.review_count,0)::int AS review_count,'+
    'coalesce(p.remembered,false) AS remembered '+
    'FROM ws_solo_runs sr '+
    'CROSS JOIN LATERAL jsonb_array_elements_text('+
    "CASE WHEN jsonb_typeof(sr.state->'wrongWordIds')='array' "+
    "THEN sr.state->'wrongWordIds' ELSE '[]'::jsonb END"+
    ') AS mistake(word_id) '+
    'JOIN ws_words w ON w.id::text=mistake.word_id '+
    'JOIN ws_topics t ON t.id=w.topic_id '+
    'LEFT JOIN ws_learning_word_progress p ON p.user_id=$1 AND p.word_id=w.id '+
    "WHERE sr.user_id=$1 AND sr.status IN ('COMPLETED','FAILED','TIMEOUT') "+
    'AND sr.finished_at IS NOT NULL AND w.enabled=true AND t.enabled=true '+
    'GROUP BY w.id,t.title,p.review_count,p.remembered '+
    'ORDER BY last_seen_at DESC,mistake_runs DESC,w.id LIMIT $2',
    [userId, MAX_NOTEBOOK_WORDS + 1]
  );
  return {
    scope: 'account-game-mistakes',
    actor_id: userId,
    words: r.rows.slice(0, MAX_NOTEBOOK_WORDS),
    has_more: r.rows.length > MAX_NOTEBOOK_WORDS,
    limit: MAX_NOTEBOOK_WORDS
  };
}
