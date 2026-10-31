# UX43E2B1 — Offline reviewer identity and signed blind-receipt contract

**Status: safe engineering slice, not a released reviewer feature.** Neither a reviewer login nor an IdP/JWKS verifier, database receipt storage, reviewer invitation, approval endpoint, activation path or real-person eligibility system exists. No user/research data is accessed or exported. No Vercel/Supabase deployment or migration is requested.

## Why this exists

WordSky's current `ws_auth` roles are `admin`, `player` and `guest`. The only existing Admin, `owner`, cannot count twice or open two browsers and call them independent reviewers. UX43E2A's preflight requires an independently authenticated two-person roster but deliberately does not establish authentication or immutable receipts.

UX43E2B1 introduces **offline, testable contracts** in `lib/ux43e2b-reviewer-proof.js`.

### Trust boundary

An adapter, **not implemented here**, must validate an external identity provider's token signature (including key rotation), `iss`, `aud`, `exp`, `nbf`, nonce, MFA and fresh `auth_time`; it must map the identity to a trusted reviewer roster in a private server store. A client-supplied object with `trust_source='server-verified-idp'` is not authentication. The adapter may emit that marker only after successful external verification, and no request handler currently accepts such a principal.

The roster must carry independently verified stable *person* identity, not merely separate login account IDs. Two accounts belonging to one person fail the UX43E2A gate. A verified human and bilingual qualification must be established in a separately approved administrative process; a boolean alone is not evidence of semantic ability.

Only a recent MFA-authenticated, active, bilingual-qualified non-owner reviewer is eligible. A trusted backend must guarantee the initial review is blinded and call `confirmNoPeerDisclosure`; neither browsers nor client bodies may assert blinding.

### Receipt contract

An internal helper accepts exactly `{ decision: 'approve' | 'reject' }`, never a client-provided reviewer ID, activation flag, revision, score or prompt. The server freezes the original prompt's SHA-256 fingerprint from UX43E2A, creates a unique receipt, and signs a canonical field sequence with a **dedicated** 32+ byte HMAC key (not `SESSION_SECRET`). The receipt stores domain-separated keyed pseudonyms of the verified identity and the stable person binding; raw identity subjects, passwords and tokens are never included.

`verifyBlindSignedReview` rejects tampering, unknown fields, invalid timestamps and wrong keys. `assessSignedBlindReviews` additionally checks roster bindings, distinct reviewers and decisions using UX43E2A and **always** returns `authorized_to_activate_prompts=false`.

This establishes **receipt integrity only**. HMAC signatures do not make a storage layer append-only, verify a real person, ensure blindness, or establish human bilingual equivalence. No code path consumes the signed receipts in production.

### Scope and next steps

1. Decide the actual external reviewer identity provider and independent human-vetting policy. Never reuse the player or `owner` session.
2. Implement server-side OIDC signature verification, anti-replay, session expiry/revocation, MFA/step-up and an independently administered reviewer roster.
3. With separate privacy/security approval, add a *private*, append-only review ledger and atomic at-most-once initial decision with immutable draft snapshots. Verify with isolated PostgreSQL17 (SQL grants, RLS, FK/unique constraints, UPDATE/DELETE denied, concurrent submissions, withdrawal/retention).
4. Add an access-controlled **blinded** reviewer UI and auditable adjudication, without leaking peer votes until their initial decisions are frozen.
5. Only after all gates succeed, review a separate UX43E2C activation transition and UX43C pilot research eligibility, consent, data-retention and deletion policy. No Production migration or SRS v2 behavior change is authorized here.

## Acceptance

- `npm run check`, `npm test` (including `tests/ux43e2b-reviewer-proof.test.js`) on the exact PR SHA.
- Existing isolated PostgreSQL17 and Chromium/Firefox integration E2E remain green.
- No new DB migrations, Supabase queries, live account reads, feature-flag changes or Vercel builds.
- Receipt verification cannot be represented as cryptographic proof of two distinct *humans* absent an audited external verifier and roster.
