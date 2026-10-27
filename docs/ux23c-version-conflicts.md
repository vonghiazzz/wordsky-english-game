# UX-23C — Optimistic review conflict guard (backend-first)

## Status

Backend capability implemented on feature branch; not released. The account review API now optionally accepts `expected_review_count`, the last observed review version of the word. This is an incremental step, **not the final multi-device UX contract**.

## Semantics

- Missing `expected_review_count`: existing UX-23 behavior remains backward-compatible; a new intentional review can update the word.
- Supplied nonnegative integer: the server locks the authenticated user's `ws_users` row in the review transaction, claims the idempotency key, reads the latest `review_count` for the selected shared or personal card, and requires equality. Missing progress row = 0.
- If versions differ, the request returns HTTP 409 without inserting a new review or updating progress (the transaction rolls back the idempotency claim too). UI should refresh that word and ask the player to resolve the conflict.
- Identical retry of an already committed request uses its existing idempotency key and returns the saved result (regardless of subsequent version changes).
- Different requests targeting the same account are serialized by the account lock, so even the zero-row initial state cannot admit two stale commits with the same observed version.
- Existing actor isolation, request-id retry semantics and review history remain unchanged. No additional schema migration is necessary beyond UX-23A.

## Tests and outstanding work

- `npm run check` PASS; `npm test` **330/330 PASS** on commit `7b6de5dea3aa04137ddade1da24c12ae89771d88`.
- Added validator tests (zero, positive, invalid) and backend lock/CAS assertions.
- **Not yet live-E2E verified** on this UX-23C commit. This PR remains Draft pending real Preview PostgreSQL concurrent request checks.
- Authenticated UI does **not yet submit** `expected_review_count`; currently it still benefits from idempotency, not strict cross-device CAS. Complete the UI data contract (expose version on the account summary, load versions on Flashcards and personal manager, send observed version, refresh on 409 with a clear conflict message, retry only after user reconfirms).
- Existing production is already on a merged UX-23 code revision but the Production database lacks `ws_learning_review_requests`. Treat that as a **priority release blocker**. Do not merge/deploy this feature or change Production without explicit owner approval for the missing migration and release sequencing.
