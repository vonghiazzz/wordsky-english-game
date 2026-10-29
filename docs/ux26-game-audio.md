# UX26 — WordSky Game Music & Sound Effects

## Scope
- Arena MATCH, BOMB and CAR: Solo and multiplayer, following the authoritative game status.
- Learn Falling Words: both letter and typing modes.
- Four **original procedural music motifs**, generated via the browser Web Audio API. No downloaded or copyrighted tracks.
- UI: separate Music/Effects toggles and an overall volume slider; persisted locally in the browser only.
- Cues: correct, damage, win and lose; based on accepted game state rather than unconfirmed keystrokes.
- Silent until a user interaction unlocks Web Audio (mobile autoplay compliance); stop on screen change, round completion, hidden tab, pause or page navigation.
- Feature is frontend-only; no DB migrations, new dependencies or Production feature flags.

## Local test
```sh
npm test
npm run check
```
Manual QA: MATCH/BOMB/CAR solo and multiplayer, Falling letters/typing, iOS Safari/Android Chrome, muted/volume preference, tab switch, fullscreen and page navigation. Browser audio playback still requires real-device verification. Do not merge without QA.
