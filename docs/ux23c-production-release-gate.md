# UX-23C production release gate (27 October 2026)

## Verified state

- PR #37 and PR #38 were merged to `main`, and Vercel auto-deployed the UX-23C revision to Production.
- At audit time, Production Supabase project `ilyhbhoqswsioxxpuvcb` returned **NULL** for `to_regclass('public.ws_learning_review_requests')`.
- Isolated Preview `zbdnvvvdjxmdurucfjpe` has the ledger; its RLS is enabled, with no SELECT/INSERT grants for `anon` or `authenticated`.
- The new unified review endpoint needs the ledger table. Production cannot be marked release-healthy until migration and authenticated smoke checks pass.
- GitHub Actions isolated PostgreSQL 17 concurrency test passed with **334/334** total tests on `e270d24`; this is not a substitute for Production verification.

## Preflight (read-only; Production)

Verify the exact Vercel project, deployment SHA, Production database mapping, database backup/recovery capability, and explicit owner approval. Do not print database connection strings, keys or credentials.

```sql
select to_regclass('public.ws_learning_review_requests')::text as ledger_table;
select to_regclass('public.ws_users')::text as users_table;
select to_regclass('public.ws_learning_word_progress')::text as shared_progress;
select to_regclass('public.ws_personal_card_progress')::text as personal_progress;
```

## Approval-gated remediation

1. Independently review the existing, additive migration `db/migrations/20261027_ux23_idempotent_review_requests.sql`. It creates an operation ledger, index, enables RLS and revokes Data API privileges. It does not delete or rewrite existing user progress.
2. Only after **separate, explicit Production migration approval**, apply the reviewed SQL to the confirmed Production Supabase project. Never redirect Preview credentials or run a destructive reset.
3. Verify the ledger exists and inspect RLS and grants directly:

```sql
select c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='ws_learning_review_requests';

select has_table_privilege('anon','public.ws_learning_review_requests','SELECT') as anon_select,
       has_table_privilege('anon','public.ws_learning_review_requests','INSERT') as anon_insert,
       has_table_privilege('authenticated','public.ws_learning_review_requests','SELECT') as authenticated_select,
       has_table_privilege('authenticated','public.ws_learning_review_requests','INSERT') as authenticated_insert;
```

All four Data API privilege checks must be FALSE. Also review the RLS policies and table constraints. Do not infer correct deployment from Vercel READY alone.

4. With an authorized, dedicated Production QA user, verify same-account Flashcards, My Learning, and personal cards in two browsers; lost-response retry; two distinct concurrent decisions (second one must return 409 with no history/counter increment); and cross-account ownership protection. Never delete real learning data.
5. Monitor Production 5xx and API errors after verification. If application rollback is required, use an owner-approved rollback plan. **Do not DROP the ledger** merely to roll back app code: it is additive and may contain legitimate review history.

## Outstanding limitations

- Earlier legacy review endpoints remain temporarily supported and do not use the new request-ID deduplication/version contract.
- Real authenticated browser-to-Preview E2E and Production smoke checks are still pending.
- Do not start UX-24 SRS rollout until this Production release blocker is resolved and verified.
