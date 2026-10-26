# UX-16 — Browser-to-account progress migration (Preview)

## Goal
Users can review the public 365-word catalog on a device even when the account-progress database is offline. After backend storage is enabled and they log into the same WordSky player account, they can explicitly transfer previously marked **server-library UUIDs** to their account. A second browser then reads the persisted account records.

## Browser-only vs account data
- Public vocabulary: `GET /api/learning/vocabulary`, `ws_words`, common to all users.
- Personal Flashcards: `wordsky_vocab_v2` and `wordsky_learned` local, `topic:english` identity; existing separate exact six-field import remains available.
- Server library Flashcards: `wordsky_server_learned_v1` local, UUID identity; new explicit import UI.
- Account progress: `ws_learning_word_progress`, `ws_learning_flashcard_reviews` in the database. Requires both tables in Production and authenticated player API.

## Safety contract
1. **No automatic backfill.** Only an explicit click and confirmation sends past browser marks. At most 20 matching reviews per click.
2. A server UUID is accepted only if the current browser/server catalog and the authenticated account catalog agree on **UUID plus six-field fingerprint** (topic, English, IPA, meaning, example, translation). This protects against stale caches and independently seeded databases whose UUIDs differ.
3. Never overwrite an existing server review decision, including `remembered:false`. Only `true` marks are imported.
4. Bind every POST to the user who clicked through `expected_actor_id`; before each POST, check the current player session. Stop on a changed session or API failure and show how many words were actually confirmed.
5. Never delete `localStorage` personal or server-library progress during import. A failed partial transfer can be repeated; already transferred UUIDs are skipped after a successful refreshed account read.
6. A newly marked server-library word can best-effort POST to an already active account. Browser UUID state still saves first if API is offline.
7. Main Dashboard uses the account view only if `loadAccount()` fully succeeds; a 503 cannot be represented as an account with 0 remembered words.

## Verification
- Unit checks: eligible UUID/fingerprint mapping; edited meanings and UUID mismatches blocked; existing reviewed:false kept; malformed local state blocks import; UI confirmation and actor binding.
- Browser QA: two contexts with mocked authenticated API, two explicit review POSTs, second browser showing the same account count, no localStorage transfer, no duplicate import.
- On isolated Preview only, perform a real temporary-user API and database test when supported, remove the QA user, and postflight RLS.

## Production release gate — separate authorization needed
**Confirmed during read-only audit on 2026-10-26: two Learning Progress tables are absent in Production.** Existing Preview Supabase has them. UX-16 alone cannot enable cross-browser sync on Production.

1. Obtain the owner's explicit approval to run `db/migrations/20261025_ux10_flashcard_progress.sql` against the confirmed Production Supabase project. Verify table structure, RLS, role grants, FK and index before any user trial.
2. After migration, obtain separate approval for code merge/release. Verify account login, review, explicit import, reload, second device, sign out, guest fallback and no records leaking between accounts.
3. Never copy UUIDs or progress directly from Preview DB to Production DB; their independent catalog UUIDs differ.
4. If a code rollback is needed, preserve the new progress tables and data.

This document is a plan and QA record, **not authorization** for any Production write.
