/* UX44: optional, user-initiated English vocabulary pronunciation.
 * Browser Web Speech synthesis only: no fetch, no audio uploads and no account writes.
 * Never mount on games/competition prompts or before recall answers are revealed.
 */
(() => {
  'use strict';
  const synth = window.speechSynthesis;
  const supported = typeof window.SpeechSynthesisUtterance === 'function' &&
    !!synth && typeof synth.speak === 'function' && typeof synth.cancel === 'function';
  let activeUtterance = null;
  let activeButton = null;

  function announce(message) {
    let region = document.getElementById('wsSpeechStatus');
    if (!region) {
      region = document.createElement('div');
      region.id = 'wsSpeechStatus';
      region.className = 'ws-speech-status';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.append(region);
    }
    region.textContent = message;
  }

  function mark(button, playing) {
    if (!button) return;
    button.classList.toggle('is-speaking', playing);
    button.setAttribute('aria-pressed', String(playing));
  }

  function stop() {
    const previous = activeButton;
    activeUtterance = null;
    activeButton = null;
    mark(previous, false);
    if (supported) {
      try { synth.cancel(); } catch { /* Browsers may reject cancel during teardown. */ }
    }
  }

  function preferredVoice() {
    let voices = [];
    try { voices = synth.getVoices?.() || []; } catch { return null; }
    const english = voices.filter(voice => /^en(?:-|$)/i.test(voice.lang || ''));
    return english.find(voice => /^en-GB$/i.test(voice.lang)) ||
      english.find(voice => /^en-US$/i.test(voice.lang)) ||
      english[0] || null;
  }

  function speak(input, button = null) {
    const word = typeof input === 'string' ? input.trim().replace(/\s+/gu, ' ') : '';
    if (!word || word.length > 160 || /[<>\u0000-\u001f\u007f]/u.test(word)) return false;
    if (!supported) {
      announce('Trình duyệt này chưa hỗ trợ đọc phát âm. Hãy thử Chrome, Edge hoặc Safari.');
      return false;
    }
    if (activeUtterance && activeUtterance.text === word && activeButton === button &&
        (synth.speaking || synth.pending)) {
      stop();
      return true;
    }
    stop();
    try {
      const utterance = new window.SpeechSynthesisUtterance(word);
      utterance.lang = 'en-GB';
      utterance.rate = 0.88; // Slightly slower for learners; no pitch distortion.
      utterance.pitch = 1;
      const voice = preferredVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      activeUtterance = utterance;
      activeButton = button;
      mark(button, true);
      utterance.onend = () => {
        if (activeUtterance !== utterance) return;
        activeUtterance = null;
        activeButton = null;
        mark(button, false);
      };
      utterance.onerror = event => {
        if (activeUtterance !== utterance) return;
        activeUtterance = null;
        activeButton = null;
        mark(button, false);
        if (!['canceled', 'interrupted'].includes(event?.error))
          announce('Không phát được âm thanh trên thiết bị này. Kiểm tra âm lượng hoặc giọng đọc trình duyệt.');
      };
      synth.speak(utterance);
      return true;
    } catch {
      stop();
      announce('Không thể phát âm thanh. Hãy thử lại hoặc dùng trình duyệt có hỗ trợ giọng đọc.');
      return false;
    }
  }

  function bindButton(button, getWord) {
    if (!button || typeof getWord !== 'function') return null;
    button.type = 'button';
    button.classList.add('ws-speak-button');
    button.disabled = !supported;
    mark(button, false);
    function sync() {
      const word = getWord();
      const available = typeof word === 'string' && !!word.trim() && word !== 'Chưa có thẻ';
      button.disabled = !supported || !available;
      button.setAttribute('aria-label', available ? 'Nghe phát âm tiếng Anh: ' + word : 'Chưa có từ để phát âm');
      button.title = supported ? (available ? 'Nghe phát âm: ' + word : 'Chưa có từ vựng') : 'Trình duyệt không hỗ trợ phát âm';
    }
    button.addEventListener('click', event => {
      event.stopPropagation(); // Playing a word must not flip its Flashcard.
      event.preventDefault();
      sync();
      if (!button.disabled) speak(getWord(), button);
    });
    sync();
    return {sync};
  }

  function makeButton(word, compact = false) {
    const button = document.createElement('button');
    button.textContent = compact ? '🔊' : '🔊 Nghe';
    if (compact) button.classList.add('ws-speak-compact');
    bindButton(button, () => word);
    return button;
  }

  function mountFlashcard() {
    const button = document.getElementById('flashSpeak');
    const label = document.getElementById('word');
    if (!button || !label) return;
    const bound = bindButton(button, () => label.textContent);
    if (typeof MutationObserver === 'function') {
      const observer = new MutationObserver(() => {
        stop(); // Changing cards should stop the previous pronunciation.
        bound.sync();
      });
      observer.observe(label, {childList: true, characterData: true, subtree: true});
    }
  }

  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  window.WordSkySpeech = Object.freeze({supported, speak, stop, bindButton, makeButton});
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', mountFlashcard, {once: true});
  else mountFlashcard();
})();
