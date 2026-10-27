/* WordSky UX-10: browser-only local progress and separately authenticated account progress. */
import {loadAccount,learningApi,postAccountReview,postUnifiedAccountReview,exactCatalogMatch,eligibleImports} from './ux10-account-core.js';
import {selectLearningView} from './ux11-dashboard-model.js';
import {publicVocabularySummary} from './ux12-catalog-summary.js';
import {SERVER_PROGRESS_KEY,SOURCE_PREFERENCE_KEY,parseServerProgress,serverCatalogView,saveServerProgress,loadCachedCatalog,validateAndCacheCatalog,lastPersonalSelection} from './ux15-dashboard-data.js';
import {eligibleServerImports} from './ux16-account-import.js';
import {buildUnifiedAccountView} from './ux19-unified-account.js';
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
  let serverCatalog=null,serverProgress={learned:{},error:null};
  let selectedScope='auto',manualScope=false,serverCatalogError='';
  let unified={kind:'checking'},unifiedTicket=0,unifiedSaving=false;
  const unifiedStatus=byId('ws19AccountStatus');
  async function refreshUnified() {
    const ticket=++unifiedTicket;
    unified={kind:'checking'};render();
    try {
      const auth=await learningApi('auth/me');
      if(auth.actor?.role!=='player'||!auth.actor?.id) {
        if(ticket!==unifiedTicket)return;
        unified={kind:'guest'};
        ++requestNumber;account={kind:'guest'};
        render();return;
      }
      const actorId=auth.actor.id;
      const payload=await learningApi('learning/me/summary');
      const view=buildUnifiedAccountView(payload,actorId);
      const active=await learningApi('auth/me');
      if(active.actor?.role!=='player'||active.actor.id!==actorId)
        throw Error('Phiên đăng nhập đã thay đổi; không hiển thị dữ liệu của tài khoản trước.');
      if(ticket!==unifiedTicket)return;
      unified={kind:'ready',actor:auth.actor,view};
    } catch(e) {
      if(ticket!==unifiedTicket)return;
      unified={kind:'error',message:e.message||'Không thể tải tiến độ'};
    }
    if(ticket===unifiedTicket)render();
  }
  const scopeSelect=byId('ws15Scope');
  const scopeStatus=byId('ws15ScopeStatus');
  function scopeView(){
    if(unified.kind==='ready')return unified.view;
    if(unified.kind==='error')return {source:'unified-error',words:[],learned:{},initialized:true,
      error:'Chưa tải được tiến độ từ tài khoản PostgreSQL: '+unified.message+
        '. Không sử dụng số liệu trên thiết bị để thay thế kết quả tài khoản.'};
    if(unified.kind==='checking')return {source:'unified-pending',words:[],learned:{},initialized:false,
      error:null};
    const base=selectLearningView(state,{kind:'guest'});
    const server=serverCatalogView(serverCatalog,serverProgress);
    if(manualScope){
      if(selectedScope==='local')return base.source==='account'?{...state,source:'browser'}:base;
      if(selectedScope==='server'&&server)return server;
      if(selectedScope==='account'&&base.source==='account')return base;
    }
    if(base.source==='account')return base;
    if(server&&!lastPersonalSelection(localStorage))return server;
    return base;
  }
  async function refreshServerCatalog(){
    try{
      const res=await fetch('/api/learning/vocabulary',{credentials:'same-origin',cache:'no-store'});
      if(!res.ok)throw Error('HTTP '+res.status);
      serverCatalog=validateAndCacheCatalog(localStorage,await res.json());
      serverCatalogError='';
    }catch{
      serverCatalogError='Không kiểm tra được kho từ mới nhất.';
      try{serverCatalog=loadCachedCatalog(localStorage)}catch{serverCatalog=null}
    }
    render();
  }
  const accountMsg = byId('ws10AccountMessage');
  const accountStats = byId('ws10AccountStats');
  const accountWords = byId('ws10AccountWords');
  const accountImport = byId('ws10Import');
  const serverImport = byId('ws16ServerImport');
  const serverImportInfo = byId('ws16ServerImportInfo');
  const accountRefresh = byId('ws10Refresh');
  const accountLogin = byId('ws10LoginLink');
  const importInfo = byId('ws10ImportInfo');
  function showNotice(message) {accountNotice = message; displayAccount();}
  function displayAccount() {
    const ready = account.kind === 'ready' && unified.kind==='ready' && account.actor.id===unified.actor.id;
    accountLogin.hidden = account.kind !== 'guest';
    accountRefresh.hidden = !ready;
    accountStats.hidden = !ready || unified.kind === 'ready';
    accountWords.replaceChildren();
    const notice = byId('ws10AccountNotice');
    notice.hidden = !accountNotice;
    notice.textContent = accountNotice;
    accountImport.hidden = true;
    importInfo.hidden = true;
    serverImport.hidden = true;
    serverImportInfo.hidden = true;
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
    accountImport.textContent = busy ? 'Đang đồng bộ…' : 'Chuyển ' + Math.min(plan.eligible.length,20) + ' từ cá nhân';
    const uuidPlan=eligibleServerImports(serverCatalog,serverProgress,account.catalog,account.words);
    serverImportInfo.hidden = false;
    serverImportInfo.textContent = uuidPlan.error
      ? 'Không thể chuyển từ kho máy chủ: ' + uuidPlan.error
      : 'Kho máy chủ trên thiết bị: ' + uuidPlan.eligible.length +
        ' từ đã nhớ đủ điều kiện chuyển lên tài khoản, ' + uuidPlan.unmatched +
        ' từ không đối chiếu được UUID/nội dung, ' + uuidPlan.alreadyReviewed +
        ' từ đã có trạng thái trên tài khoản. Không ghi đè quyết định cũ.';
    serverImport.hidden = !!uuidPlan.error || uuidPlan.eligible.length === 0;
    serverImport.disabled = busy || accountSaving;
    serverImport.textContent = busy ? 'Đang đồng bộ…'
      : 'Chuyển ' + Math.min(uuidPlan.eligible.length,20) + ' từ kho máy chủ';
    if(unified.kind==='ready')return; // Main unified library is the only displayed account total/list.
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
  serverImport.addEventListener('click', async () => {
    if(account.kind!=='ready'||busy||accountSaving)return;
    const plan=eligibleServerImports(serverCatalog,serverProgress,account.catalog,account.words);
    if(plan.error||!plan.eligible.length)return;
    const batch=plan.eligible.slice(0,20);
    if(!window.confirm('Chuyển '+batch.length+' từ đã nhớ từ KHO MÁY CHỦ trên trình duyệt này lên tài khoản? Chỉ chuyển từ khớp UUID và nội dung, chưa có tiến độ trên tài khoản. Không xóa bộ từ hay trạng thái trên thiết bị.'))return;
    const clickedBy=account.actor.id;
    busy=true;displayAccount();
    let complete=0,error='';
    try{
      await remoteQueue;
      for(const entry of batch){
        try{
          const session=await learningApi('auth/me');
          if(session.actor?.role!=='player'||session.actor.id!==clickedBy)
            throw new Error('Tài khoản đã thay đổi. Ngừng đồng bộ để bảo vệ dữ liệu.');
          // The API also checks expected_actor_id atomically with its session.
          await postAccountReview(entry.word_id,true,clickedBy);
          complete++;
          account.words.unshift({word_id:entry.word_id,english:entry.english,topic:'',remembered:true});
        }catch(e){error=e.message;break;}
      }
    }finally{
      busy=false;
      await refreshAccount();
      showNotice('Đã chuyển '+complete+' từ kho máy chủ lên tài khoản.'+
        (error?' Các từ còn lại chưa chuyển: '+error:''));
    }
  });
  accountRefresh.addEventListener('click',()=>{refreshAccount();refreshUnified()});
  async function updateUnifiedCard(card,remembered) {
    if(unified.kind!=='ready'||unifiedSaving||busy)return;
    const actorId=unified.actor.id;
    unifiedSaving=true;render();
    try {
      const auth=await learningApi('auth/me');
      if(auth.actor?.role!=='player'||auth.actor.id!==actorId)
        throw Error('Tài khoản đã thay đổi. Không lưu sang tài khoản khác.');
      if(card.source!=='shared'&&card.source!=='personal')
        throw Error('Nguồn từ không hợp lệ.');
      await postUnifiedAccountReview(card.source,
        card.source==='shared'?card.word_id:card.personal_word_id,
        remembered,actorId,card.review_count);
      await refreshUnified();
      showNotice('Đã lưu từ “'+card.english+'” theo tài khoản WordSky.');
    }catch(e){
      if(e.status===409){
        await refreshUnified();
        showNotice(unified.kind==='ready'
          ? 'Từ “'+card.english+'” đã thay đổi trên thiết bị khác. Đã tải trạng thái mới; xem lại và bấm xác nhận nếu muốn thay đổi.'
          : 'Từ “'+card.english+'” đã thay đổi trên thiết bị khác. Chưa tải lại được dữ liệu, vui lòng thử tải lại trước khi thao tác.');
      }else showNotice('Chưa lưu được vào tài khoản: '+e.message);
    }finally{unifiedSaving=false;render();}
  }
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
    const view = scopeView();
    const isUnified=view.source==='unified';
    const waitingAccount=view.source==='unified-pending'||view.source==='unified-error';
    const isAccount=view.source==='account'||isUnified,isServer=view.source==='server';
    const accountMode=isUnified||waitingAccount;
    scopeSelect.closest('.ws15-scope').hidden=accountMode;
    const personalPanel=byId('ws18AccountSummary')?.closest('.ws15-scope');
    if(personalPanel)personalPanel.hidden=accountMode;
    unifiedStatus.hidden=!accountMode;
    unifiedStatus.textContent=isUnified
      ? 'Một kết quả cho tài khoản '+(unified.actor.profile?.display_name||'WordSky')+
        ': '+view.summary.shared.known+'/'+view.summary.shared.total+' từ chung và '+
        view.summary.personal.known+'/'+view.summary.personal.total+' từ cá nhân đã nhớ. Dữ liệu được đọc trực tiếp từ PostgreSQL.'
      :waitingAccount?(view.error||'Đang lấy tiến độ theo tài khoản…'):'';
    scopeSelect.querySelector('option[value="account"]').disabled=!isAccount&&account.kind!=='ready';
    scopeSelect.querySelector('option[value="server"]').disabled=!serverCatalog;
    scopeSelect.value=isAccount?'account':isServer?'server':'local';
    scopeStatus.textContent=isAccount?'Đang xem tiến độ PostgreSQL theo tài khoản.'
      :isServer?'Đang xem tiến độ UUID kho máy chủ lưu trên thiết bị này. '+serverCatalogError+
        ' Trình duyệt khác sẽ không có tiến độ này nếu chưa được đồng bộ vào tài khoản.'
      :'Đang xem bộ từ cá nhân trên thiết bị này. '+serverCatalogError+
        ' Dữ liệu trình duyệt khác không tự được chia sẻ.';
    const {total, known, review, percent} = summarize(view.words,view.learned);
    const publicCatalog = byId('ws10PublicCatalog');
    publicCatalog.hidden = accountMode || !serverVocabularySummary;
    if (serverVocabularySummary) publicCatalog.textContent =
      'Kho từ máy chủ: ' + serverVocabularySummary.words.toLocaleString('vi-VN') +
      ' từ / ' + serverVocabularySummary.topics.toLocaleString('vi-VN') +
      ' chủ đề. ' + (isAccount
        ? 'Đây là kho từ đang dùng để tính tiến độ tài khoản.'
        : isServer ? 'Số liệu đang hiển thị là tiến độ học kho máy chủ trên thiết bị này.'
        : 'Bộ Flashcard cá nhân là danh sách riêng; hệ thống không tự thay thế hoặc xóa tiến độ đã nhớ.');
    byId('ws10SourceBadge').textContent = waitingAccount?'ACCOUNT · PENDING':isUnified?'ACCOUNT · POSTGRESQL':isAccount?'ACCOUNT · POSTGRESQL':isServer?'SERVER · THIS DEVICE':'PERSONAL · THIS DEVICE';
    byId('ws10HeroScope').textContent = accountMode?'ACCOUNT':isAccount?'ACCOUNT':isServer?'SERVER · LOCAL':'PERSONAL · LOCAL';
    byId('ws10StorageTitle').textContent = waitingAccount?'Đang xác minh dữ liệu tài khoản':isUnified?'My Learning thống nhất theo tài khoản':isAccount ? 'Tiến độ theo tài khoản đang đăng nhập'
      : isServer?'Kho từ máy chủ — tiến độ trên thiết bị':'Bộ từ cá nhân — tiến độ trên thiết bị';
    byId('ws10StorageText').textContent = waitingAccount?(view.error||'Đang tải tiến độ theo tài khoản; chưa dùng số liệu trên trình duyệt.'):
      isUnified?'Tất cả số liệu chính lấy từ một API PostgreSQL theo tài khoản, gồm từ chung và từ cá nhân. Đăng nhập cùng tài khoản trên bất kỳ trình duyệt nào để nhận cùng kết quả.' : isAccount
      ? 'Dữ liệu từ PostgreSQL theo tài khoản; có thể dùng trên trình duyệt khác khi đồng bộ thành công.'
      : (account.kind==='error'?'Chưa đồng bộ tài khoản: '+account.message+'. ':'') +
        (isServer?'Các từ lấy từ kho chung PostgreSQL nhưng dấu đã nhớ được lưu riêng theo UUID trong trình duyệt này.'
          :'Dấu đã nhớ của bộ Flashcard cá nhân chỉ lưu trong trình duyệt này.')+
        ' Không tự chia sẻ tiến độ giữa Chrome, Safari hoặc điện thoại.';
    byId('ws10TotalHint').textContent = isUnified?'Từ chung và từ cá nhân theo tài khoản':isAccount||isServer ? 'Từ đang bật trong kho từ máy chủ' : 'Từ bộ Flashcard cá nhân';
    byId('ws10KnownHint').textContent = isAccount ? 'Đã nhớ theo tài khoản' : isServer?'Đã nhớ trên thiết bị (theo UUID)':'Đã nhớ trên thiết bị (bộ cá nhân)';
    byId('ws10ReviewHint').textContent = isAccount ? 'Chưa học hoặc cần ôn theo tài khoản' : 'Chưa đánh dấu đã nhớ ở nguồn đang xem';
    byId('ws10PercentHint').textContent = isAccount ? 'Tỷ lệ theo tài khoản' : 'Tỷ lệ trong nguồn từ vựng đang xem';
    byId('ws10LibraryHint').textContent = isUnified?'Tất cả từ chung và cá nhân của tài khoản. Các thao tác được ghi trực tiếp vào PostgreSQL.' : isAccount ? 'Kho từ tài khoản — cập nhật PostgreSQL.'
      : isServer?'Kho từ máy chủ — thao tác ở đây chỉ đổi tiến độ UUID trên thiết bị.'
      : 'Bộ từ cá nhân — thao tác cập nhật trạng thái riêng trên thiết bị.';
    byId('ws10WordsTitle').textContent = isUnified?'Tất cả từ của tài khoản ✳':isAccount ? 'Kho từ theo tài khoản ✳' : isServer?'Kho từ máy chủ ✳':'Bộ từ cá nhân ✳';
    byId('ws10Total').textContent = waitingAccount?'—':total.toLocaleString('vi-VN');
    byId('ws10Known').textContent = waitingAccount?'—':known.toLocaleString('vi-VN');
    byId('ws10Review').textContent = waitingAccount?'—':review.toLocaleString('vi-VN');
    byId('ws10Percent').textContent = waitingAccount?'—':percent+'%';
    byId('ws10RingValue').textContent = waitingAccount?'—':percent+'%';
    byId('ws10Ring').style.setProperty('--value',waitingAccount?'0':String(percent));
    byId('ws10RingCaption').textContent = waitingAccount
      ? (view.error||'Đang tải tiến độ tài khoản…')
      : total ? known+' / '+total+(isAccount?' từ theo tài khoản':isServer?' từ kho máy chủ đã nhớ trên thiết bị':' từ cá nhân đã nhớ trên thiết bị')
      : 'Chưa có từ vựng trong nguồn đang xem.';
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
      knownBtn.disabled = !!view.error || (isAccount && (accountSaving || unifiedSaving || busy));
      reviewBtn.disabled = !!view.error || (isAccount && (accountSaving || unifiedSaving || busy));
      knownBtn.addEventListener('click', () => isUnified ? updateUnifiedCard(card, true) : isAccount ? updateAccountCard(card, true) : isServer ? updateServerCard(card,true) : updateCard(card,true));
      reviewBtn.addEventListener('click', () => isUnified ? updateUnifiedCard(card, false) : isAccount ? updateAccountCard(card, false) : isServer ? updateServerCard(card,false) : updateCard(card,false));
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
    try{serverProgress=parseServerProgress(localStorage.getItem(SERVER_PROGRESS_KEY))}
    catch{serverProgress={learned:{},error:'Không đọc được tiến độ kho máy chủ. Trình duyệt có thể chặn lưu trữ.'}}
    render();
  }
  function updateServerCard(card,remembered) {
    if(serverProgress.error||!card.word_id)return;
    try{
      const next=saveServerProgress(localStorage,card.word_id,remembered);
      serverProgress={learned:next,error:null};
      render();
      // Local UUID marks are always retained, even if account sync fails.
      // No automatic import of previous marks happens here.
      if(account.kind==='ready')queueReview(card,remembered);
    }catch(e){
      serverProgress={...serverProgress,error:e.message||'Không thể lưu tiến độ kho máy chủ.'};
      render();
    }
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
  scopeSelect.addEventListener('change',()=>{
    if(unified.kind==='ready'||unified.kind==='error'||unified.kind==='checking')return;
    manualScope=true;selectedScope=scopeSelect.value;state.visible=60;
    if(selectedScope==='server'||selectedScope==='local'){
      try{localStorage.setItem(SOURCE_PREFERENCE_KEY,selectedScope)}catch{}
    }
    render();
  });
  for (const element of [search, topicFilter, statusFilter]) {
    element.addEventListener(element === search ? 'input' : 'change', () => {state.visible = 60; render()});
  }
  byId('ws10More').addEventListener('click', () => {state.visible += 60; render()});
  window.addEventListener('storage', event => {
    if(!event.key || [VOCAB_KEY,LEARNED_KEY,SERVER_PROGRESS_KEY,SOURCE_PREFERENCE_KEY].includes(event.key)){
      reload();
    }
  });
  window.addEventListener('focus', () => {reload();refreshUnified();refreshAccount();refreshServerCatalog()});
  try{serverCatalog=loadCachedCatalog(localStorage)}catch{}
  reload();
  refreshUnified();
  refreshAccount();
  refreshServerCatalog();
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