# UX30 — Admin User Management and secure password reset

## Scope
Integrate user management into the existing authenticated Admin workspace on
the main WordSky app (no new global learner menu item).
From the protected Admin command center, use the **Quản lý người dùng** link
to open \`/admin-users.html\`.

- Search registered player accounts by username/display name, with paged list.
- Select a player, confirm the exact username, enter a new password twice,
  and reauthenticate using the **current Admin password**.
- Successful reset updates the existing \`ws_users.password_hash\` using
  **the actual WordSky scrypt hashPassword()**, increments
  \`ws_users.session_version\`, and records an audit event.
- Only the actor username, target user ID, and timestamp are stored in
  \`ws_admin_password_reset_audit\`. No plaintext/hash/password fields in
  the Admin list, response, audit or logs.
- Don't modify the player's vocabulary, SRS, learning progress, game runs,
  or other data; resetting the password affects authentication only.

## Authorization / revocation contract
- Admin is **not** stored in ws_users; current WordSky Admin is the owner
  login backed by \`ADMIN_USERNAME\`, \`ADMIN_PASSWORD_HASH\` and signed cookies.
- Every list and reset API call checks that server-signed Admin cookie.
  Reset additionally requires a **fresh valid Admin password** in request
  body and strict trusted Origin, not an arbitrary request Host header.
- New player login/signup sessions carry the database \`session_version\`.
  The handler checks the database session version once per request; every
  protected read/write, authenticated Solo association, room membership and
  \`auth/me\` reject stale tokens by comparing against the user's
  current database \`session_version\`.
- The existing shared signed session parser still handles Admin and guest
  cookies. Password reset deliberately does **not** revoke unrelated
  event/guest sessions, which are separate capabilities.
- Older **player login cookies that lack session_version will be rejected**.
  On first deployment with this contract, active learners must sign in again.
  Inform users ahead of Production release.
- Wrong Admin step-up passwords count against the existing IP-based login
  failure throttle (10 attempts / 15 minutes). A successful verification
  clears that IP's failures.
- Each target can have at most **three resets per hour** (enforced by the
  durable audit table while holding the target row lock).
- Password policy: **12–128 characters**, includes a letter and a digit,
  may not contain the username, must differ from current password. This
  is stricter than signup's 8-char minimum by design.
  Do not use passwords already exposed in a chat as new permanent passwords.

## API
- \`GET /api/admin/users?q=&page=0&size=20\` (Admin only, page size <= 50)
- \`POST /api/admin/users/{UUID}/reset-password\` (Admin + step-up password
  + exact username + Origin)
- Body: \`confirm_username\`, \`new_password\`, \`confirm_password\`,
  \`admin_password\` (never print or log)
- Response: only \`ok\`, \`username\`, \`sessions_revoked\`.
- Invalid Admin password / cross-origin: deny. Never reveal which field
  was wrong when step-up fails.
- No client-supplied role, user ID in actor claims, or cross-account
  access to credentials.

## Database / deployment sequencing (IMPORTANT)
- Additive migration:
  \`db/migrations/20261029_ux30_admin_users_password_reset.sql\`.
- Supabase manages migration transactions automatically. Do not place
  explicit BEGIN/COMMIT in UX30 SQL: partial commits could leave schema and
  migration-history inconsistent. Apply Preview first using migration runner.
- Adds \`session_version DEFAULT 0\` and \`password_changed_at\` to
  \`public.ws_users\`. Adds audit table and index; enables RLS and revokes
  Data API roles for audit table.
- **No Production SQL has been run for UX30.**
- Deploying new API BEFORE the migration would break player login because
  the new session_version column would not exist.
- Applying migration BEFORE the new app leaves old runtime fully compatible
  (additive columns/table); safe staging sequence:
  1. CI PostgreSQL17 from scratch, tests pass.
  2. Human-verified **isolated** Preview database: apply migration,
     build one manual Preview from exact tested PR SHA, QA user search,
     reset and invalidation, then approve.
  3. Review and merge PR to GitHub main. Auto-deploy stays disabled.
  4. Confirm backup and run reviewed migration on Production.
  5. Stage new Production build from approved SHA (no domain), test,
     then promote manually. Verify login, account isolation, old session
     invalidation and admin reset, without modifying real user passwords
     as smoke data. Roll back app only if needed.
- Production web currently stays on previous READY deployment until
  release gates are complete.

## QA
- Unit: role enforcement, no credential leakage, origin validation,
  fresh Admin credential, strong double-confirmed password, rate limit,
  scrypt, transactional audit, session version.
- Isolated PostgreSQL17 + Chromium/Firefox: independent guest/player/admin
  cookies, Admin list, reset and old session invalidation, new password
  login, mobile 360px, cleanup of disposable users.
- Do NOT run reset using any real account during automated QA.
