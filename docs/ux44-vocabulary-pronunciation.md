# UX44 — Vocabulary pronunciation (Web Speech, opt-in)

## Scope

Learners tap **🔊 Nghe** to hear the English vocabulary phrase using the browser's Speech Synthesis API. Prioritizes an English UK voice when installed, then US, then any available English voice; `en-GB` remains the requested utterance language when the browser's voice list is empty. Speaking rate is 0.88 for learners. Voice/audio quality depends on the OS/browser voice pack.

Integrated into:
- **Flashcard** (`/learn.html#flash`) outside the flip-card button. Changing cards stops speech. The button stays disabled if no word exists.
- **My Learning word list** (`/progress.html`): each visible vocabulary row gets a compact playback button.
- **Personal vocabulary** (`/personal.html`): speech for saved English words with no account write.
- **Luyện từ** (`/practice.html`): the button lives inside the **hidden answer feedback** and is only reachable after the grading/skip reveal, preventing leakage of answers before recall.

### Safety and accessibility

- No auto-play; one utterance at a time. Tap the same word again to stop; tapping another stops the old one.
- Stops on Flashcard change, list re-render, page navigation, page hidden, and practice question change.
- Each button is focusable, at least 44×44 CSS px, has an accessible word-specific label, and an `aria-pressed` playback state.
- Unsupported browsers disable playback with a descriptive title; no blocking errors.
- No external TTS service, audio file hosting, API POST, new DB table or migrations, grade/XP/SRS mutations, camera or microphone permissions. Browser/OS speech quality and installed voice selection vary by device.
- Distinct from the existing WordSkyAudio game music/effects system. **Never show audio prompts in hidden-answer games, Arena or pre-reveal SRS questions.**

## Developer QA

```sh
npm run check
npm test
# After isolated local server and pinned Playwright browsers are ready:
node scripts/ux44-browser-speech-qa.mjs
```

The browser test stubs SpeechSynthesisUtterance and speechSynthesis in Chromium/Firefox, blocks non-GET /api requests, checks Flashcard audio/cancel/mobile layout, verifies practice feedback is hidden for guest users, and checks an unsupported-browser fallback. No audible output is required for CI.

## Human Preview QA

1. Open Preview `/learn.html#flash` on desktop and mobile; choose a known word, tap 🔊, confirm you hear the English phrase and the card does not flip. Tap 🔊 again to stop, then use Next/Previous to confirm previous playback ends.
2. On `/progress.html`, find a vocabulary row and tap its 🔊 button; verify the English phrase matches the row. Repeat on `/personal.html` when signed in.
3. On `/practice.html`, the answer playback control must not be visible **before** clicking Check or Không nhớ. Once feedback is shown, listen to the revealed answer. Confirm no SRS progress changes due to playback.
4. Verify headphones/volume/voice pack availability on a real iOS and Android device. A Web Speech API-capable browser can still have no usable installed voice or require first-touch activation.
5. No Production deploy or merge until review and CI are complete.

**Release boundary:** this is frontend-only; it neither approves LIFE-07 drafts nor imports vocabulary into Production.
