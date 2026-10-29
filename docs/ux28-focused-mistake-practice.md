# UX28 — Focused Mistake Recall Practice

## Problem / source of truth
UX27 reliably adds identifiable wrong Solo vocabulary to the correct WordSky learner's
PostgreSQL account, but the mistake notebook is primarily a **list**. Learners still
lack a fast practice path that tests active recall and records the result.

Use existing APIs and tables, **not a second progress system**:
- Auth: \`GET /api/auth/me\`.
- Account mistakes: \`GET /api/learning/game-mistakes\`.
- Existing UX27 account backfill: \`POST /api/learning/game-mistakes/sync\`.
- Idempotent UX23 review: \`POST /api/learning/reviews\` through
  \`postUnifiedAccountReview\`, with request_id, actor pin and observed review_count.
- Existing SRS queue and optional, correctly gated SRS shadow read the same history.

No schema migration, Vercel env change, new external dependencies, background task
or new account database. Offline progress is never reported as synchronized.

## UX28 scope
- Account-only \`/practice.html\`, linked from notebook, My Learning, site nav,
  and Solo post-run results.
- Study Vietnamese **meaning** → type English. Grade exact normalized spelling
  (case-insensitive and excess spaces normalized, but no fuzzy typo guesses).
- Filter to **currently marked needing review** (default), optionally **all
  vocabulary previously missed**; filter by MATCH/BOMB/CAR and 5/10/20 word cap.
  A direct word link works only for a word in the signed-in actor's notebook.
- A quiz shows one card at a time; reveal English only after the learner submits.
  The browser fetch includes the English answer for client-side grading; this is
  learning practice, not an anti-cheat competitive game.
- Press "Không nhớ" to record an explicit \`remembered:false\` event, or type
  the exact answer to record \`remembered:true\`. Only **server-confirmed**
  events advance the session and summary.
- On a lost HTTP response retry the exact same pending command ID, avoiding
  double reviews; after a definitive 409/actor mismatch stop the session and
  refresh account data rather than overwrite a newer action.
- A session is ephemeral and cannot resume exactly after hard refresh. Durable
  review events always remain in PostgreSQL.
- Browser focus/visibility checks session actor to prevent stale account content.

## Security and release gates
- The server still authorizes actor and word ID against account ownership.
- No query/body parameter can select another account's notebook.
- No API secrets or raw credentials in client files or CI.
- Backend review is the existing account-scoped \`shared\` review transaction.
- CI: \`npm run check\`, \`npm test\`, isolated Postgres17 + real Chromium/Firefox
  login and mobile 360px; cross-device sync, actor isolation, lost-response replay,
  conflicting review_count and SRS shadow consistency.
- No access to Production PostgreSQL from browser tests; no Production writes.
- Human mobile touch/keyboard QA recommended prior to merge.
