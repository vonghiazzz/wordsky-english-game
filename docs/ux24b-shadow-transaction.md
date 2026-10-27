# UX-24B shadow SRS persistence — isolated QA only

## Delivered
- Additive `db/migrations/20261027_ux24b_shadow_srs_schedules.sql` defines `public.ws_user_srs_schedules`, primary key `(user_id,source,word_id)`, due-date index, policy version, last accepted history event, count and streak. RLS enabled and direct Data API grants revoked.
- `lib/srs-shadow.js` reconstructs an account-owned word's schedule from **its full append-only review history**, not from a number of remembered clicks. An already accepted UX-23 transaction can optionally shadow-write the result to PostgreSQL; the existing history-derived SRS queue remains authoritative.
- `recordUnifiedReview()` calls this after successfully writing BOTH a review event and the progress row, in the **same PostgreSQL transaction**. Request-ID replay and stale 409 exit before the shadow call.
- New UX-23 accepted commands use `clock_timestamp()` **after the account row lock** to reduce timestamp/commit-order ambiguity for new requests. Historical legacy reviews may still be out of order; full history is rebuilt deterministically. Legacy writers still do **not** update the shadow on their own.
- Test runs in ephemeral PostgreSQL CI verify same-account concurrent conflict, idempotency, shared/personal ownership, failed shadow write rolling back ledger/history/progress, and no shadow write when flag is off.

## Activation rules

Shadow writes occur **only when BOTH**:
- `WORDSKY_SRS_SHADOW_ENABLED=true`
- `VERCEL_ENV !== production`

The flag defaults OFF. Do not enable in Production. Before enabling on Preview, review additive migration, apply only to approved isolated Preview, verify the actual environment, and rerun authenticated HTTP two-device tests. This PR does **not** run migrations on Supabase.

## Critical non-release gates
- The Production UX-23 review ledger is STILL absent. That migration requires its own owner approval; no changes have been made to Production.
- Legacy `recordFlashcardReview()`, `markPersonalCard()`, and `importLegacyCard()` (including chunk imports) create history without shadow writes. Consequently the shadow table **must not be used as the authoritative user-facing queue** until all three writers are supported or retired. Import writes its progress row before the history event and must be brought under a compatible ordered, shadow-aware transaction before enabling materialized reads.
- Shadow reconstruction is O(history per word) on accepted review. It is suitable for this limited test stage; benchmark and implement an incremental or background backfill plan before scaling.
- Historical ambiguity (transaction timestamps and tie ordering) must be documented and resolved before claiming true accepted-event ordering. A deterministic replay is not the same as observing an exact historical commit order.
- Compare shadow vs. full history on an isolated dataset, including deleted personal cards, legacy reviews and concurrent 409 requests. Do not assume 12 shared progress words represent the full set of production accounts.
- Review/apply migration on Preview only after approval and test. Production requires **separate** approval for UX-23 and UX-24B migrations and deployment.

## Manual acceptance test (after QA Preview migration/flag approval)

1. Open the **same** Preview hostname in two browsers, log in with the same test account.
2. My Learning → Daily Life → Need Review; change a word. Filter and scroll position must not reset.
3. Repeat the exact same accepted request ID (simulate lost response); history, review count and shadow count may increment only once.
4. Update the same word from stale version on another browser: HTTP 409 and no shadow change; refresh before reconfirming.
5. Inspect isolated Preview shadow row and compare to `/api/learning/srs/queue`: review_count, remembered, interval_days and due_at must match.
6. Log in as another user: cannot access personal card reviews or shadow state. Production must still return SRS 404.

Manual browser tests and Preview database checks are **not yet performed** in this PR.
