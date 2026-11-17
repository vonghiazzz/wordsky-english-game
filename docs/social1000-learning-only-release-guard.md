# SOCIAL-1000 learning-only release guard — implementation notes

## Purpose

SOCIAL-1000 contains full conversational utterances, not short game vocabulary. Reuse existing 10 `ws_topics` entries but ensure these entries are available in My Learning/SRS without appearing in MATCH, BOMB, CAR, MATRIX or MEMORY.

## Implementation
- `ws_words.learning_only boolean NOT NULL DEFAULT false` is additive; existing short word cards remain eligible for games.
- `db/migrations/20261117_social_learning_only.sql` creates the column. This SQL file does not run itself: apply through the repository's existing verified production migration procedure **before** importing any SOCIAL phrases.
- Game selectors and capacity checks filter `learning_only`; legacy deployments without the column can still read via `to_jsonb(w)->>'learning_only'` fallback.
- Existing My Learning and account SRS use enabled `ws_words` and therefore include learning-only cards once rows are inserted and enabled.

## Release gates — all required before production
1. Finish per-item bilingual, sense and CEFR editorial review. Keep estimated CEFR levels clearly PROVISIONAL; do not invent IPA, evidence, reviewer or signoff.
2. Apply the additive migration to an **isolated test database** and test that old 1,099 entries remain game-eligible and new learning-only entries never appear in any game mode (including current OPEN/LIVE events and new sessions).
3. Implement and test a dedicated idempotent importer that maps each new item to **existing** `ws_topics.title` and sets `learning_only=true` explicitly, with duplicate English/VI cue protection, immutable existing IDs and batched transactions.
4. Validate unified My Learning summary, two-browser account synchronization, SRS review and speech playback with real browsers.
5. Verify production backup/restore readiness and no conflicting active events; take latest live inventory and confirm no new duplicates; owner-approve exact manifest.
6. Apply migration and release approved 100-item batches, verifying counts/rollback and account progress after each import. No Vercel redeploy is required merely to insert data if code and schema are already safely in production.

## This PR's limits
This change **only introduces the guard**. It does **not** mark candidates APPROVED, bulk-import, modify user progress, or deploy production. The production total remains unverified in this PR.
