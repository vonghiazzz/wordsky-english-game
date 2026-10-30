# UX31 — Admin password reset audit history

UX30 records successful password resets in `public.ws_admin_password_reset_audit`,
but Admin could not review them. UX31 adds read-only security history beneath
the account-management list in `/admin-users.html`. No changes to passwords
or vocabulary, SRS, games and learning data.

## UI and API

- `GET /api/admin/users/reset-history?q=&page=0&size=20` is Admin-only.
- Paginated search by learner username; page 0..10000, size 1..50, q <=64 chars.
- Show learner username, Admin actor username and timestamp in Asia/Ho_Chi_Minh.
- No local storage, password fields, hashes, or session versions in output.
- Whitelisted SQL fields, bound query parameters, deterministic date/ID sorting.
- Each history list refreshes after a successful password reset.

## Release gates

- No new migration. UX31 reads the existing **UX30 migration** audit table.
- Isolated Preview already has UX30 schema; Production migration remains pending.
- CI uses isolated PostgreSQL17 plus Chromium/Firefox QA with disposable users.
- GitHub-first: one reviewed PR, manual Vercel Preview after CI, then production
  backup/migration/release in a separate explicitly approved step.
- Never connect Preview to Production or deploy on a push automatically.
