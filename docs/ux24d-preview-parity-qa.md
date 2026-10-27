# UX-24D: Self-service SRS consistency check (Preview only)

## Current evidence
- 27 Oct 2026: read-only audit of Supabase Preview: 7 materialized shared-word SRS schedules; **7/7 match** deterministic full-history replay on policy version, ordered last event, review count, last review timestamp, remembered flag, consecutive remembered, interval days and due timestamp.
- A schedule entry exists only after a word was reviewed with Preview shadow enabled, so older reviewed words can be reported as **missing** until a deliberate backfill/re-review. Those historical words are still included in the authoritative history-derived SRS queue.
- There are currently no materialized personal-card schedules on that Preview dataset, although synthetic and isolated PostgreSQL tests cover personal review behavior.

## Preview-only endpoint
`GET /api/learning/srs/diagnostics`

- Must authenticate through WordSky's own player session; no `user_id` parameter is accepted.
- Returns only `scope, actor_id, as_of, policy, status, history_words, materialized, matched, mismatched, missing, orphaned`; **no word content or review events**.
- Uses a single repeatable-read, read-only PostgreSQL snapshot; transaction never writes.
- Requires the existing Preview SRS feature gate. Forces HTTP 404 on `VERCEL_ENV=production` regardless of feature flag.
- Hard bounds: <= 10,000 shadow rows and <= 50,000 review events *per source*; fail closed if exceeded.

`status` is:
- `complete`: every account history word has a matching materialized schedule.
- `partial`: schedules already written all match, but some historical words are not yet materialized. **Not a bug in review history; a backfill coverage gap.**
- `mismatch`: one or more materialized schedules disagree with history or lack any source event. Never claim SRS is release ready.

## Manual website QA (keep same hostname)

1. Open the PR's Vercel Preview `/progress.html` in a browser and sign in with a WordSky **learner** account.
2. Scroll to "Ôn tập đúng thời điểm" and click **✓ Kiểm tra đồng bộ**. The result must say `X/Y lịch đã lưu khớp`, and possibly `Z từ đã học chưa được tạo lịch lưu`.
3. Choose `New`, `Daily Life`; mark a word **Cần ôn**. It should move to `Due` after refresh. Check audit again — matched schedule count may increase, and remaining historical-missing count may decrease.
4. In `Due` mark it **Đã nhớ**. It should move to `Upcoming` with a one-day interval after first accepted remembered event. Audit must remain zero mismatches.
5. Confirm the original My Learning library topic/status filters remain; sign in on another browser with the same user and check both SRS queue and audit numbers align after refresh.
6. Sign in as another account; audit must be account scoped. In Production SRS panel and endpoint must still be disabled.

**Manual browser testing is pending**. Automated HTTP/integration tests are not a substitute for observed browser QA.

## Release gates
- Production UX-23 ledger table is still missing; explicit independent migration authorization is required.
- SRS shadow table is currently Preview-only. History-derived SRS queue remains authoritative; a future backfill and migration/rollout plan must be reviewed before switching to persisted schedule reads.
- PR is Draft; no automatic merge or Production changes.
