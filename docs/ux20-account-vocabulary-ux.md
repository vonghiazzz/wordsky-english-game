# UX-20 — Account-centric Vocabulary UI (Preview)

## Goal

Show **two primary vocabulary sources** when signed in: **Kho từ chung** (admin-managed `ws_words`) and **Từ của tôi** (account-owned `ws_personal_cards`). One My Learning result remains the authoritative account summary. The old browser-only sample deck is kept for safe, explicit migration—not as a third primary study source.

## Scope and implementation

- `/learn.html#flash`: logged-in source selector hides/disables the **Bộ Flashcard trên thiết bị (dữ liệu cũ)** option. Guests still have that option and can study without an account.
- Account-owned common vocabulary now loads the remembered UUID set from `/api/learning/flashcards/progress` and writes new marks directly to `/api/learning/flashcards/reviews` with a verified `expected_actor_id`. UI does not mark remembered until the server confirms success; API errors do not write to `wordsky_server_learned_v1` or `wordsky_learned`.
- Account-owned personal vocabulary retains its separate PostgreSQL-backed source and `personal_word_id` writes.
- If the account API cannot load, Flashcard does not silently fall back to showing device-only marks as synced account progress.
- `/progress.html`: a single **Quản lý từ của tôi** link opens `/personal.html`; account totals remain the unified PostgreSQL My Learning result.
- `/personal.html`: the old device-deck import is inside a collapsed legacy-data section; the explicitly requested `/learn.html?legacy=1#manage` link still allows viewing and exporting the previous browser deck.
- Legacy browser storage and the falling-words game data are unchanged. No schema changes or Production writes.

## Verification

- `npm run check`: PASS; `npm test`: **304 / 304 PASS**, commit `b388f73a607ac6faebdfb1f3eab4a37bd11a9532`.
- Vercel feature Preview READY.
- Real Chromium + Preview DB: first 13 checks passed including authenticated two-source UI, explicit legacy archive access, failure injection (HTTP 503 shared review does not change known status), successful shared review writes PostgreSQL, and byte-preserved browser-only marks.
- A subsequent browser-login test succeeded with real `fetch('/api/auth/login')` and verified authenticated two-source UI on another browser. Its single-topic remembered counter stayed 0 when the test recorded a different topic; this is not proof of a sync defect, since Flashcard's displayed counter is per selected topic. A final repeat of the topic-aligned cross-browser test was blocked by execution safety checks, so **do not claim final UX-20 cross-browser E2E is green**.
- Temporary QA users were deleted from isolated Preview by exact ID+username.

## Important remaining work

- The pre-existing legacy importer on `/personal.html` compares legacy cards with *account personal* cards but not with the **shared** catalog. Importing an entire 260-card sample deck can still create duplicate personal cards corresponding to server vocabulary. **Do not recommend bulk importing the old deck** until the importer supports a three-way reconciliation: exact shared match → existing shared progress; exact owned-personal match → existing personal progress; genuinely new card → personal create; ambiguous/mismatched → manual review. Never overwrite an existing account decision including `remembered:false`.
- Add pagination/versioned catalog and idempotent migration-review mutations before large-scale account imports.
- This PR must remain Draft and not merge automatically; run end-to-end two-browser QA on the latest commit and review import reconciliation before release.

## Production safety

Production currently has four user accounts and existing per-account shared progress. No Production migration, user-data write, reset, merge, or deployment was performed for UX-20.
