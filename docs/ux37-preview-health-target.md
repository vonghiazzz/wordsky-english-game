# UX37 — Accurate health reporting for an isolated Vercel Preview

## Verified problem

As of UX36 Production, `GET /api/health` reported
`database: !!process.env.DATABASE_URL`. Preview uses
`WORDSKY_PREVIEW_DATABASE_URL` and `WORDSKY_PREVIEW_DB_REF`, selected by
`resolveDatabaseUrl` in `lib/db-target.js`. Thus a successfully isolated
Preview may report `database:false` while `GET /api/topics` returns 200.

This is an observability bug, not evidence of broken Preview database access.
It is **not** related to the fixed MATRIX/MEMORY Learning Insights regression.

## Scope and security contract

- The existing `database` field remains a boolean meaning **"a permitted
  database connection target is configured"**, not actual socket or SQL
  connectivity.
- Health uses the **same target selection and project-isolation guard** as
  the normal application queries; never bypass or weaken that guard.
- A missing, mismatched, production-identical or otherwise forbidden Preview
  DB configuration returns `database:false` from health, while actual
  application queries continue failing closed with HTTP 503.
- Production and local behavior are unchanged: `database` reflects
  `DATABASE_URL` configuration, as before.
- Health does not open DB connections, query PostgreSQL, expose credentials,
  accept client-selected environments or change HTTP 200 semantics.
- Do not expose the internal Supabase project ref, database URL, password,
  TLS certificate, or session secret in the response or logs.
- No schema migration, SRS changes, data import, learning-progress writes,
  user changes or Vercel configuration changes.

## Verification

1. `npm run check` and `npm test` include a direct health handler test for
   Production, approved isolated Preview, denied Preview and missing DB.
2. Confirm the denied Preview still raises HTTP 503 on real database access.
3. PR CI must pass unit/PostgreSQL and browser jobs on an immutable SHA.
4. After review, at most one **manual** Preview build using the isolated
   Vercel Preview environment. Expected: `/api/health` returns
   `database:true` and `/api/topics` works. Check without logging secrets.
5. Merge and Production deploy only after user approval; verify Production
   alias and health. No deployment is authorized by this document.

The health endpoint is a configuration signal. To verify live connectivity,
use the existing authorized/read-only PostgreSQL-backed API smoke checks
(`GET /api/topics`, not an intrusive artificial load test).
