# UX43E1 – Internal Admin recall draft curation (drafts only)

**Status:** Local/isolated QA workbench. Neither reviewed nor authorized to
collect Production recall data. This slice adds a manually authored draft
workflow, **NOT an approval workflow**.

## Why drafts cannot be activated yet

UX43D identified a scientific control gap: WordSky has a single signed
Admin identity, `owner`; it does not have separate identities and audit
receipts for **two independent bilingual prompt reviewers**. A single
owner clicking an Approve button cannot substitute for two reviewers.
Therefore UX43E1 deliberately implements **no** `approved=true` or
`active=true` mutation and does not promise to validate meaning quality.
The existing UX43C question API only chooses records that are **both**
approved and active, so new UX43E1 drafts cannot enter the player pilot.

Existing manually provisioned approved/active isolated QA rows (if any)
remain unchanged; this workbench can view but cannot edit/delete them.

## Implemented Admin workflow

Visit `/admin-recall.html` **on an explicitly enabled, isolated QA
server** after signing in as WordSky Admin. The workbench:

1. Searches enabled shared vocabulary and topic metadata (20 per page).
2. Selects one English word; the Admin writes a Vietnamese cue, a
   curated set of 1–8 English variants and a stable revision token.
3. Requires fresh Admin password and **exact nonoptional Origin**.
   Creates one version with `approved=false`, `active=false` and
   `curator='owner'`, ignoring no client-supplied activation fields.
   There is no bulk import or automatic promotion of all 365 words.
4. Checks that the selected catalog English is an accepted variant,
   reuses the strict UX43B prompt/variant syntax and literal-answer
   exposure check, and rejects invalid/unapproved input.
   **Lexical validity is not semantic accuracy.**
5. Lists versioned drafts for the logged-in Admin only. The workbench
   never edits a stored version; use **new revision** for changes.
6. Allows discarding **only** inactive/unapproved drafts after fresh
   Admin password + exact revision confirmation. Already approved/active
   rows cannot be removed by these routes.

A rate limit of 60 new drafts per rolling 24-hour window is serialized
by PostgreSQL advisory transaction lock to avoid concurrent bypass.
Duplicate (word, revision) creates return HTTP 409.

## Authorization / environment

- `GET /api/admin/recall/words`: enabled shared words search.
- `GET /api/admin/recall/drafts`: all privately curated prompt versions.
- `POST /api/admin/recall/drafts`: draft-only creation.
- `DELETE /api/admin/recall/drafts/:id`: discard an inactive, unapproved
  version only, with confirmed revision.

All routes require WordSky signed Admin cookie `role=admin,id=owner`.
For writes, the service separately checks exact Origin and the freshly
supplied Admin password using the existing scrypt hash, IP throttling and
login-failure ledger. Neither password nor its hash appears in draft
records or response bodies. Unknown request keys, including `approved`,
`active`, `curator`, `user_id`, `id`, are rejected.

The gate is `WORDSKY_RECALL_PREVIEW_ENABLED=true` **and**
`VERCEL_ENV !== production`. Production can never be activated by
setting a Preview flag. This is the same gate used by UX43C; a future
release can introduce a more restrictive curation-specific flag after
independent-review architecture is approved.

The existing migration `db/migrations/20261031_ux43c_typed_recall_pilot.sql`
already contains the private `ws_recall_curated_prompts` table.
**UX43E1 introduces no migration** and grants no Data API permissions.
RLS, explicit `REVOKE` from `PUBLIC`, `anon` and `authenticated`,
and server-side account controls stay unchanged. No Supabase SQL is
executed in this workstream.

## Testing and release boundaries

- Pure unit tests for feature gate, password/Origin, fake DB writes,
  schema shape, duplicate versions and prompt validation.
- CI includes existing PostgreSQL17 and Chromium/Firefox suites and
  additionally `scripts/ux43e1-admin-recall-e2e.mjs`: the QA script
  connects **only** to 127.0.0.1:5547/wordsky_v6_test, uses disposable
  account, inserts one draft, verifies `approved=false/active=false`,
  tests Admin-vs-player boundaries and 360/390px pages, then deletes it.
  No real account or Production database reads or writes.
- One version's creation does not change any active prompt count,
  learning review, UX43C consent/evidence, XP or SRS queue.
- Do **not** create a Vercel Preview merely to host research code until
  the separate Preview database, privacy notice and participation
  eligibility are approved; never apply the migration on Production.

## Follow-on UX43E2 — not yet implemented

1. Introduce **independently authenticated** bilingual reviewers, with
   two distinct IDs, immutable review receipts and blinded initial
   decisions. Ensure one person cannot impersonate two reviewers.
2. Capture agreement/disagreement and adjudication with a stable
   `answer_revision` and reproducible definition of ambiguous clues.
3. Enforce an atomic approval/activation transition server-side only
   after both required reviews, semantic validation and locked revision.
   Prevent multiple active versions or identical bilingual cues that
   imply different answers.
4. Review consent purpose, age/guardian eligibility, data retention,
   deletion/export and isolated Preview before enabling player-facing UX43C.
5. Evaluate research signal quality without silently promoting old
   self-reported `remembered` events into objective recall labels.

**No causal evidence of SRS v2 superiority** is produced by UX43E1.
