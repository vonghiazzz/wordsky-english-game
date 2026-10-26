/* WordSky UX-10: browser-only local progress and separately authenticated account progress. */
import {loadAccount,learningApi,postAccountReview,exactCatalogMatch,eligibleImports} from './ux10-account-core.js';
import {selectLearningView} from './ux11-dashboard-model.js';
import {publicVocabularySummary} from './ux12-catalog-summary.js';
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
        words.push({key, topic, english, ipa: card[1], meaning: card[2], example: card[3], translation: card[4]});
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
  return {total, known, review: total - known, percent: total ? Math.round(known * 1000 / total) / 10 : 0};
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
  let account = {kind:'checking'}, accountNotice = '', requestNumber = 0, busy = false;
  let remoteQueue = Promise.resolve(), accountSaving = false;
  let serverVocabularySummary = null;
  const accountMsg = byId('ws10AccountMessage');
  const accountStats = byId('ws10AccountStats');
  const accountWords = byId('ws10AccountWords');
  const accountImport = byId('ws10Import');
  const accountRefresh = byId('ws10Refresh');
  const accountLogin = byId('ws10LoginLink');
  const importInfo = byId('ws10ImportInfo');
  function showNotice(message) {accountNotice = message; displayAccount();}
  function displayAccount() {
    const ready = account.kind === 'ready';
    accountLogin.hidden = account.kind !== 'guest';
    accountRefresh.hidden = !ready;
    accountStats.hidden = !ready;
    accountWords.replaceChildren();
    const notice = byId('ws10AccountNotice');
    notice.hidden = !accountNotice;
    notice.textContent = accountNotice;
    accountImport.hidden = true;
    importInfo.hidden = true;
    if (!ready) {
      accountMsg.textContent = account.kind === 'guest'
        ? 'Chưa đăng nhập học viên. Tiến độ trên thiết bị vẫn hoạt động; đăng nhập tại Trang chủ để đồng bộ từ tương ứng với kho từ máy chủ.'
        : account.kind === 'error'
        ? 'Không thể tải tiến độ tài khoản: ' + account.message + '. Tiến độ trên thiết bị không bị ảnh hưởng.'
        : 'Đang xác minh tài khoản và tiến độ đã lưu…';
      return;
    }
    const reviewed = account.words.length;
    const known = account.words.filter(word => word.remembered === true).length;
    accountMsg.textContent = 'Đã đăng nhập: ' + (account.actor.profile?.display_name || 'Học viên') +
      '. Dữ liệu bên dưới lưu trên PostgreSQL và có thể xem trên thiết bị khác sau khi đăng nhập cùng tài khoản.';
    byId('ws10AccountReviewed').textContent = String(reviewed);
    byId('ws10AccountKnown').textContent = String(known);
    byId('ws10AccountReview').textContent = String(reviewed - known);
    const plan = eligibleImports(state.words, state.learned, account.index, account.words);
    importInfo.hidden = false;
    importInfo.textContent = 'Có thể chuyển ' + plan.eligible.length + ' từ đã nhớ trên thiết bị lên tài khoản; ' +
      plan.unmatched + ' từ không khớp chính xác, ' + plan.alreadyReviewed + ' từ đã có quyết định trên tài khoản. Không tự ghi đè dữ liệu tài khoản.';
    accountImport.hidden = plan.eligible.length === 0;
    accountImport.disabled = busy || accountSaving;
    accountImport.textContent = busy ? 'Đang đồng bộ…' : 'Đồng bộ ' + Math.min(plan.eligible.length,20) + ' từ đã nhớ';
    const heading = node('h3', '', 'Những từ đã ôn theo tài khoản');
    accountWords.append(heading);
    if (!reviewed) {
      accountWords.append(node('p','ws10-account-empty','Chưa có từ được ghi nhận trên tài khoản này.'));
    } else {
      const fragment = document.createDocumentFragment();
      for (const word of account.words.slice(0,40)) {
        const item = node('div','ws10-account-word');
        item.append(node('strong','',word.english),node('span','',word.topic),
          node('span',word.remembered ? 'ws10-account-known' : 'ws10-account-review',
            word.remembered ? '✓ Đã nhớ' : '↻ Cần ôn'));
        fragment.append(item);
      }
      accountWords.append(fragment);
      if (reviewed>40) accountWords.append(node('p','ws10-account-empty','Đang hiển thị 40 / ' + reviewed + ' từ đã ôn.'));
    }
  }
  async function refreshAccount() {
    if (busy) return;
    const current = ++requestNumber;
    account = {kind:'checking'}; accountNotice = ''; displayAccount();
    try {
      const result = await loadAccount();
      if (current !== requestNumber) return;
      account = result;
    } catch (error) {
      if (current !== requestNumber) return;
      account = {kind:'error',message:error.message || 'Lỗi kết nối'};
    }
    render();
  }
  function queueReview(card, remembered) {
    // Capture the actor at click time. A window-focus event may start refreshing
    // account state before the queued review executes; never silently drop it.
    const clickedBy = account.kind === 'ready' ? account.actor.id : null;
    remoteQueue = remoteQueue.then(async () => {
      try {
        const currentSession = await learningApi('auth/me');
        if (currentSession.actor?.role !== 'player' || !currentSession.actor.id) {
          if (clickedBy) showNotice('Phiên đăng nhập đã kết thúc. Từ vẫn được lưu trên thiết bị.');
          return;
        }
        if (clickedBy && clickedBy !== currentSession.actor.id) {
          showNotice('Tài khoản đã thay đổi. Không gửi tiến độ của phiên trước sang tài khoản mới.');
          return;
        }
        const active = account.kind === 'ready' && account.actor.id === currentSession.actor.id
          ? account : await loadAccount();
        if (active.kind !== 'ready' || active.actor.id !== currentSession.actor.id) {
          showNotice('Từ đã lưu trên thiết bị. Chưa xác nhận được tài khoản để đồng bộ.');
          return;
        }
        const target = exactCatalogMatch(card, active.index);
        if (!target) {
          showNotice('Từ này chỉ lưu trên trình duyệt vì không khớp chính xác với dữ liệu tài khoản.');
          return;
        }
        await postAccountReview(target.word_id, remembered, currentSession.actor.id);
        // Refresh from the server so a concurrent focus refresh cannot replace
        // the newer review with a stale in-memory account snapshot.
        await refreshAccount();
        showNotice('Đã lưu từ “' + card.english + '” lên tài khoản.');
      } catch (error) {
        showNotice('Từ vẫn được lưu trên thiết bị; đồng bộ tài khoản thất bại: ' + error.message);
      }
    }).catch(() => showNotice('Không thể đồng bộ; dữ liệu trên trình duyệt được giữ nguyên.'));
  }
  async function updateAccountCard(card, remembered) {
    if (account.kind !== 'ready' || accountSaving || busy || !card.word_id) return;
    const clickedBy = account.actor.id;
    accountSaving = true;
    render();
    try {
      await remoteQueue;
      const session = await learningApi('auth/me');
      if (session.actor?.role !== 'player' || session.actor.id !== clickedBy)
        throw new Error('Phiên đăng nhập đã thay đổi; không ghi sang tài khoản khác.');
      await postAccountReview(card.word_id,remembered,clickedBy);
      await refreshAccount();
      showNotice('Đã lưu “' + card.english + '” lên tài khoản.');
    } catch (error) {
      showNotice('Không thể lưu tài khoản; dữ liệu trình duyệt không bị thay đổi: ' + error.message);
    } finally {
      accountSaving = false;
      render();
    }
  }
  accountImport.addEventListener('click', async () => {
    if (account.kind !== 'ready' || busy || accountSaving) return;
    const plan = eligibleImports(state.words,state.learned,account.index,account.words);
    if (!plan.eligible.length) return;
    const batch = plan.eligible.slice(0,20);
    if (!window.confirm('Chỉ chuyển ' + batch.length +
      ' từ khớp chính xác, chưa có tiến độ trên tài khoản. Không xóa dữ liệu trình duyệt. Xác nhận?')) return;
    const clickedBy = account.actor.id;
    busy = true; displayAccount();
    let complete = 0, error = '';
    try {
      await remoteQueue;
      for (const entry of batch) {
        try {
          await postAccountReview(entry.word_id,true,clickedBy);
          complete++;
          account.words.unshift({word_id:entry.word_id,english:entry.english,topic:'',remembered:true});
        } catch (e) {error = e.message; break;}
      }
    } finally {
      busy = false;
      await refreshAccount();
      showNotice('Đã đồng bộ ' + complete + ' từ vào tài khoản.' +
        (error ? ' Còn từ chưa đồng bộ: ' + error : ''));
    }
  });
  accountRefresh.addEventListener('click', refreshAccount);
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
    const view = selectLearningView(state,account);
    const isAccount = view.source === 'account';
    const {total, known, review, percent} = summarize(view.words,view.learned);
    const publicCatalog = byId('ws10PublicCatalog');
    publicCatalog.hidden = !serverVocabularySummary;
    if (serverVocabularySummary) publicCatalog.textContent =
      'Kho từ máy chủ: ' + serverVocabularySummary.words.toLocaleString('vi-VN') +
      ' từ / ' + serverVocabularySummary.topics.toLocaleString('vi-VN') +
      ' chủ đề. ' + (isAccount
        ? 'Đây là kho từ đang dùng để tính tiến độ tài khoản.'
        : 'Bộ Flashcard trên thiết bị là danh sách riêng; hệ thống không tự thay thế bộ từ hoặc xóa tiến độ đã nhớ của bạn.');
    byId('ws10SourceBadge').textContent = isAccount ? 'ACCOUNT · POSTGRESQL' : 'BROWSER ONLY';
    byId('ws10HeroScope').textContent = isAccount ? 'ACCOUNT' : 'LOCAL';
    byId('ws10StorageTitle').textContent = isAccount ? 'Tiến độ theo tài khoản đang đăng nhập' : 'Tiến độ Flashcard trên thiết bị này';
    byId('ws10StorageText').textContent = isAccount
      ? 'Các số liệu phía trên và thư viện từ vựng được đọc từ PostgreSQL theo tài khoản. Bộ Flashcard trên thiết bị vẫn được giữ riêng; bạn có thể chuyển từ cũ có đối chiếu chính xác bằng nút bên dưới.'
      : account.kind === 'error'
      ? 'Chưa tải được tiến độ tài khoản: ' + account.message + '. Đang chỉ hiển thị dữ liệu trên trình duyệt này; chưa có dữ liệu nào được đồng bộ.'
      : 'Các số liệu phía trên được đọc từ trình duyệt, không phải từ tài khoản. Đăng nhập và đồng bộ để dùng chung tiến độ trên nhiều thiết bị.';
    byId('ws10TotalHint').textContent = isAccount ? 'Từ đang bật trong kho từ máy chủ' : 'Từ bộ Flashcard lưu trên thiết bị';
    byId('ws10KnownHint').textContent = isAccount ? 'Đã nhớ theo tài khoản' : 'Bạn đã chọn “Đã nhớ”';
    byId('ws10ReviewHint').textContent = isAccount ? 'Bao gồm từ chưa học và cần ôn' : 'Chưa đánh dấu “Đã nhớ”';
    byId('ws10PercentHint').textContent = isAccount ? 'Tỷ lệ trên kho từ máy chủ' : 'Tỷ lệ trong bộ thẻ hiện tại';
    byId('ws10LibraryHint').textContent = isAccount ? 'Kho từ của tài khoản. Những lần đánh dấu mới được ghi lên PostgreSQL.' : 'Chọn “Đã nhớ” hoặc “Cần ôn” để cập nhật đúng trạng thái Flashcard trên thiết bị.';
    byId('ws10WordsTitle').textContent = isAccount ? 'Kho từ theo tài khoản ✳' : 'Thư viện từ vựng ✳';
    byId('ws10Total').textContent = total.toLocaleString('vi-VN');
    byId('ws10Known').textContent = known.toLocaleString('vi-VN');
    byId('ws10Review').textContent = review.toLocaleString('vi-VN');
    byId('ws10Percent').textContent = percent + '%';
    byId('ws10RingValue').textContent = percent + '%';
    byId('ws10Ring').style.setProperty('--value', String(percent));
    byId('ws10RingCaption').textContent = total ? known + ' / ' + total + (isAccount ? ' từ theo tài khoản' : ' từ đã đánh dấu nhớ trên thiết bị') : (isAccount ? 'Kho từ tài khoản hiện chưa có từ nào.' : 'Chưa có dữ liệu Flashcard trên thiết bị này.');
    alert.hidden = !view.error;
    alert.textContent = view.error || '';
    const existingTopic = topicFilter.value;
    const topics = [...new Set(view.words.map(word => word.topic))];
    topicFilter.replaceChildren(new Option('Tất cả chủ đề', ''), ...topics.map(topic => new Option(topic, topic)));
    if (topics.includes(existingTopic)) topicFilter.value = existingTopic;
    const filtered = filterWords(view.words, view.learned, {query: search.value, topic: topicFilter.value, status: statusFilter.value});
    byId('ws10Count').textContent = filtered.length.toLocaleString('vi-VN') + ' thẻ';
    list.replaceChildren();
    const empty = byId('ws10Empty');
    empty.hidden = filtered.length > 0;
    if (!filtered.length) {
      const title = !view.initialized ? 'Chưa có bộ từ được lưu' : view.error ? 'Chưa thể đọc dữ liệu' : !view.words.length ? (isAccount ? 'Kho từ máy chủ chưa có từ nào' : 'Bộ từ hiện chưa có thẻ') : 'Không tìm thấy từ phù hợp';
      const description = !view.initialized ? 'Mở Flashcard trước để khởi tạo bộ từ trên trình duyệt này.' : view.error ? 'Hãy kiểm tra bộ từ hoặc quyền lưu trữ. Không có dữ liệu nào bị xóa.' : !view.words.length ? 'Chưa có từ vựng trong phạm vi dữ liệu này.' : 'Thử một từ khóa hoặc bộ lọc khác.';
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
      const known = view.learned[card.key] === true;
      const knownBtn = node('button', 'ws10-chip' + (known ? ' is-known' : ''), '✓ Đã nhớ');
      const reviewBtn = node('button', 'ws10-chip' + (!known ? ' is-review' : ''), '↻ Cần ôn');
      for (const button of [knownBtn, reviewBtn]) button.type = 'button';
      knownBtn.setAttribute('aria-pressed', String(known));
      reviewBtn.setAttribute('aria-pressed', String(!known));
      knownBtn.setAttribute('aria-label', 'Đánh dấu đã nhớ: ' + card.english);
      reviewBtn.setAttribute('aria-label', 'Đánh dấu cần ôn: ' + card.english);
      knownBtn.disabled = !!view.error || (isAccount && (accountSaving || busy));
      reviewBtn.disabled = !!view.error || (isAccount && (accountSaving || busy));
      knownBtn.addEventListener('click', () => isAccount ? updateAccountCard(card, true) : updateCard(card, true));
      reviewBtn.addEventListener('click', () => isAccount ? updateAccountCard(card, false) : updateCard(card, false));
      actions.append(knownBtn, reviewBtn);
      row.append(wordCol, meaning, actions);
      fragment.append(row);
    }
    list.append(fragment);
    const visible = Math.min(filtered.length, state.visible);
    byId('ws10Showing').textContent = filtered.length ? 'Hiển thị ' + visible + ' / ' + filtered.length + ' từ' : '';
    byId('ws10More').hidden = state.visible >= filtered.length;
    displayAccount();
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
      queueReview(card,remembered);
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
  window.addEventListener('focus', () => {reload(); refreshAccount()});
  reload();
  refreshAccount();
  // A public, read-only catalog count clarifies why a local 260-card deck can
  // differ from the 365-word server library while account sync is unavailable.
  fetch('/api/topics', {credentials:'same-origin',cache:'no-store'})
    .then(response => response.ok ? response.json() : null)
    .then(payload => {
      serverVocabularySummary = publicVocabularySummary(payload);
      render();
    })
    .catch(() => {}); // Keep existing local metrics usable offline.
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
}