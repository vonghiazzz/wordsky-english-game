/* UX-11: one honest source of truth per Dashboard view.
 * Signed-in: account-reviewed decisions over the enabled server catalog.
 * Guest/unavailable: existing browser-only Flashcard deck, never a fake sync.
 * This module must not read/write localStorage or make network requests. */
export function selectLearningView(local, account) {
  if (account?.kind !== 'ready') {
    return {source:'browser',words:local.words || [],learned:local.learned || {},
      initialized:local.initialized,error:local.error || null};
  }
  const decisions = new Map();
  for (const row of account.words || []) {
    if (typeof row?.word_id === 'string') decisions.set(row.word_id,row.remembered === true);
  }
  const seen = new Set();
  const words = [];
  const learned = {};
  for (const row of account.catalog || []) {
    if (typeof row?.word_id !== 'string' || seen.has(row.word_id) ||
        typeof row.english !== 'string' || typeof row.topic !== 'string') continue;
    seen.add(row.word_id);
    const key='account:'+row.word_id;
    words.push({key,word_id:row.word_id,topic:row.topic,english:row.english,
      ipa:row.ipa || '',meaning:row.meaning || '',example:row.example || '',
      translation:row.translation || ''});
    if (decisions.get(row.word_id) === true) learned[key]=true;
  }
  return {source:'account',words,learned,initialized:true,error:null};
}
