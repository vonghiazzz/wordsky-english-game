/* Summarize public server vocabulary by topic without modifying local cards. */
export function publicVocabularySummary(payload) {
  if (!payload || !Array.isArray(payload.topics)) return null;
  let words=0,topics=0;
  for (const topic of payload.topics) {
    if (topic?.enabled !== true) continue;
    if (!Number.isSafeInteger(topic.word_count) || topic.word_count < 0) return null;
    words += topic.word_count;
    topics++;
    if (!Number.isSafeInteger(words)) return null;
  }
  return {words,topics};
}
