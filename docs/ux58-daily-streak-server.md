# UX58 M3 — Server-confirmed learning activity

## Scope and source of truth

Extends the feature-gated My Learning daily card added in M2. A new read-only `GET /api/learning/daily-activity` is available only to the authenticated player when the existing SRS gate is enabled. It does not accept a client `user_id`. Queries **existing** shared/personal flashcard review histories in one `REPEATABLE READ READ ONLY` PostgreSQL transaction; no new table, no incremental "streak counter" that can drift.

Review timestamps are converted to calendar dates using `Asia/Ho_Chi_Minh`. The server's transaction timestamp decides "today". One row in a committed review-history table is one accepted review decision; replaying the same `(user_id, request_id)` is idempotent in the existing unified-review service and does not append a second history row. The two sources are distinguished when counting unique words. This is **not** objective exam accuracy and **not** game score or mastery.

## Semantics
- `reviews_today`: count of committed shared + personal flashcard review-history rows today, including both remembered and needs-review decisions.
- `unique_words_today`: count of distinct (source, word ID) reviewed today.
- `streak_days`: consecutive calendar dates with at least one review; if no review today, yesterday may still anchor the current streak. A gap earlier breaks the streak.
- `streak_capped`: true if bounded 366-day lookback is fully consecutive; UI shows `366+` rather than claiming that older history proves the exact streak.
- `completed_goal:null`: daily goal completion deliberately not inferred from raw review count; tasks shown in M2 are suggestions only. For a true goal-completed state, track due/new assignments at start of day and the corresponding acknowledged reviews across devices.
- Daily activity failure is non-blocking: SRS card and existing practice action remain available, while activity fields hide and show a refresh notice.
- No account-independent localStorage, no client timezone date guesses, no mutations to historical events, SRS intervals, vocabulary or users.

## Required QA gates
1. Unit cases: yesterday carry-over, gap, leap day and year crossing, empty history, future/duplicate/invalid dates, actor mismatch, cap.
2. Exact-head GitHub CI unit/Postgres and browser/SRS; smoke public production GET.
3. Authorized Preview UI: account A vs B, same account across Chromium/Firefox and 360px, midnight VN boundary, SRS disabled, refresh after review, HTTP failure; do not run state-changing tests against Production user records.
4. Vercel Production deployment only after protected Preview acceptance and staged exact-SHA build verification.

## Dependencies
UX58 M2 #142; existing UX23 unified review deduplication, SRS queue and UX29 insights. Next milestone M4 is explicit Preview/browser acceptance and release gate, not another SRS storage layer.
