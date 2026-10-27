# UX-24 Phase 2A: account-authoritative SRS queue (read-only draft)

## State and release gate

- UX-24 Phase 1 algorithm was merged in PR #41.
- As of the latest read-only check on 27 October 2026, Production Supabase still **does not** have `public.ws_learning_review_requests`. Existing UX-23 endpoints are deployed but depend on this table. The production migration requires separate, explicit approval. Do not apply migrations, merge this feature, or switch experimental SRS on in Production until that release gate is resolved.
- Phase 2A intentionally adds **no SRS persistence table and no writes**. The API reconstructs schedule from authoritative account-scoped, append-only review histories with a consistent PostgreSQL snapshot.

## Preview-only API contract

`GET /api/learning/srs/queue?status=due&page=0&size=20`

Available only if `WORDSKY_SRS_PREVIEW_ENABLED=true` and `VERCEL_ENV !== production`; otherwise HTTP 404. Existing session authentication required: unauthenticated clients receive HTTP 401 when feature enabled. Never accepts `user_id` from the query string.

- status: `due` (default), `new`, or `upcoming`
- page: non-negative integer (0 default, maximum 10000)
- size: 1..100 (20 default)
- output: `scope:account-srs`, authenticated `actor_id`, `policy:ux24-fixed-interval-prototype`, one database snapshot `as_of`, `status`, `page`, `size`, `total`, `total_pages`, full `summary`, and paged `words`
- Each word includes its source (`shared` vs `personal`), UUID, content and derived SRS state. `review_count` comes from the accepted history events; this is a **read-only experimental score**, not a guarantee of mastery.
- Data is scoped by `user_id` in both history queries, and personal cards are scoped by `user_id` and `deleted_at IS NULL`. Disabled shared words and topics are excluded.
- Repeatable-read PostgreSQL transaction ensures the card set, review histories, and `as_of` are consistent. UTC timestamp computation avoids device timezone drift.
- Bounds: 5000 cards per source and 50,000 history events per source; oversized cohorts fail closed with 503 rather than silently truncate. No artificial 20-word vocabulary limit. This is a provisional bound, not a long-term scalable database query design.
- Sort by due timestamp then source/UUID; `new` words sort by source/UUID. Duplicate review-event IDs are rejected rather than merged.

## What this does NOT do

1. It does not create a materialized SRS schedule or expose a production UI.
2. It does not rewrite `ws_learning_word_progress`, `ws_personal_card_progress`, historical review events, or UX-23 idempotency ledger.
3. It does not infer SRS success from game answers.
4. It does not repair existing Production migration gaps.
5. It does not claim to be FSRS or validated spaced-repetition learning science.

## Phase 2B: design for durable schedule (not yet approved or applied)

Before adding any new DDL, confirm review event completeness and invariants on isolated Preview, then design an **additive** per-user/per-word state table (for example user UUID + source + word UUID as primary key, last accepted event reference, streak, next due UTC, policy version, updated UTC). Enable RLS and revoke all direct Data API access; WordSky uses its own server-side sessions, not Supabase Auth JWT ownership for this table.

Implement initial backfill from the full append-only history in a resumable, idempotent manner. Never use `review_count` alone to fabricate a remembered streak. The new schedule update must commit in the **same DB transaction as the UX-23 accepted review**; a replay must not advance schedule and a 409 conflict must roll back all writes. Handle both legacy review paths or explicitly retire them before materialization. Recalculate old rows if the algorithm changes using policy versioning.

Only after this: compare materialized schedule against the Phase 2A derived queue on an isolated test cohort and validate cross-device results. Plan migration/rollback and separate Production approval. Do not merge the draft PR automatically.
