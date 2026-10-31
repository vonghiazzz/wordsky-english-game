# UX42 — Revalidate account session after another device signs out

## Verified gap

UX40–UX41 correctly revoke all old signed player sessions by increasing
`ws_users.session_version`, and the server checks that version on each
authenticated API call. However, `public/account.js` originally fetched
`/api/auth/me` only on initial load and BFCache `pageshow` restores.
If a second browser changed the password or revoked all sessions,
an already-open account tab could continue showing its old username,
password forms and typed passwords until the user refreshed the page.
This is stale presentation, **not an authorization bypass**: the server
already rejects those sessions. My Learning has separate focus-driven
session checks and is out of scope.

## UX / code

- On window focus and document visibility changes to visible, perform
  a **read-only** `GET /api/auth/me`. Explicit window focus forces a check
  even if visibility state has not updated; other visibility events coalesce
  within 750ms while authenticated.
  BFCache restores force a check. No timers, background polling or new
  storage are introduced.
- Ignore auth responses that started before a newer refresh,
  user-submitted password operation or navigation. This avoids an old
  successful response showing credentials after password change/revocation.
- If the account is no longer authenticated, hide both security forms,
  clear all four password fields, clear the displayed username and
  display an explicit re-login message.
- If the same account is still active, keep the form fields and feedback
  so a user can switch to a password manager without losing their work.
  If the authenticated actor changes, clear previous typed passwords.
- Keep the success panel visible after **the current page** completes
  a password change or revoke-all action (the session is expected to be
  gone and the user needs the re-login instructions).
- This does not proactively change the Arena's live multiplayer/game
  polling, which has different gameplay constraints.

## Tests

- Unit contract test guards focus/visibility/BFCache, generation
  fencing, secret cleanup, debouncing, and preservation of UX40–41.
- Extend existing isolated PostgreSQL17 + Chromium/Firefox UX40/41
  E2E. Browser A revokes user B's sessions. Browser B retains an open
  account page with a password typed. Simulated tab refocus must hide
  the stale form and clear credentials. Re-login of B followed by
  another focus restores the correct username **without** old passwords.
- All QA writes are scoped to disposable CI accounts, cleaned afterward.

## Release gates and runtime warning

1. Feature branch and PR, both GitHub CI jobs PASS on exact SHA.
2. One manual isolated-DB Vercel Preview after CI; GET-only smoke and
   mobile page checks. No Production account password/session writes.
3. Human Preview acceptance, reviewed merge and one manual Production
   build, health/domain checks and no migration.
4. `DEP0169` Node 24 `url.parse()` warning remains an independently
   tracked diagnostic. The app's checked server routes already use
   WHATWG `new URL()`; without a call-site stack we must **not** claim
   the warning is caused by WordSky code or suppress it globally.
   Do not change Node/Vercel version as part of UX42.

No database migration, authentication endpoint changes, score changes,
SRS algorithm changes or Vercel Git auto-deployment.
