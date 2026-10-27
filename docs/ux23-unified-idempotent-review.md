# UX-23A/B — Unified, Idempotent Account Review Service

Date: 2026-10-27. **Verified on isolated Supabase/Vercel Preview. NOT deployed to Production.**

## User-visible contract

- A signed-in player reviews a shared or personal vocabulary card in Flashcards, My Learning, or the personal-card manager. Each intentional review creates one unique `request_id` (UUID).
- A repeated HTTP request with identical `user_id + request_id + source + word_id + remembered` returns the **same reviewed_at** and does not add another review-history row or increment review_count.
- Reusing the same request_id for a different source, word or remembered boolean returns HTTP 409.
- A genuinely new review gets a different UUID and is counted as an independent event, even if reviewing the same word again.
- The user ID is **always** derived from `mustPlayer(req).id`. An optional `expected_actor_id` protects against login switching; guest attempts return 401 and cross-owner personal card reviews return 404.
- The same request_id may be used independently by different users because uniqueness is scoped to `(user_id, request_id)`.

## New API

`POST /api/learning/reviews` body:
```json
{
  "request_id": "UUID",
  "source": "shared",
  "word_id": "UUID",
  "remembered": true,
  "expected_actor_id": "UUID"
}
```

`source` is `shared` or `personal`; both use the canonical vocabulary UUID in `word_id`. Returns `scope:"account-review"`, `request_id`, `source`, `word_id`, `remembered`, `reviewed_at` and `replayed`. New accepted write: HTTP 201, `replayed:false`; identical replay: HTTP 200, `replayed:true`; mismatched reuse: HTTP 409. Other legacy review endpoints remain available for old clients and migration until their consumers are retired; calls through those older endpoints are **not** covered by UX23's request-ID deduplication.

## Database / transactional invariants

New additive migration: `db/migrations/20261027_ux23_idempotent_review_requests.sql`.

- `ws_learning_review_requests`: account-owned operation ledger with `PRIMARY KEY(user_id,request_id)`, `source`, `word_id`, `remembered`, `reviewed_at`, FK to `ws_users`, and a per-account recent-requests index.
- PostgreSQL RLS enabled; `PUBLIC`, `anon` and `authenticated` Data API table permissions revoked. WordSky accesses this table only through the authenticated server-side PostgreSQL connection.
- A single transaction claims `(user_id,request_id)` using `INSERT ... ON CONFLICT DO NOTHING RETURNING reviewed_at`. PostgreSQL waits for a concurrent claim to commit/rollback. If claimed by another committed request, compare the full semantic tuple and replay or return 409.
- Only a newly claimed request verifies an enabled shared card or an active personal card owned by this user, appends one immutable review event, and upserts a single current-progress row.
- Failure rolls back **all** of that request, including the ledger claim. An accepted identical retry cannot modify progress.
- This operation ledger is separate from authoritative current-progress and review-history tables. Do not build SRS solely from the ledger.

## Browser and device behavior

- `public/ux10-account-core.js` exposes `postUnifiedAccountReview`. Pending request UUIDs are cached in memory and `sessionStorage` **as transport metadata only** — never as account learning progress.
- Transient/unknown network errors retain the original request ID through a same-tab retry/reload. A definitive 4xx clears the pending ID; accepted 201/200 also clears it so a deliberate new review gets a new UUID.
- `public/ux18-flash-sync.js`, `public/ux10-progress.js` (unified account actions), and `public/ux18-personal.js` call this transport. They keep the actor revalidation and only update displayed state after server confirmation.
- Other existing import operations and guest/browser-local progress are deliberately untouched.

## QA evidence

- `npm run check` PASS; **328/328 automated regression tests PASS** at application commit `308fcf5863f6e7660162f4b4b9af0715c01968a8`.
- Real Preview PostgreSQL + Chromium authenticated API: **18/18 PASS**. Includes six concurrent identical replays, stable reviewed_at, single review_count, conflicting payload 409, new request ID increments count, personal ownership and cross-user request ID isolation.
- Real Preview Chromium end-to-end screens: **13/13 PASS**. Review committed to DB but the browser response deliberately dropped; retry reuses the same UUID and review_count stays 1. Flashcards, personal-manager new card + known, My Learning marking needs review, and independent browser seeing the same account summary all passed. Zero unexpected browser JS exceptions.
- Total live Preview checks **31/31 PASS**. All QA users created for these checks deleted by exact user ID and username, with owned rows cascaded.
- Supabase Preview migration applied; inspected RLS enabled, anon/authenticated SELECT+INSERT false, and zero exposed policies.

## Limitations / next tasks

1. **Production needs an explicitly authorized migration before merging/releasing this branch.** Without `ws_learning_review_requests`, the new UI would receive HTTP 503. Do not merge first.
2. Older `/api/learning/flashcards/reviews` and `/api/learning/personal/reviews` remain backward-compatible, but are not idempotent; the new three authenticated account surfaces use the unified endpoint.
3. Different request IDs are distinct legitimate events. A simultaneous multi-device *different decision* on the same word is currently last-commit-wins; strict cross-device conflict ordering/versioning is follow-up UX-23C.
4. Browser tab must be open for in-flight actions. `sessionStorage` pending keys are not an offline durable action queue, and localStorage is not authoritative for signed-in progress.
5. UX-23C: add durable integration tests around concurrent distinct commands/failed writes and scope; UX-24: SRS state/versioning; UX-25: game answer evidence pipeline. Do not treat one correct game answer as already remembered.

## Release gates

- PR Draft; no auto-merge, production migration or promotion.
- Review migration and backfill policy (no existing history is altered), account authorization, 409 behavior, UI regression, and multi-device behavior.
- Apply the reviewed additive migration to Production **only with explicit separate owner approval**. Verify RLS/grants then release code with separate approval.
- Re-test with consented Production QA user and clean only that account's QA data. Do not reset existing user learning progress.
