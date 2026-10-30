# UX36 — MATRIX/MEMORY parity in My Learning Insights

## Verified regression after UX35

UX29's `DAILY_SQL` counted all account-owned terminal Solo runs, but
`SOLO_SQL` and the server mode map counted only MATCH, BOMB and CAR.
After a MATRIX or MEMORY Solo run ends, the two counts can differ.
The read-only insights endpoint intentionally rejects mismatched counts,
which can cause an HTTP 500 on `GET /api/learning/insights?days=7|30`.

This is a code-level finding and not proof that any particular real account
has already encountered this error.

## UX36 fix

- One server allowlist: MATCH, BOMB, CAR, MATRIX, MEMORY.
- Both daily and per-mode SQL counters use the **same** `$5::text[]`
  parameter, same terminal status filter, account ID, 7/30-day Vietnam
  calendar range and `REPEATABLE READ READ ONLY` snapshot.
- The server returns five ordered mode counters. The browser validates
  the mode order, nonnegative integer counts and per-mode sum before
  rendering the My Learning insights panel.
- Keep the existing My Learning entry point and 7/30-day chart. No new
  menus, game modes, practice buttons or fabricated recall/accuracy scores.
- The fix does not write learning review events or modify SRS, word mistakes,
  active game runs, score calculations, credentials, auth or environments.

## Release gates

1. Unit regression tests: MATRIX and MEMORY terminal runs; empty data;
   tampered per-mode response, mismatched totals and unexpected modes.
2. CI with isolated PostgreSQL17, Chromium/Firefox and two disposable
   accounts. Verify 7/30-day reporting, correct account counts and
   cross-account privacy, then clean up all QA fixtures.
3. PR must pass the GitHub Learning CI on its exact commit.
4. One manually requested Preview only after CI succeeds; Preview must
   use isolated DB, never reuse Production PostgreSQL credentials.
5. Merge/release only after acceptance. Production release pins exact
   reviewed main SHA, checks the public domain alias, logs and authenticated
   account insights, and preserves all existing account progress.

No migration, SQL writes, Production data mutation, Vercel auto-deploy
or new Preview build is authorized by this documentation alone.
