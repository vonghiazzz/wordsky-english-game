# UX43E2A — Independent bilingual reviewer preflight (offline, fail closed)

**Status:** Independent-review *preflight only*. Does NOT implement an authenticated reviewer service, reviewer onboarding, immutable database receipts, an approval route, activation, or data collection. No migrations, SQL execution, deployments, or user exports.

## Motivation
UX43E1 has one Admin identity `owner`. Owner-created drafts cannot be approved merely by two clicks or two client-supplied reviewer names. UX43D requires two distinct human bilingual reviewers with verifiable independent identities and initially blinded judgments.

## Implemented
`lib/ux43e2-review-gate.js` is a pure function for trusted offline candidate snapshots. It fingerprints the exact draft ID, word ID, catalog spelling, Vietnamese cue, answer revision, and *ordered* English variants. It checks two distinct active independently authenticated bilingual reviewer records, no owner self-review, separate blind-initial receipts bound to the identical fingerprint/revision, and no duplicate reviewer/receipt; disapprovals or disagreements block. It also blocks duplicate active words or identical Vietnamese cues pointing to another word.

The aggregate output never exposes raw prompts, word IDs, identities, answer keys, or passwords. Even when all preflight conditions pass, `authorized_to_activate_prompts=false`, `immutable_database_receipts_verified=false`, and `independently_authenticated_reviewer_service_available=false` **always**.

**Security boundary:** The module does *not* authenticate reviewer identity or prove human independence by itself. Its roster and receipts MUST originate from an authenticated trusted backend and append-only verified records before any future workflow can rely on it. No client input can be accepted as trusted reviewer evidence. Existing UX43C and UX43E1 routes remain unchanged. Any future approval requires independent authorization, immutable receipts, blinded reviewer decisions and a separately reviewed DB transition; lexical tests alone do not prove semantic equivalence.

## Follow-up work (not part of this PR)
1. Product/privacy approval of reviewer eligibility, identity verification provider, training and consent.
2. Server authentication for independently verified reviewer subjects, not owner aliases; denial of impersonation and duplicate people.
3. Append-only signed/durable blind-initial review receipts with frozen snapshots; disagreement/adjudication contract.
4. Atomic approval/activation transaction with DB uniqueness/concurrency protection, audited semantics, rollback, eligibility/privacy and isolated Preview QA.
5. Only then consider UX43C human pilot and later SRS v2 evidence study. No automatic Production release or SRS migration.

## QA
- `npm run check`, `npm test` (new `tests/ux43e2-review-gate.test.js`).
- PR's existing isolated PostgreSQL17 + Chromium/Firefox suite protects unchanged runtime flows.
- No Vercel Preview/Production build, schema migration, Supabase access or SRS changes.
