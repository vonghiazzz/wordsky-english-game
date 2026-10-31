# UX43E2B2 — Isolated reviewer OIDC handshake contract

**Status:** Test-only/server-adapter contract. **Not a working reviewer sign-in page.** No identity provider is configured or connected, no routes are registered, no new database tables or migrations exist, no credentials are generated, and no real WordSky players or reviewers are enrolled.

## Motivation and baseline

PR #80 merged UX43E2B1's reviewer proof/receipt contract. That code assumes an upstream IdP verifier has already performed cryptographic verification. WordSky currently has only its own `ws_auth` login for player/Admin/guest roles; it cannot be used as independent reviewer identity. UX43E2B2 adds a *separate* OIDC flow coordination contract without changing those sessions.

## Exact scope

`lib/ux43e2b2-reviewer-oidc-flow.js` provides a disabled-by-default factory that requires both `WORDSKY_RECALL_PREVIEW_ENABLED=true` and `WORDSKY_REVIEWER_AUTH_PREVIEW_ENABLED=true`, and rejects `VERCEL_ENV=production` even if flags are set. No route calls this factory today.

An internal coordinator supports four methods in isolated tests:

- `begin`: create random one-time state, nonce, PKCE S256 code verifier/challenge, and independent browser binding. Persist only hashes of state/browser binding. Pending state expires after 5 minutes.
- `complete`: require an exact, minimal callback shape; **atomically consume** the one-time state (also on failure), compare the browser-binding hash and pin issuer/audience/redirect URI. Pass an authorization code and PKCE verifier to a **trusted provider adapter** for exchange and cryptographic OIDC/JWT verification (not included). Reject unsigned/untrusted claims, nonce/audience/issuer/expiry failures, missing/faded MFA or an unqualified/unverified roster entry. Create an opaque random reviewer session with only a hashed token in a server-side session store; 15 minute expiration.
- `authenticate`: check server-side session expiration **and** re-read an active, non-curator, independent reviewer roster, revoking access immediately on removal or qualification change.
- `revoke`: delete a server-side session hash.

**No method approves, rejects, activates, mutates or publishes a recall prompt.** Reviewer actor output is forced to `can_approve:false, can_activate:false`; status remains `authorized_to_activate_prompts:false`. UX43C/SRS and player/Admin login are unchanged.

## Security boundaries — mandatory before wiring routes

1. Select and authorize a real reviewer identity provider and a maintained OIDC SDK (for example a supported provider-specific SDK or a well-maintained generic OIDC client). The adapter must verify signatures/JWKS rotation, algorithm allowlist, `iss`, `aud`, `exp`, `nbf`, `iat`, nonce, MFA `amr/acr`, PKCE and callback properties. A `signature_verified:true` JavaScript object is **not** proof of authenticity without this implementation.
2. Implement `pendingStore.consume(state_hash)` as a **single atomic read-and-delete** on isolated PostgreSQL with a unique state hash; never implement with raceable `SELECT` followed by `DELETE`.
3. Implement durable, server-only session storage and explicit revocation, expiry cleanup, lockout/rate limiting, suspicious-event logging without raw tokens, and a private independently verified roster. Separate email addresses and accounts do not prove different humans. Never trust a browser-provided reviewer ID, authorization, person key, roles or decisions.
4. On the eventual callback endpoint, set the browser-binding cookie `Secure; HttpOnly; SameSite=Lax; Path=/reviewer` (the cross-site IdP redirect needs Lax), and the resulting *separate* reviewer session cookie `Secure; HttpOnly; SameSite=Strict`; do not serialize the cookie secret fields in a response body, URL, DOM or logs. Bind cookies to fixed trusted origins, with CSRF protection on all state-changing methods.
5. Implement **no** approval/activation route before independently verified humans, bilingual quality policy, immutable separately reviewed receipt ledger, consent/age/guardian privacy gates and an approved QA environment. A real IdP integration, database migration and consent design require their own security/privacy reviews.

The future controller must enforce flag gates on every route, use a trusted fixed redirect URI, protect against callback open redirects, and prevent direct bypass of `begin` by using forged state. Local HTTP is permitted only for loopback testing; real deployments require HTTPS.

## Test evidence

`tests/ux43e2b2-reviewer-oidc-flow.test.js` exercises state/nonce/PKCE creation, browser-cookie binding, one-time redemption, replay and expiration, token-integrity marker and claims rejection, MFA and roster gates, short-lived/revocable sessions, client-field injection and disabled-by-default/Production behavior. The tests deliberately use **synthetic** in-memory storage and a fake token-exchange adapter. They do not constitute live OIDC authentication or human vetting.

Required CI on the exact PR SHA: `npm run check`, `npm test`, existing isolated PostgreSQL17 and Chromium/Firefox/SRS suites. No Supabase SQL, real user data, Preview builds or Production deployments for this slice.

**Next:** UX43E2B3 — approve actual identity provider, privacy/retention and reviewer human-vetting policy, then integrate a real cryptographic verifier + private atomic/append-only stores on isolated PostgreSQL. UX43E2C activation remains locked.
