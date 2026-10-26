# UX-14 — Server Flashcard progress isolation (2026-10-26)

## Verified issue

UX-13 added a live server catalog selected by default, but the Flashcard mark, remembered-counter and reset handlers continued using the browser **personal-deck** key `wordsky_learned` indexed by `topic:english`. Thus marking a new server card could silently mark a personal card with the same English spelling. A server edit/rename could also conflate unrelated meanings. This is a browser data-isolation issue, not a PostgreSQL vocabulary or account migration issue.

## Fix

- **Personal Flashcards:** keep `wordsky_vocab_v2` and `wordsky_learned` unchanged. All existing marked cards (such as the user's 10/260) remain available in **Bộ từ cá nhân**.
- **Server Flashcards:** track remembered status separately using `wordsky_server_learned_v1`, keyed by stable, server-issued `ws_words.id` UUID. Build lookup from the validated `GET /api/learning/vocabulary` response. Server source does **not** write to or reset personal progress.
- Admin edits a server word while preserving UUID: the remembered marker stays on the same ID even if the word or meaning changes. Replacing a word with a **new UUID** never inherits old remembered status just because spelling matches. Disabled server words disappear from the active catalog; their local UUID progress is retained in case that same UUID is re-enabled.
- Resetting server-source study marks resets **only browser-local server UUID marks** for the selected topic. It does *not* alter PostgreSQL account history. The UI explicitly says this.
- Keep the existing best-effort exact-match `ux10-learn-sync.js` account review POST as a **separate path**, which requires a working account progress schema. Do not present local server UUID marks as durable account history.
- If `wordsky_server_learned_v1` contains malformed data, block writes rather than replacing possibly recoverable user data. If storage fails, roll back the in-memory mark.
- Offline server-vocabulary cache remains `wordsky_public_vocab_cache_v1`, fully separate from personal and server progress.

## QA and release gates

Test source switching; mark a server word without changing `wordsky_learned`; reload; server UUID edit/replacement; offline refresh; personal previous marks; reset isolation; mobile layout; JS exception handling. All tests run on feature Preview. No Production migration, schema modification, or main merge without separate approval.

**Known limitation:** Existing legacy `topic:english` marks are not silently reclassified into server UUID marks. The original personal-deck progress is preserved, and account import remains an explicit operation that validates an exact match.
