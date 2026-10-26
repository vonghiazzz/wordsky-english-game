/* WordSky UX-10: exact legacy Flashcard <-> PostgreSQL identity and authenticated API.
 * Account sync never mutates browser storage, and never guesses a UUID from English alone. */
const text = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
export function exactFingerprint(card) {
  return JSON.stringify([
    text(card.topic),
    text(card.english).toLocaleLowerCase('en'),
    text(card.ipa),
    text(card.meaning),
    text(card.example),
    text(card.translation)
  ]);
}
export function catalogIndex(words) {
  const index = new Map();
  for (const card of Array.isArray(words) ? words : []) {
    if (!card || typeof card.word_id !== 'string') continue;
    const fingerprint = exactFingerprint(card);
    if (!index.has(fingerprint)) index.set(fingerprint, card);
    else index.set(fingerprint, null); // ambiguous: do not sync
  }
  return index;
}
export function exactCatalogMatch(card, index) {
  return index instanceof Map ? index.get(exactFingerprint(card)) || null : null;
}
export function eligibleImports(words, learned, index, accountWords) {
  // Existing account decisions always win over historical local state.
  const reviewed = new Set((Array.isArray(accountWords) ? accountWords : []).map(card => card.word_id));
  const seen = new Set();
  const eligible = [];
  let unmatched = 0, alreadyReviewed = 0;
  for (const card of words) {
    if (learned[card.key] !== true) continue;
    const match = exactCatalogMatch(card, index);
    if (!match) {unmatched++; continue;}
    if (reviewed.has(match.word_id) || seen.has(match.word_id)) {alreadyReviewed++; continue;}
    seen.add(match.word_id);
    eligible.push({word_id: match.word_id, remembered:true, english:card.english});
  }
  return {eligible, unmatched, alreadyReviewed};
}
export async function learningApi(path, {method='GET', body}={}) {
  const response = await fetch('/api/' + path, {
    method, credentials:'same-origin', cache:'no-store',
    headers: body === undefined ? {} : {'content-type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json;
  try {json=await response.json();} catch {throw new Error('Máy chủ trả về dữ liệu không hợp lệ');}
  if (!response.ok) {
    const error = new Error(typeof json.error === 'string' ? json.error : 'Không truy cập được tiến độ tài khoản');
    error.status = response.status;
    throw error;
  }
  return json;
}
export async function loadAccount() {
  const auth = await learningApi('auth/me');
  if (auth.actor?.role !== 'player' || !auth.actor?.id) return {kind:'guest'};
  const [catalog, progress] = await Promise.all([
    learningApi('learning/flashcards/catalog'),
    learningApi('learning/flashcards/progress')
  ]);
  if (!Array.isArray(catalog.words) || !Array.isArray(progress.words) ||
      progress.scope !== 'account' || catalog.scope !== 'catalog') throw new Error('Dữ liệu đồng bộ không hợp lệ');
  return {kind:'ready',actor:auth.actor,catalog:catalog.words,words:progress.words,index:catalogIndex(catalog.words)};
}
export async function postAccountReview(wordId, remembered, expectedActorId) {
  const body={word_id:wordId,remembered};
  if (expectedActorId) body.expected_actor_id=expectedActorId;
  const saved = await learningApi('learning/flashcards/reviews',{
    method:'POST',body
  });
  if (saved.scope !== 'account' || saved.word_id !== wordId) throw new Error('Máy chủ chưa xác nhận bản ghi');
  return saved;
}
