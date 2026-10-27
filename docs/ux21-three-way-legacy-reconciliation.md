# UX-21 — Three-way Legacy Flashcard Reconciliation

Status: PREVIEW VERIFIED, PRODUCTION UNCHANGED. Works on top of merged UX-20. This PR is Draft and requires review.

## Problem

The old importer only matched local Flashcards against account-personal cards; a 260-card legacy deck could create duplicates of existing shared vocabulary. Separate account decisions must never be overwritten, including remembered=false. A user must see one account My Learning result across devices.

## Source boundaries

- Shared source: enabled ws_words + ws_topics, shared catalog, account progress by (user_id, word_id).
- Personal source: ws_personal_cards, per-user active catalog, account progress by (user_id, personal_word_id).
- Legacy source: wordsky_vocab_v2 and wordsky_learned stored in THIS browser only. Never delete/change on import.
- Browser-only public catalog marks in wordsky_server_learned_v1 remain a separate explicit import path. UX-21 does not change them.

## Three-way decision rules

Each legacy card is matched by normalized topic + English first, then exact six-field fingerprint (topic, English, IPA, meaning, example, translation).

1. Exactly one shared match with identical six fields: use existing shared UUID, optionally transfer known=true only if account has NEVER reviewed this word.
2. Exactly one existing personal match: reuse its UUID and same progress safeguard.
3. No candidate by topic+English, and English also absent from all shared and personal words: new personal word, with optional remembered=true.
4. A shared or personal card with the same identity but different content: conflict. Do not change/add anything.
5. More than one candidate for the same identity across shared and personal: ambiguous, skip.
6. The same English spelling in another topic without exact topic match: conflict/manual review, never automatically create a potentially duplicate personal card.
7. Existing decision remembered=false or true: always keep that account decision. Never overwrite it from device-local history.
8. An unremembered legacy card matched to an existing server card needs no review event.

## Architecture

- Browser: public/ux21-legacy-reconciliation.js produces a read-only preview, grounded in GET /api/learning/me/summary for the CURRENT signed-in actor. It reports counts for shared/personal matches, new cards, conflicts, ambiguous cards, already-reviewed, and actionable imports.
- API: POST /api/learning/import/legacy, using mustPlayer(req).id and optional expected_actor_id guard. Request includes six-field card + explicit known boolean. Never accepts a user_id or word_id from the client.
- Server: lib/legacy-learning-import.js re-queries the current shared/personal catalogs and classifies every request INSIDE a PostgreSQL transaction. It locks the account row to serialize repeated import requests for the same account.
- When known=true and not previously reviewed, insert progress with ON CONFLICT DO NOTHING. Write immutable review history ONLY if progress insertion succeeded. Therefore retry, double-submit and existing false decisions are safe. An existing review_count never decreases or increments on duplicate import.
- The UI requires explicit confirmation, processes max 20 actions per click, validates actor and catalog freshness before starting, stops on error, reloads authoritative data, and never writes localStorage.

No migration or added table required. Existing UX-10 and UX-17 tables remain source of truth.

## QA evidence, 2026-10-27

- Application commit: 74a5f6d382b5f114e6a74e836c1bd41dc31b3fae.
- npm run check + JS syntax checks: PASS.
- npm test: 316/316 PASS, including 12 new UX-21 scenario tests.
- Real Chromium + isolated Supabase Preview PostgreSQL: **19/19 PASS**.
  - Seeded one pre-existing remembered=false account decision.
  - Legacy deck had one exactly matching shared word, one different-content shared word, one already-reviewed shared word and one genuinely new word.
  - Reconciliation preview showed two safe actions, one content conflict, one already-reviewed decision.
  - After opt-in import, account My Learning reflected 365 shared + 1 personal, 2 remembered, reviewed=false preserved.
  - Repeating shared/personal imports did NOT create another word or history event.
  - The same account logged into a second independent browser and read identical unified totals and the new personal card.
  - All legacy localStorage JSON bytes stayed identical; browser 2 did not inherit browser 1's local data.
  - Zero JavaScript exceptions.
- Temporary UX21 QA user deleted from isolated Preview by exact ID+username with FK cleanup.
- Additional real Chromium + Preview PostgreSQL security/concurrency QA: **11/11 PASS**: rejected stale expected_actor_id (409) without writes; concurrent identical import produced exactly one reviewed row; concurrent new-word import created one personal card; an unrelated account could not read the owner's personal card; anonymous import was rejected (401). Both temporary QA users were deleted by exact IDs and usernames.
- Total real Preview integration/security checks: **30/30 PASS**. All temporary QA accounts removed.

## Release checklist

1. Keep PR Draft until reviewer examines identity/conflict decisions against representative real seed data (especially changed IPA, meaning and topic).
2. Cross-account ownership and actor pin were verified on live Preview; keep the negative cases in future permanent API regression tests.
3. Confirm Production databases are on the same UX10/UX17 schema and no schema action is required.
4. Do not automatically import the legacy deck: the user must explicitly open the archived-data panel and approve every batch.
5. Separate approval before merging to main/releasing Production. Preserve existing 4 Production users, shared vocabulary and progress.
6. Future phases: idempotency keys for all review activities, cursor pagination for large vocabulary libraries, SRS scheduler, game-evidence ingestion. Do not conflate game answer accuracy with remembered=true.

No Production user data, migrations, main branch or deployment were changed by UX-21.
