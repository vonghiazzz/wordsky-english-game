/* UX-13: central, read-only server vocabulary for Flashcards.
 * Never replace wordsky_vocab_v2, wordsky_learned, or an edited personal deck. */
export const VOCAB_CACHE_KEY = 'wordsky_public_vocab_cache_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WORDS = 5000;
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

export function parseServerCatalog(payload) {
  if (!payload || payload.scope !== 'catalog' || !Array.isArray(payload.words) ||
      payload.words.length > MAX_WORDS) throw new Error('Danh mục từ vựng máy chủ không hợp lệ');
  const topics = Object.create(null), ids = new Set(), keys = new Set();
  const words = [];
  for (const entry of payload.words) {
    if (!entry || !UUID.test(entry.word_id) ||
        typeof entry.topic !== 'string' || !entry.topic.trim() ||
        typeof entry.english !== 'string' || !entry.english.trim() ||
        ['ipa', 'meaning', 'example', 'translation'].some(field => typeof entry[field] !== 'string')) {
      throw new Error('Dữ liệu thẻ từ máy chủ không hợp lệ');
    }
    const key = entry.topic.toLocaleLowerCase('en') + ':' + entry.english.toLocaleLowerCase('en');
    // Browser progress uses topic+word. Reject collisions, never merge two UUIDs.
    if (ids.has(entry.word_id) || keys.has(key)) throw new Error('Danh mục máy chủ có từ trùng định danh');
    ids.add(entry.word_id);
    keys.add(key);
    const card = [entry.english, entry.ipa, entry.meaning, entry.example, entry.translation];
    (topics[entry.topic] ??= []).push(card);
    words.push({word_id: entry.word_id, topic: entry.topic, card});
  }
  return {topics, words, count:words.length, topicCount:Object.keys(topics).length};
}

export function readCachedServerCatalog(storage, now = Date.now()) {
  try {
    const raw = storage.getItem(VOCAB_CACHE_KEY);
    if (!raw || raw.length > 2_000_000) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Number.isFinite(data.savedAt) ||
        data.savedAt > now || now - data.savedAt > MAX_CACHE_AGE) return null;
    return parseServerCatalog(data.catalog);
  } catch {return null;}
}

export function saveCachedServerCatalog(storage, catalog, now=Date.now()) {
  try {
    const raw=JSON.stringify({version:1,savedAt:now,catalog});
    if (raw.length > 2_000_000) return false;
    storage.setItem(VOCAB_CACHE_KEY,raw);
    return true;
  } catch {return false;}
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const source = document.getElementById('flashSource');
  const refresh = document.getElementById('refreshVocabulary');
  const status = document.getElementById('flashVocabularyStatus');
  const host = window.WordSkyFlashcardCatalog;
  if (source && refresh && status && host) {
    let priorSource=null;
    try{priorSource=localStorage.getItem('wordsky_flashcard_source_v1')}catch{}
    let manuallySelected = priorSource==='local'||priorSource==='account', lastChecked = 0, pending = null;
    const setStatus = (message, warning=false) => {
      status.textContent=message;
      status.dataset.warning=String(warning);
    };
    source.addEventListener('change', () => {
      manuallySelected = true;
      try{localStorage.setItem('wordsky_flashcard_source_v1',source.value)}catch{}
      host.useSource(source.value);
    });
    async function update(force=false) {
      if (pending) return pending;
      if (!force && Date.now() - lastChecked < 60000) return;
      lastChecked = Date.now();
      refresh.disabled=true;
      setStatus('Đang kiểm tra từ mới trên máy chủ…');
      pending = (async () => {
        try {
          const response = await fetch('/api/learning/vocabulary',
            {cache:'no-store',credentials:'same-origin'});
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const payload = await response.json();
          const parsed = parseServerCatalog(payload);
          // Cache separately from personal vocabulary and progress.
          saveCachedServerCatalog(localStorage,payload);
          host.setServerCatalog(parsed,{activate:!manuallySelected});
          setStatus('Đã cập nhật ' + parsed.count + ' từ / ' +
            parsed.topicCount + ' chủ đề từ máy chủ.');
        } catch {
          const cached = readCachedServerCatalog(localStorage);
          if (cached) {
            host.setServerCatalog(cached,{activate:!manuallySelected});
            setStatus('Đang dùng bản lưu kho chung gần nhất ('+cached.count+
              ' từ). Chưa kiểm tra được thay đổi mới.',true);
          } else {
            host.serverUnavailable();
            setStatus('Không tải được kho từ chung. Bộ từ cá nhân vẫn an toàn và sử dụng được.',true);
          }
        } finally {
          refresh.disabled=false;
          pending=null;
        }
      })();
      return pending;
    }
    refresh.addEventListener('click', () => update(true));
    window.addEventListener('focus', () => update());
    update(true);
  }
}
