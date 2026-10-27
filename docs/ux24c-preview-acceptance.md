# UX24C — Preview acceptance guide (not Production release)

## Verified CI / environment prerequisites
- PR #46 on `feature/ux24c-srs-ui-and-legacy-shadow`; Draft until human browser test.
- Supabase Preview only: added `ws_user_srs_schedules`, verified RLS ON; `anon` and `authenticated` have no SELECT or INSERT grants.
- Vercel Preview branch only: `WORDSKY_SRS_PREVIEW_ENABLED=true` and `WORDSKY_SRS_SHADOW_ENABLED=true`.
- Production remains blocked by missing UX23 ledger and both SRS flags must never enable Production writes.

## Manual browser test steps

Use ONE Vercel Preview hostname for the entire session. Sign in as a WordSky **player**, then open `/progress.html`.

1. **SRS panel visible**: check heading “Ôn tập đúng thời điểm”, summary counts, “Đến hạn”, “Từ mới”, “Sắp đến hạn”, topic dropdown, cards and pagination. Card totals can change with time; do not hardcode a sample user's counts.
2. **Topic**: choose `Daily Life`, choose `New`, then Next. Every card must belong to Daily Life and page size must be at most 20. Change between tabs; selected topic must persist.
3. **Mark new word**: click “Đã nhớ” on a New word. The card should disappear from New and enter Upcoming (one day after first remembered event); summary counts update. Its first `review_count` becomes 1.
4. **Need review**: click “Cần ôn” on a New/Upcoming word. It must appear in Due, with next due now (not tomorrow). This is independent of the My Learning library's “Cần ôn” filter which means `remembered=false`, not strictly due today.
5. **Preserve filters**: My Learning vocabulary library → Daily Life → status “Cần ôn” → click review. Daily Life/status/search/scroll must remain, and SRS panel updates without a full page reload.
6. **Same account two devices**: sign in with a QA user on a second browser; refresh SRS and My Learning. Both must show same history-derived schedule; stale review from an older snapshot must return 409, refresh, and require a deliberate second action.
7. **Separate account**: sign in as another QA learner in a separate browser. The account's personal cards and their SRS state must not be exposed.
8. **Production gate**: new SRS panel must not appear in Production. Production migration must NOT run during Preview QA.

## Verification after user action

With read-only Supabase Preview database access, compare each reviewed word's shadow row to accepted history:

```sql
select s.source, s.review_count, s.remembered,
       s.consecutive_remembered, s.interval_days, s.due_at, s.policy_version
from public.ws_user_srs_schedules s
where s.user_id = :qa_user_id
order by s.updated_at desc
limit 20;
```

Do not assume an empty shadow table means no history: this phase shadows **new accepted events**; historical events remain the source of truth and will be reconstructed when that word is reviewed. The user-facing queue is still derived from complete append-only history.

## PASS/FAIL thresholds

**PASS** when browser SRS card changes survive refresh and cross-browser sign-in; My Learning filters remain stable; schedule and history versions agree; no duplicate/replayed review increments, no unauthorized progress leakage, and CI remains green.

**NOT RELEASE READY** until signed-in browser QA is documented, legacy-path rollback and Preview parity confirmed, and Production UX23 migration separately approved/verified. Do not auto-merge PR46.
