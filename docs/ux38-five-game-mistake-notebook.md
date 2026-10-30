# UX38 — Five-game mistake notebook parity after MATRIX / MEMORY

## Verified gap

UX27's `/mistakes.html` offered only MATCH/BOMB/CAR in the mode selector
and described the account notebook as covering those three games. UX34/UX35
later added server-authoritative MATRIX and MEMORY Solo games; their incorrect
pairs already populate `wrongWordIds`, and the existing notebook SQL and
account-idempotent auto-review pipeline already collect these records.

This is a **UI discoverability and metric-label consistency fix**, not a new
storage/learning algorithm. Do not invent an additional "Luyện từ" action:
My Learning remains the single account review control.

## Semantics and invariants

- Offer 5 filter values: MATCH, BOMB, CAR, MATRIX, MEMORY. Filtering uses the
  server-returned `modes[]` for each word, never browser-local game history.
- MATRIX and MEMORY: a wrong EN–VI pair tracks the **two candidate words**
  shown in the mismatch, not proof that both were misspelled. No penalty
  to MEMORY hearts. Only authenticated completed/failed/timed-out Solo runs
  contribute to the account notebook; guests remain isolated.
- The notebook's sum of `mistake_runs` for each word measures **run–word
  occurrences**, not the number of unique games played. Rename the metric
  accordingly; do not modify the SQL aggregation or backfill runs.
- BOMB counts missed bombs; CAR may include safely inferred unanswered
  practice words from timed-out lanes, not graded typing errors.
- Review enrollment remains idempotent per (run, word); correct game answers
  do not auto-mark remembered. Newer explicit reviews take precedence.
- Keep response ownership tied to the authenticated user and verify again
  after the asynchronous read before rendering account-specific vocabulary.
- Use text-only DOM population; no new HTML injection, navigation item,
  extra account action, game score change or SRS schedule policy change.
- No PostgreSQL migration, Production data writes or auth/secret changes.

## QA and release gates

1. Node unit tests confirm MATRIX/MEMORY mismatches record both word IDs
   privately and five filter entries exist.
2. CI PostgreSQL17 + Chromium/Firefox integration uses two isolated users,
   disposable terminal MATRIX/MEMORY records and two original MATCH runs;
   checks cross-browser display, each game's filter, no cross-account words,
   review deduplication and accurate run–word occurrence metric.
3. QA verifies SRS auto-queue for each new mode, repeat sync is idempotent,
   existing MATCH/BOMB/CAR and mobile 360/390px layout remain unaffected.
4. GitHub CI on the exact branch SHA must PASS, then at most **one** manual
   Vercel Preview with isolated database, subject to release approval.
5. Only merge to main and manually deploy Production after accepted QA.
   No auto-deploy, schema migration or user-record modifications.

## Separate diagnostic: Node DEP0169

Vercel logs have shown a Node.js legacy `url.parse()` deprecation warning,
but not a stack trace locating the caller. Node 24's modern `URL` API is
already used for WordSky's API routing and DB-target validation. Do not
suppress warnings or change Node/Vercel versions without a reproducible
trace linking the warning to app/dependency/platform code.
