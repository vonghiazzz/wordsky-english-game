# UX45 — Production read-only QA / release follow-up

Scope: https://wordsky-english-game.vercel.app; isolated guest browser and GET-only API checks. No Production database writes, logins, SRS mutations, game starts, migrations, Vercel deploy or vocabulary import.

## Confirmed via Vercel, 2026-11-17

- Deployment dpl_Ahs1eTnW2nXSPzMPWQsup2aG8BVs is READY; source SHA cf870c0604220784339507ab43ddcc97d08e033c matches GitHub main at inspection.
- 12/12 sampled Production pages and JS/CSS assets returned HTTP 200 (home, Flashcard, My Learning, Personal, Practice, app.js, vocab-speech.js, vocab-speech.css, ux10-progress.js, ux18-personal.js, ux28-practice.js, shared-nav.js).
- GET /api/health returned 200 with ok=true and database=true (configuration indication only; health does not actually execute a database query).
- GET /api/topics returned HTTP 200 with 26 public topics.
- GET /api/learning/vocabulary returned HTTP 200 with 365 shared vocabulary records.
- GET /api/auth/me returned HTTP 200 with actor=null for a guest.
- GET /api/learning/me/summary, /api/learning/srs/queue, /api/learning/personal and /api/admin/features returned HTTP 401 for an anonymous caller, as expected.
- Vercel reported zero runtime error clusters over the queried 1-hour window. A quiet log is not proof that every user journey works.
- Earlier GitHub Actions #166 passed UX44 unit and isolated browser tests, but does not certify the later Production SHA or real speakers.

## Repeatable UX45 QA

Run: node scripts/ux45-production-readonly-qa.mjs

The guarded UX45 step runs inside the existing Node 24 browser-srs-e2e job only on PR branch qa/ux45-production-readonly-smoke. The job's other tests use isolated localhost PostgreSQL; the UX45 step itself uses anonymous cookie-free Chromium+Firefox browsers against Production. Browser requests to non-Production origins or with methods other than GET, HEAD, OPTIONS are blocked before sending. No Production database credentials, Production account cookies or Vercel deployment secrets are supplied.

Checks: 14 public assets; health/topics/vocabulary; guest access boundaries; Flashcard speech in a mocked UK voice with cancel and mobile layout; My Learning guest speaker; Personal guest gate; SRS practice pre-answer secrecy; zero uncaught page errors and zero attempted write methods.

Limitations: fake TTS does not validate actual iOS/Android audio hardware. No signed-in account, two-device sync, real game rounds, review submissions or SRS progress changes are tested. Those checks require a separately authorized isolated QA identity and dataset, NOT existing players.

Do not merge/release solely based on a green UX45 smoke result. This PR makes no application changes and the current vercel.json has git.deploymentEnabled=false.