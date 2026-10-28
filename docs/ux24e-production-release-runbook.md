# UX-24E — Production release readiness (NOT an authorization to deploy)

## Evidence baseline — 27 Oct 2026
- Production Supabase `ilyhbhoqswsioxxpuvcb`: **4 users, 365 active shared words, 54 shared and 1 personal review events**, 31 shared and 1 personal progress rows. Zero count discrepancies or orphan progress histories observed in the read-only preflight.
- Production **does not yet have** `public.ws_learning_review_requests` (UX23A ledger) or `public.ws_user_srs_schedules` (UX24B materialization table).
- Both tables exist only on isolated Preview Supabase `zbdnvvvdjxmdurucfjpe`.
- **Preview historical backfill completed and independently verified**: 8 legacy shared-word schedules inserted under a single account row lock, with rollback on precondition failures. Afterward 17/17 schedule rows match the full existing histories, with 0 unmaterialized historical words and 0 mismatched fields (27 Oct 2026). All legacy review events used `clock_timestamp()` with microseconds, so the backfill normalizes to the SRS JS policy's millisecond precision (`date_trunc('milliseconds', reviewed_at)`). This was a manual Preview-only SQL backfill; the repo's Preview CLI remains available as a repeatable implementation and is tested in isolated PostgreSQL.
- The Production event count is live and may increase while learners use the site; the last read-only check observed 56 events on 33 word/account combinations, including 1 personal card, with no history/progress mismatches. Do not treat an older snapshot count as the release-time truth.
- UX24A user-facing queue derives dates from complete append-only history, not the shadow table; this remains authoritative pending policy validation.

## Changes in this PR
- Production safety requires **both** independently set server-side flags:
  - `WORDSKY_SRS_PRODUCTION_ENABLED=true`
  - `WORDSKY_SRS_PRODUCTION_SHADOW_ENABLED=true`
- Either flag alone, or any Preview-only variable, keeps SRS endpoints closed (404) and prevents Production SRS shadow writes. No flags are created in Vercel Production by this PR. No database migrations or backfill are triggered by deploying code.
- `lib/srs-backfill.js` implements read-only dry-run by default, a same-transaction per-account shadow insert path, explicit full-history / progress-count parity and fail-closed existing-row mismatch checks. Review traffic and backfill both take the same `ws_users FOR UPDATE` lock during writes.
- `scripts/preview-backfill-srs.mjs` can ONLY address the verified isolated Preview ref; it refuses Production explicitly. It prints aggregate counts only, no credentials or word details.

## Release sequence (manual, explicit owner approval required)
1. **Freeze and document the baseline.** Verify live Production schema and counts before touching anything; take a verified snapshot/backup and confirm restore procedure, owner and maintenance window. Keep existing API and SRS release flags OFF.
2. **UX23 migration first.** Review `db/migrations/20261027_ux23_idempotent_review_requests.sql`, apply separately to Production only after approval, confirm table, RLS and denied grants for `anon/authenticated`. Re-test authenticated UX23 POST replay, 409 and persistence before touching UX24.
3. **UX24 additive table.** Independently approve and apply `db/migrations/20261027_ux24b_shadow_srs_schedules.sql`. Verify table, constraint, primary key, index, RLS and explicit denial of Data API access. No existing history or progress rows should be modified by DDL.
4. **Historical reconciliation.** Verify accepted event counts match progress for both shared and personal cards, including soft-deleted personal cards. Run a reviewed Production-specific dry-run workflow; do not use the Preview-only script or guess missing history from counts. If any mismatch, stop, investigate, and keep flags OFF.
5. **Approved production backfill.** Use the same per-account lock + deterministic full-history event replay as `lib/srs-backfill.js`. Run one account per transaction, verify `missing=0`, `mismatched=0`, `orphaned=0`. Retest concurrency and backfill while reviews are active before scaling. No unreviewed direct SQL to fabricate schedules.
6. **Deploy code with OFF flags**, run auth and data API smoke tests, verify existing WordSky learning unaffected. Then explicitly set the two Production flags together using controlled rollout; redeploy and test with a learner (not admin), phone/laptop, same-account and cross-account.
7. **Monitor and rollback.** If issues arise, unset either Production flag and redeploy: SRS UI/API becomes unavailable and shadow writes stop, while existing history and progress remain intact. Do **not** DROP tables or delete any learner history as rollback.

## Production read-only audit query

```sql
WITH shared_ev AS (
 SELECT user_id,word_id,count(*) AS n FROM public.ws_learning_flashcard_reviews GROUP BY 1,2
), personal_ev AS (
 SELECT user_id,personal_word_id,count(*) AS n FROM public.ws_personal_card_reviews GROUP BY 1,2
)
SELECT
 (SELECT count(*) FROM public.ws_learning_flashcard_reviews) AS shared_events,
 (SELECT count(*) FROM public.ws_personal_card_reviews) AS personal_events,
 (SELECT count(*) FROM public.ws_learning_word_progress p LEFT JOIN shared_ev e
  ON p.user_id=e.user_id AND p.word_id=e.word_id
  WHERE p.review_count<>coalesce(e.n,0)) AS shared_count_mismatch,
 (SELECT count(*) FROM public.ws_personal_card_progress p LEFT JOIN personal_ev e
  ON p.user_id=e.user_id AND p.personal_word_id=e.personal_word_id
  WHERE p.review_count<>coalesce(e.n,0)) AS personal_count_mismatch;
```

## Preview backfill

With a verified Preview-only connection in local environment:
- `node scripts/preview-backfill-srs.mjs` — dry-run, no writes
- `node scripts/preview-backfill-srs.mjs --apply` — apply only to verified Preview after checking dry-run output
- Repeat dry-run: `ready_to_insert=0`. Reload My Learning and click **Kiểm tra đồng bộ** for each QA learner; expect zero mismatches and missing schedules.

## Release criteria

- All isolated PostgreSQL CI tests pass with concurrent review, retry, stale 409, personal cards, backfill repeatability and rollback.
- Preview dry-run/apply and authenticated two-browser QA pass. A successful CI run alone does **not** prove browser acceptance.
- A separate, explicit owner authorization for Production migrations, backfill and flag activation is recorded.
- No automatic merge or Production changes are authorized by this PR.


## Connection capacity preflight - 28 October 2026

- Vercel logs reported EMAXCONNSESSION: Supabase session pooler
  reached its 15-client limit.
- Vercel Preview and Production now use a maximum of one PostgreSQL
  client per serverless instance, with a 1-second idle timeout.
- Local and CI retain the existing five-client pool.
- This reduces connection pressure but is not a global connection cap.
- Production database connection strings and SRS release flags
  remain unchanged.
- Validate a TLS-secured transaction-pooler strategy before
  high-traffic rollout.
