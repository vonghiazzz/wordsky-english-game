# UX-19 — Unified Account My Learning (Preview, 2026-10-26)

## Product invariant

**The same authenticated WordSky player has ONE My Learning main result across Chrome, Safari, mobile and laptop.** My Learning reads from one authenticated API over a consistent PostgreSQL snapshot. The device's localStorage is never counted as the signed-in account's result. No screen asks an authenticated player to choose a separate "server", "personal" or "browser" source to calculate their main progress.

## Sources of truth

- Common vocabulary: enabled `ws_words` joined to enabled `ws_topics`.
- Common account decisions: `ws_learning_word_progress` keyed by `(user_id,word_id)`.
- Account personal cards: `ws_personal_cards` keyed by UUID, owner-scoped via `user_id`; deleted cards excluded.
- Personal account decisions: `ws_personal_card_progress` keyed by `(user_id,personal_word_id)`.
- Review-history tables remain separate and are not rewritten.
- Browser-local `wordsky_vocab_v2`, `wordsky_learned`, `wordsky_server_learned_v1` are **legacy/guest sources only**, retained for explicit safe migration. They are not a source for signed-in headline metrics.

Two different source-scoped cards with the same spelling can count as distinct *cards* if one is shared and one is personal. Server word UUIDs may differ between Production and Preview; never copy across projects. Deleted/disabled words are excluded from active denominator but no historical review rows are deleted by the aggregate endpoint.

## Implementation

`GET /api/learning/me/summary`:
- Requires verified WordSky `mustPlayer(req).id`; no client supplied `user_id`.
- Uses one PostgreSQL `REPEATABLE READ READ ONLY` transaction for two word/decision queries and stable totals.
- Returns `scope:"unified-account"`, `actor_id`, `summary:{total,known,review,reviewed,percent,shared,personal}` plus source-labelled cards. One snapshot includes all currently enabled common cards and active account-personal cards.
- Not-yet-reviewed cards are **not** counted as explicitly failed reviews; they are included under "chưa nhớ / cần ôn" for planning.
- 5,000-item cap per source, returns 503 when exceeded.
- Missing tables (`42P01`) produce an explicit 503 "Learning Progress/Personal Vocabulary not ready" rather than returning zero.

`/progress.html`:
- On confirmed login, reads only this endpoint for headline totals, ring, search, library and status filters. The old device/server source picker and standalone personal summary are hidden.
- Shared-card review buttons post to `/api/learning/flashcards/reviews`; personal-card buttons post to `/api/learning/personal/reviews`. Both bind `expected_actor_id` and revalidate login before mutation. After server confirmation, refresh the one unified summary.
- 503/network failure/account mismatch: display `—` and a clear error, **never a misleading 0 account progress**. Show no stale card list from a previous actor.
- Guests may continue using the original browser-only deck explicitly labelled local. The existing manual legacy import controls remain in the lower "Chuyển tiến độ cũ" section, with no automatic overwrite/deletion.

## Preview QA

- `npm run check` and `npm test`: **300/300 PASS**, HEAD `960206e118456b7f4fad3f177d5f0cb854082853`.
- Real PostgreSQL Preview and Chromium: one test player saw 365 common cards, created one personal card, saw 366 total, marked shared/personal remembered through My Learning, and logged in on a second browser to see matching totals; a different player saw only its own data. User-specific writes remained in Preview only; temporary QA users were deleted by exact ID+username.
- First full-browser pass detected two legacy panels still visibly rendered despite `hidden`; corrected in CSS, then verified **11 successful checks** on the latest deployment including single-source UI, 365→366 main total, cross-browser same-account progress, and no duplicate panels. That run's final two fault-injection checks were interrupted by expiry of the test environment, not interpreted as pass.
- Fresh isolated Chromium fault-injection smoke: **8/8 PASS** on latest deployment for 503 fail-closed, legacy selectors hidden, and switching from account A to B without disclosing A's personal card.
- No production database writes, migrations or `main` merge.

## Release gates

1. **Do not merge this Draft PR yet.** Production currently lacks UX-10 tables (`ws_learning_word_progress`, `ws_learning_flashcard_reviews`) and UX-17 tables (`ws_personal_cards`, `ws_personal_card_progress`, `ws_personal_card_reviews`).
2. Obtain explicit, **separate** owner permission to run reviewed migrations `db/migrations/20261025_ux10_flashcard_progress.sql` and `db/migrations/20261026_ux17_personal_vocabulary.sql` on confirmed Supabase Production, then verify RLS, grants, indexes, FK and user scopes.
3. Only after Production schema is ready and Preview is approved, request a **separate** code-merge/release approval.
4. Run actual Production E2E on a consented account: sign-in, import existing local browser cards if explicitly confirmed, mark shared + personal, open second device, sign out/change user, validate fail-closed on API failure. No copying Preview word IDs or sample user progress.
5. If rollback is needed, do not drop user progress tables; preserve recorded learning history.

Next phase after a stable unified account experience: Smart Review / SRS. No SRS or Game-to-Learn schema was created in UX-19.
