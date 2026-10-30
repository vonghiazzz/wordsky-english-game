/* UX26: lightweight, original, procedural game music. No external audio files. */
(function () {
  'use strict';

  const TRACKS = Object.freeze({
    MATCH: {ms: 380, wave: 'triangle', notes: [64, 67, 71, 74, 72, 69, 67, 64, 62, 67, 69, 71, 67, 64, 62, 59], bass: [48, 45, 50, 43]},
    BOMB: {ms: 280, wave: 'sine', notes: [48, 0, 55, 48, 49, 0, 55, 49, 50, 0, 57, 50, 47, 0, 54, 47], bass: [36, 37, 38, 35]},
    CAR: {ms: 220, wave: 'triangle', notes: [52, 59, 64, 67, 55, 62, 67, 71, 57, 64, 69, 72, 55, 62, 67, 74], bass: [40, 43, 45, 43]},
    FALLING: {ms: 340, wave: 'sine', notes: [72, 76, 79, 76, 74, 77, 81, 77, 71, 74, 79, 74, 69, 72, 76, 72], bass: [48, 50, 53, 45]},
    MATRIX: {ms: 320, wave: 'triangle', notes: [60, 64, 67, 71, 69, 65, 62, 67, 72, 67, 64, 60, 65, 69, 67, 62], bass: [45, 48, 43, 50]}
  });
  const CUES = Object.freeze({
    correct: [[76, 0, 0.11], [81, 0.09, 0.18]],
    wrong: [[55, 0, 0.14], [50, 0.11, 0.19]],
    damage: [[48, 0, 0.19], [43, 0.12, 0.23]],
    win: [[72, 0, 0.13], [76, 0.13, 0.13], [79, 0.26, 0.16], [84, 0.42, 0.34]],
    lose: [[57, 0, 0.17], [53, 0.19, 0.19], [48, 0.39, 0.32]]
  });
  const KEY = 'wordsky_audio_v1_';
  const AudioClass = window.AudioContext || window.webkitAudioContext;
  function read(key) {
    try { return window.localStorage.getItem(KEY + key); } catch { return null; }
  }
  function save(key, value) {
    try { window.localStorage.setItem(KEY + key, String(value)); } catch {}
  }
  const rawVolume = Number(read('volume'));
  const prefs = {
    music: read('music') !== 'false',
    effects: read('effects') !== 'false',
    volume: read('volume') === null || !Number.isFinite(rawVolume) ? 35 : Math.max(0, Math.min(100, rawVolume))
  };
  let context = null;
  let master = null;
  let musicBus = null;
  let effectsBus = null;
  let timer = null;
  let scene = null;
  let step = 0;
  let unlocked = false;
  let panel = null;

  function stopTimer() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
  function setupContext() {
    if (context) return true;
    if (!AudioClass) return false;
    try {
      context = new AudioClass();
      master = context.createGain();
      musicBus = context.createGain();
      effectsBus = context.createGain();
      master.gain.value = prefs.volume / 100;
      musicBus.gain.value = 0.11;
      effectsBus.gain.value = 0.27;
      musicBus.connect(master);
      effectsBus.connect(master);
      master.connect(context.destination);
      return true;
    } catch {
      context = null;
      return false;
    }
  }
  function tone(midi, at, length, type, peak, bus) {
    if (!context || !bus || !Number.isFinite(midi) || midi <= 0) return;
    try {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), at);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.connect(envelope);
      envelope.connect(bus);
      oscillator.start(at);
      oscillator.stop(at + length + 0.02);
    } catch {
      // Audio is optional. Never interrupt typing, game timers, or server actions.
    }
  }
  function beat() {
    if (!scene || !context || !unlocked || !prefs.music || !prefs.volume || document.hidden || context.state !== 'running') return;
    const track = TRACKS[scene];
    const at = context.currentTime + 0.015;
    const note = track.notes[step % track.notes.length];
    if (note) tone(note, at, track.ms / 1000 * 0.72, track.wave, 0.48, musicBus);
    if (step % 4 === 0) tone(track.bass[Math.floor(step / 4) % track.bass.length], at, track.ms / 1000 * 1.25, 'sine', 0.22, musicBus);
    step += 1;
  }
  function syncMusic() {
    stopTimer();
    if (!scene || !context || !unlocked || !prefs.music || !prefs.volume || document.hidden || context.state !== 'running') return;
    beat();
    timer = setInterval(beat, TRACKS[scene].ms);
  }
  function unlock() {
    if (document.hidden || !setupContext()) return false;
    unlocked = true;
    try {
      const resuming = context.resume();
      // Start once per gesture, after browsers actually resume the context.
      if (context.state === 'running') syncMusic();
      else Promise.resolve(resuming).then(syncMusic, () => {});
    } catch {}
    return true;
  }
  function setScene(name, active) {
    const next = active && Object.prototype.hasOwnProperty.call(TRACKS, name) ? name : null;
    if (next === scene) return;
    scene = next;
    step = 0;
    syncMusic();
  }
  function cue(name) {
    if (!unlocked || !prefs.effects || !prefs.volume || document.hidden || !context || context.state !== 'running') return;
    const notes = CUES[name];
    if (!notes) return;
    const start = context.currentTime + 0.012;
    notes.forEach(note => tone(note[0], start + note[1], note[2], name === 'damage' || name === 'lose' ? 'triangle' : 'sine', 0.5, effectsBus));
  }
  function getState() {
    return {music: prefs.music, effects: prefs.effects, volume: prefs.volume, scene, unlocked, supported: !!AudioClass};
  }
  function renderControls() {
    if (!panel) return;
    const musicButton = panel.querySelector('[data-ws-audio-music]');
    const effectsButton = panel.querySelector('[data-ws-audio-effects]');
    const volumeSlider = panel.querySelector('[data-ws-audio-volume]');
    musicButton.textContent = prefs.music ? '🔊 Nhạc: Bật' : '🔇 Nhạc: Tắt';
    musicButton.setAttribute('aria-pressed', String(prefs.music));
    effectsButton.textContent = prefs.effects ? '✨ Hiệu ứng: Bật' : '✨ Hiệu ứng: Tắt';
    effectsButton.setAttribute('aria-pressed', String(prefs.effects));
    volumeSlider.value = String(prefs.volume);
    panel.querySelector('[data-ws-audio-percent]').textContent = prefs.volume + '%';
    if (!AudioClass) {
      musicButton.disabled = true;
      effectsButton.disabled = true;
      volumeSlider.disabled = true;
      panel.querySelector('[data-ws-audio-hint]').textContent = 'Trình duyệt không hỗ trợ Web Audio.';
    }
  }
  function makeControls() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'wsAudioPanel';
    panel.className = 'ws-audio-panel';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Âm thanh trò chơi WordSky');
    panel.innerHTML = '<span class="ws-audio-title">🎼 Âm thanh</span>' +
      '<button type="button" data-ws-audio-music aria-pressed="true">🔊 Nhạc: Bật</button>' +
      '<button type="button" data-ws-audio-effects aria-pressed="true">✨ Hiệu ứng: Bật</button>' +
      '<label class="ws-audio-volume">Âm lượng <input type="range" data-ws-audio-volume min="0" max="100" step="5" aria-label="Âm lượng trò chơi"></label>' +
      '<output data-ws-audio-percent>35%</output>' +
      '<small data-ws-audio-hint>Nhạc chạy khi đang chơi; chạm Bắt đầu để phát trên điện thoại.</small>';
    panel.querySelector('[data-ws-audio-music]').addEventListener('click', () => {
      prefs.music = !prefs.music;
      save('music', prefs.music);
      if (prefs.music) unlock();
      syncMusic();
      renderControls();
    });
    panel.querySelector('[data-ws-audio-effects]').addEventListener('click', () => {
      prefs.effects = !prefs.effects;
      save('effects', prefs.effects);
      if (prefs.effects) {
        unlock();
        // AudioContext.resume() may resolve asynchronously on Safari/iOS.
        if (context) Promise.resolve(context.resume()).then(() => cue('correct'), () => {});
      }
      renderControls();
    });
    panel.querySelector('[data-ws-audio-volume]').addEventListener('input', e => {
      const value = Number(e.target.value);
      prefs.volume = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 35;
      save('volume', prefs.volume);
      if (master) master.gain.value = prefs.volume / 100;
      syncMusic();
      renderControls();
    });
    renderControls();
    return panel;
  }
  function mount(anchor) {
    if (!anchor) {
      if (panel) panel.remove();
      return;
    }
    const controls = makeControls();
    if (controls.parentElement !== anchor) anchor.append(controls);
  }
  function refreshPosition() {
    const current = document.querySelector('.screen.active');
    if (current) {
      const gameScreens = ['screen-solo', 'screen-solo-bomb', 'screen-solo-car', 'screen-rooms'];
      mount(gameScreens.includes(current.id) ? current.querySelector('.page-title') : null);
      return;
    }
    const matrix = document.getElementById('matrixAudio');
    if (matrix) { mount(matrix); return; }
    const learn = document.getElementById('gamePanel');
    mount(learn && !learn.classList.contains('hidden') ? learn.querySelector('.toolbar') : null);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTimer();
      if (context && context.state === 'running') Promise.resolve(context.suspend()).catch(() => {});
    } else if (context && unlocked) {
      try { Promise.resolve(context.resume()).then(syncMusic, () => {}); } catch {}
    }
  });
  // Settings are browser-local, shared across Arena/Learn tabs on the same origin.
  window.addEventListener('storage', event => {
    if (!event.key || !event.key.startsWith(KEY)) return;
    if (event.key === KEY + 'music') prefs.music = read('music') !== 'false';
    if (event.key === KEY + 'effects') prefs.effects = read('effects') !== 'false';
    if (event.key === KEY + 'volume') {
      const stored = read('volume');
      const value = Number(stored);
      prefs.volume = stored !== null && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 35;
      if (master) master.gain.value = prefs.volume / 100;
    }
    syncMusic();
    renderControls();
  });
  window.addEventListener('wordsky:route', refreshPosition);
  window.addEventListener('pagehide', event => {
    stopTimer();
    if (context && event.persisted) {
      // Back-forward cache: keep the unlockable context for pageshow.
      if (context.state === 'running') Promise.resolve(context.suspend()).catch(() => {});
      return;
    }
    if (context) Promise.resolve(context.close()).catch(() => {});
    context = null;
    unlocked = false;
  });
  window.addEventListener('pageshow', event => {
    refreshPosition();
    if (event.persisted && context && unlocked && !document.hidden) {
      try { Promise.resolve(context.resume()).then(syncMusic, () => {}); } catch {}
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshPosition, {once: true});
  else refreshPosition();

  window.WordSkyAudio = Object.freeze({unlock, setScene, cue, mount, getState});
})();
