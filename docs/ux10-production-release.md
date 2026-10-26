# WordSky UX-10 — Production release runbook (2026-10-26)

## Verified state (do not treat a READY deployment as schema readiness)

- GitHub PR #22 was merged by \`vonghiazzz\` into \`main\` at 2026-10-26 09:23:07 UTC.
- \`main\` merge commit: \`9ad1268fa9f555ae7d86eff1faf428cfc41c853b\`.
- Vercel Production deployed that commit and reported \`READY\`.
- **Production PostgreSQL did not have** \`public.ws_learning_flashcard_reviews\` or \`public.ws_learning_word_progress\` at the time of read-only audit.
- Separate Supabase Preview project had both tables with RLS enabled.
- Browser Flashcard progress remains local and must never be overwritten, migrated, or silently merged into account progress.
- Do **not** run production migrations without the owner's explicit authorization.

## Release gate A: safe API behavior while production tables are absent

The patch in \`fix/ux10-production-schema-failclosed\` fixes the error handler's scoped route-variable bug.
A PostgreSQL \`42P01\` error on a \`learning/...\` route must return HTTP 503 and:
\`{"error":"Đồng bộ tài khoản chưa được bật trên database này."}\`.
Other routes retain their existing error handling. This change is **code-only**; it does not create or modify database objects.
Verify automated tests, Vercel Preview, and browser-only Flashcards before asking to merge the fix.

## Release gate B: Production migration (explicit approval required)

**Never connect to Preview using Production credentials; never run against Preview by mistake.**
Double-check project ref and Production environment, and use the existing reviewed migration:
\`db/migrations/20261025_ux10_flashcard_progress.sql\`.

Read-only preflight:

\`\`\`sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ws_users','ws_words','ws_learning_flashcard_reviews','ws_learning_word_progress')
ORDER BY table_name;

SELECT c.table_name,c.column_name,c.data_type,c.udt_name
FROM information_schema.columns c
WHERE c.table_schema='public'
  AND c.table_name IN ('ws_users','ws_words')
  AND c.column_name='id'
ORDER BY c.table_name;
\`\`\`

After owner approves *Production DDL*, apply the additive migration inside a transaction through an authorized channel. It creates two tables and one index, enables RLS and revokes public/API roles; it does not modify or delete existing users, words, score or Flashcard data.
Avoid running an independent seeding or import command. Do not add any sample review records in Production.

Read-only postflight:

\`\`\`sql
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
('ws_learning_flashcard_reviews','ws_learning_word_progress')
ORDER BY c.relname;

SELECT count(*) FROM public.ws_learning_word_progress;
SELECT count(*) FROM public.ws_learning_flashcard_reviews;
\`\`\`

**Note:** Merely creating the tables is insufficient evidence of working account sync. Validate an authenticated user on the actual Production origin with a real, pre-existing user account (do not create one merely to test), and record the user's consent before changing personal learning data.

## Release gate C: Rollback and safeguards

- If migration fails, roll back the transaction; **do not** drop unrelated schemas, disable RLS, or change permissions to get past errors.
- If the API deployment fails, roll back the code deployment. Do **not** drop the new tables just to roll back code; removing them can erase newly saved progress.
- Reconfirm Vercel project/commit/target and Production hostname; validate \`/progress.html\`, \`/learn.html#flash\`, login and logout behavior.
- Keep account/browser metrics explicitly separate, including for guests and API errors.
- Never auto-import browser progress or infer \`ws_words.id\` from only the English word.
- Release is complete only when migration and authenticated account write/read are verified and existing gameplay regressions remain green.

## Tracking

- PR #22: https://github.com/vonghiazzz/wordsky-english-game/pull/22 (already merged).
- Production site: https://wordsky-english-game.vercel.app/
- New code-only hotfix should be submitted as a separate PR; do not push directly to \`main\`.
