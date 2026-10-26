# UX-18 Account-Owned Personal Vocabulary — Preview Release Review (2026-10-26)

Status: PREVIEW VERIFIED. Production NOT released. Previous PR #31 was merged, but Production database migrations remain pending.

## Data boundaries

Public vocabulary uses ws_words.id and ws_topics, common to all players.
Account-owned personal Flashcards use ws_personal_cards (user_id, id), ws_personal_card_progress and ws_personal_card_reviews in PostgreSQL.
Old device Flashcards continue using wordsky_vocab_v2 and wordsky_learned in localStorage.
Browser-only public-library remembered flags continue using wordsky_server_learned_v1.
These sources must never be conflated. Public vocabulary (365 server words) is NOT the same denominator as the user's account-owned vocabulary.

## UX-18 implementation

- GET /api/learning/personal: owned words and latest progress.
- POST /api/learning/personal: create personal card.
- PATCH /api/learning/personal/:id: update card with optimistic revision check.
- DELETE /api/learning/personal/:id: soft delete card with optimistic revision check.
- POST /api/learning/personal/reviews: append immutable review event and transactionally update progress.
- All mutations derive userId from the signed session; expected_actor_id is checked when supplied. Other users cannot access or edit another account's personal cards.
- /personal.html: manage account words, mark known/review, search and explicitly import existing browser cards.
- Existing local import requires a confirmation and is limited to 20 operations at a time. Exact identity matches preserve existing account decisions including remembered=false. Same topic and English with different content is not overwritten.
- /learn.html#flash: additional account-owned Flashcard source, displaying database cards and marking remembered via PostgreSQL after account identity validation. It does not rewrite either local remembered key.
- /progress.html: separate personal-account summary and link, not falsely combined with 365 public words.
- Local browser Flashcards and scores are never deleted, overwritten or silently imported.

## Database and privacy

The additive UX-17 migration was applied ONLY to isolated Supabase Preview zbdnvvvdjxmdurucfjpe.
The migration creates ws_personal_cards, ws_personal_card_reviews and ws_personal_card_progress with RLS enabled and no anon/authenticated direct SELECT grants.
The existing older ws_user_vocabulary table is independent and untouched.

## Evidence

- Application commit 4e0dfc7787fc3512d50ca11f51213f6a57760b3b: npm run check PASS, npm test 296/296 PASS.
- 21/21 real-browser checks with Preview PostgreSQL: custom-word import, review, second browser, edit/revision conflict, deletion, other-account isolation.
- 19/19 real-browser checks with Preview PostgreSQL: personal Flashcard loading, account review POST, second browser same remembered state, localStorage untouched, different account empty, mobile 390px, zero JS exceptions.
- Both sets of temporary QA accounts were deleted from Preview after testing.

## Production blockers and release gates

Production currently does not have the UX-10 Flashcard account progress tables or the UX-17 account-personal tables.
Obtain explicit Production migration approval BEFORE running db/migrations/20261025_ux10_flashcard_progress.sql or db/migrations/20261026_ux17_personal_vocabulary.sql.
Check correct Supabase target, FK, RLS, grants and real account read/write after migration.
Request separate approval before merging this feature branch into main and deploying.
Never copy cross-project word UUIDs; Preview and Production vocabulary IDs differ.
On a code rollback, preserve account progress tables and records. SRS and Game-to-Learn remain future phases.

This document is NOT authorization for Production writes or merge.
