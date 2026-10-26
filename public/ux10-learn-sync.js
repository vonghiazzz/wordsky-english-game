/* Account reviews are an enhancement: the legacy Flashcard saves locally first.
 * Do not automatically copy prior local progress or infer a DB word by name. */
import {loadAccount,exactCatalogMatch,postAccountReview} from './ux10-account-core.js';
let accountPromise = loadAccount().catch(() => ({kind:'unavailable'}));
// Login/logout can happen in another tab while this Flashcard stays open.
window.addEventListener('focus', () => {accountPromise = loadAccount().catch(() => ({kind:'unavailable'}));});
let queue = Promise.resolve();
function announce(message,error=false) {
  window.dispatchEvent(new CustomEvent('wordsky:flashcard-sync-status',{detail:{message,error}}));
}
window.addEventListener('wordsky:flashcard-reviewed',event=>{
  const detail = event.detail;
  if (!detail || typeof detail.topic !== 'string' || !Array.isArray(detail.card) ||
      detail.card.length !== 5 || detail.card.some(value=>typeof value !== 'string') ||
      typeof detail.remembered !== 'boolean') return;
  const [english,ipa,meaning,example,translation] = detail.card;
  const card = {topic:detail.topic,english,ipa,meaning,example,translation};
  queue = queue.then(async () => {
    const account = await accountPromise;
    if (account.kind !== 'ready') return; // Guest/error = browser-only, safely.
    const match = exactCatalogMatch(card,account.index);
    if (!match) {
      announce('Từ đã lưu trên trình duyệt, chưa khớp chính xác với kho từ tài khoản.');
      return;
    }
    try {
      await postAccountReview(match.word_id,detail.remembered);
      announce('Đã nhớ và đồng bộ từ “' + english + '” theo tài khoản.');
    } catch(error) {
      announce('Đã lưu trên thiết bị, nhưng tài khoản chưa đồng bộ: ' + error.message,true);
    }
  }).catch(()=>announce('Đã lưu trên thiết bị; không thể xác nhận đồng bộ tài khoản.',true));
});
