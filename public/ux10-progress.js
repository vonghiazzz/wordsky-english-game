/* WordSky UX-10: browser-only Flashcard progress. No inferred account sync or game scoring. */
export const VOCAB_KEY = 'wordsky_vocab_v2';
export const LEARNED_KEY = 'wordsky_learned';
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const cardKey = (topic, word) => topic + ':' + word.toLowerCase();
export function parseBrowserVocabulary(raw) {
  if (raw === null) return {words: [], initialized: false, error: null};
  try {
    const source = JSON.parse(raw);
    const topics = plain(source) && plain(source.topics) ? source.topics : source;
    if (!plain(topics)) throw new Error('Bộ từ không hợp lệ');
    const words = [];
    for (const [topic, cards] of Object.entries(topics)) {
      if (typeof topic !== 'string' || !Array.isArray(cards)) throw new Error('Chủ đề không hợp lệ');
      const seen = new Set();
      for (const card of cards) {
        if (!Array.isArray(card) || card.length !== 5 || card.some(item => typeof item !== 'string') || !card[0].trim()) throw new Error('Thẻ từ không hợp lệ');
        const english = card[0].trim();
        const key = cardKey(topic, english);
        if (seen.has(key)) continue;
        seen.add(key);
        words.push({key, topic, english, ipa: card[1], meaning: card[2], example: card[3]});
      }
    }
    return {words, initialized: true, error: null};
  } catch {
    return {words: [], initialized: true, error: 'Không đọc được bộ từ cũ. Dữ liệu gốc vẫn được giữ nguyên; vui lòng kiểm tra tại Flashcard.'};
  }
}
export function parseLearned(raw) {
  if (raw === null) return {learned: {}, error: null};
  try {
    const learned = JSON.parse(raw);
    if (!plain(learned)) throw new Error('Invalid progress');
    return {learned, error: null};
  } catch {
    return {learned: {}, error: 'Không đọc được trạng thái đã nhớ. Chúng tôi không ghi đè dữ liệu cũ.'};
  }
}
export function summarize(words, learned) {
  const total = words.length;
  const known = words.filter(word => learned[word.key] === true).length;
  return {total, known, review: total - known, percent: total ? Math.round(known * 100 / total) : 0};
}
export function filterWords(words, learned, {query = '', topic = '', status = 'all'} = {}) {
  const q = query.trim().toLocaleLowerCase();
  return words.filter(word => (!topic || word.topic === topic) &&
    (status !== 'known' || learned[word.key] === true) &&
    (status !== 'review' || learned[word.key] !== true) &&
    (!q || [word.english, word.meaning, word.topic].some(value => value.toLocaleLowerCase().includes(q))));
}
export function saveRemembered(storage, card, remembered) {
  const parsed = parseLearned(storage.getItem(LEARNED_KEY));
  if (parsed.error) throw new Error(parsed.error);
  const next = {...parsed.learned};
  if (remembered) next[card.key] = true;
  else delete next[card.key];
  storage.setItem(LEARNED_KEY, JSON.stringify(next));
  return next;
}
function node(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}
function boot() {
  const byId = id => document.getElementById(id);
  const list = byId('ws10WordList');
  if (!list) return;
  const state = {words: [], learned: {}, initialized: false, error: null, visible: 60};
  const search = byId('ws10Search');
  const topicFilter = byId('ws10Topic');
  const statusFilter = byId('ws10Status');
  const alert = byId('ws10Alert');
  function readLocal() {
    try {
      const vocabulary = parseBrowserVocabulary(localStorage.getItem(VOCAB_KEY));
      const progress = parseLearned(localStorage.getItem(LEARNED_KEY));
      const missingDeck = !vocabulary.initialized && Object.values(progress.learned).some(value => value === true);
      return {...vocabulary, learned: progress.learned,
        error: vocabulary.error || progress.error || (missingDeck
          ? 'Đã có từ được đánh dấu nhớ trên thiết bị này, nhưng chưa có bộ từ lưu kèm. Hãy mở Flashcard trên cùng website để lưu bộ từ, rồi quay lại My Learning.'
          : null)};
    } catch {
      return {words: [], learned: {}, initialized: false, error: 'Trình duyệt đang chặn bộ nhớ cục bộ. Không thể xem hoặc lưu tiến độ.'};
    }
  }
  function render() {
    const {total, known, review, percent} = summarize(state.words, state.learned);
    byId('ws10Total').textContent = total.toLocaleString('vi-VN');
    byId('ws10Known').textContent = known.toLocaleString('vi-VN');
    byId('ws10Review').textContent = review.toLocaleString('vi-VN');
    byId('ws10Percent').textContent = percent + '%';
    byId('ws10RingValue').textContent = percent + '%';
    byId('ws10Ring').style.setProperty('--value', String(percent));
    byId('ws10RingCaption').textContent = total ? known + ' / ' + total + ' từ đã đánh dấu nhớ' : 'Chưa có dữ liệu Flashcard trên thiết bị này.';
    alert.hidden = !state.error;
    alert.textContent = state.error || '';
    const existingTopic = topicFilter.value;
    const topics = [...new Set(state.words.map(word => word.topic))];
    topicFilter.replaceChildren(new Option('Tất cả chủ đề', ''), ...topics.map(topic => new Option(topic, topic)));
    if (topics.includes(existingTopic)) topicFilter.value = existingTopic;
    const filtered = filterWords(state.words, state.learned, {query: search.value, topic: topicFilter.value, status: statusFilter.value});
    byId('ws10Count').textContent = filtered.length.toLocaleString('vi-VN') + ' thẻ';
    list.replaceChildren();
    const empty = byId('ws10Empty');
    empty.hidden = filtered.length > 0;
    if (!filtered.length) {
      const title = !state.initialized ? 'Chưa có bộ từ được lưu' : state.error ? 'Chưa thể đọc dữ liệu' : !state.words.length ? 'Bộ từ hiện chưa có thẻ' : 'Không tìm thấy từ phù hợp';
      const description = !state.initialized ? 'Mở Flashcard trước để khởi tạo bộ từ trên trình duyệt này.' : state.error ? 'Hãy kiểm tra bộ từ hoặc quyền lưu trữ. Không có dữ liệu nào bị xóa.' : !state.words.length ? 'Thêm từ tại trang quản lý Flashcard để theo dõi tiến độ.' : 'Thử một từ khóa hoặc bộ lọc khác.';
      byId('ws10EmptyTitle').textContent = title;
      byId('ws10EmptyText').textContent = description;
    }
    const fragment = document.createDocumentFragment();
    for (const card of filtered.slice(0, state.visible)) {
      const row = node('article', 'ws10-word');
      const wordCol = node('div', 'ws10-word-word');
      wordCol.append(node('strong', '', card.english), node('span', '', card.topic + (card.ipa ? ' · ' + card.ipa : '')));
      const meaning = node('div', 'ws10-word-meaning', card.meaning);
      if (card.example) meaning.append(node('small', '', card.example));
      const actions = node('div', 'ws10-word-actions');
      const known = state.learned[card.key] === true;
      const knownBtn = node('button', 'ws10-chip' + (known ? ' is-known' : ''), '✓ Đã nhớ');
      const reviewBtn = node('button', 'ws10-chip' + (!known ? ' is-review' : ''), '↻ Cần ôn');
      for (const button of [knownBtn, reviewBtn]) button.type = 'button';
      knownBtn.setAttribute('aria-pressed', String(known));
      reviewBtn.setAttribute('aria-pressed', String(!known));
      knownBtn.setAttribute('aria-label', 'Đánh dấu đã nhớ: ' + card.english);
      reviewBtn.setAttribute('aria-label', 'Đánh dấu cần ôn: ' + card.english);
      knownBtn.disabled = !!state.error;
      reviewBtn.disabled = !!state.error;
      knownBtn.addEventListener('click', () => updateCard(card, true));
      reviewBtn.addEventListener('click', () => updateCard(card, false));
      actions.append(knownBtn, reviewBtn);
      row.append(wordCol, meaning, actions);
      fragment.append(row);
    }
    list.append(fragment);
    const visible = Math.min(filtered.length, state.visible);
    byId('ws10Showing').textContent = filtered.length ? 'Hiển thị ' + visible + ' / ' + filtered.length + ' từ' : '';
    byId('ws10More').hidden = state.visible >= filtered.length;
  }
  function reload() {
    Object.assign(state, readLocal());
    render();
  }
  function updateCard(card, remembered) {
    if (state.error) return;
    try {
      state.learned = saveRemembered(localStorage, card, remembered);
      render();
    } catch {
      state.error = 'Không thể lưu tiến độ trên thiết bị này. Dữ liệu Flashcard cũ được giữ nguyên.';
      render();
    }
  }
  for (const element of [search, topicFilter, statusFilter]) {
    element.addEventListener(element === search ? 'input' : 'change', () => {state.visible = 60; render()});
  }
  byId('ws10More').addEventListener('click', () => {state.visible += 60; render()});
  window.addEventListener('storage', event => {if (!event.key || [VOCAB_KEY, LEARNED_KEY].includes(event.key)) reload()});
  window.addEventListener('focus', reload);
  reload();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
}