# UX-24B — Persistent SRS schedule readiness (projection slice only)

## Verified current state (27 October 2026)

- UX-24A derives a read-only account SRS queue from append-only PostgreSQL history. It is intentionally disabled in Production.
- Supabase Preview has 14 shared review events for 12 progress rows; no count mismatches or orphan review events; no personal-card history yet.
- Production `to_regclass('public.ws_learning_review_requests')` is still NULL. **No Production migration or rollout is authorized by this PR.**
- PR #43 (My Learning filter preservation) was merged into main and Vercel deployed it. Automated tests pass, but manual browser validation remains separately required.

## Why first add a pure projection

`lib/srs-projection.js` can incrementally advance the SRS schedule for a newly accepted, ordered event without loading the full review history. `rebuildSrsProjection()` reconstructs from all real events, and `compareSrsProjection()` checks parity with the existing read-only UX-24A algorithm.

- `review_count` counts every accepted review event; this is not a consecutive-success count.
- `consecutive_remembered` only grows for a remembered review performed after the current due time. Clicking remembered early does not move `due_at`.
- `remembered=false` resets the streak, making the card due immediately.
- A replay must not call `projectAcceptedSrsEvent`; the UX-23 idempotency ledger determines whether a request is new or already committed.
- The projection is versioned as `ux24-fixed-v1`; an unknown policy version must fail closed.
- The updater rejects same-or-earlier ordered events, so a migration/backfill must sort using `reviewed_at ASC, id ASC` and reconcile from history when ordering is uncertain.
- Stored timestamps must represent UTC instants, not browser-local dates. Time-zone offsets are normalized by the pure function.
- This is a fixed-interval heuristic, not validated FSRS.

## Proposed schema contract (NOT an applied migration)

A future additive table `public.ws_user_srs_schedules` should contain:

| Column | Required semantics |
| --- | --- |
| `user_id UUID` | WordSky server-side authenticated account, foreign key to ws_users |
| `source TEXT` | shared/personal only |
| `word_id UUID` | Corresponding source UUID |
| `policy_version TEXT` | ux24-fixed-v1 |
| `last_event_id UUID` | Last accepted append-only event |
| `last_reviewed_at TIMESTAMPTZ` | Event timestamp |
| `remembered BOOLEAN` | Latest explicit learner decision |
| `review_count INTEGER` | Count of accepted review events |
| `consecutive_remembered INTEGER` | Capped schedule advancement policy input |
| `interval_days INTEGER` | Current scheduled interval |
| `due_at TIMESTAMPTZ` | Timestamp of next action |
| `updated_at TIMESTAMPTZ` | Audit time |

Proposed primary key: `(user_id,source,word_id)`; performance index on `(user_id,due_at,source,word_id)`. Enable RLS and REVOKE direct Data API permissions from `anon`, `authenticated` and `PUBLIC`; WordSky uses its **own server-session authorization**, not Supabase auth.uid() for these tables. No schema changes have been executed.

## Transaction and backfill gate

1. **Audit** actual review events in both sources, including legacy write routes and active/deleted/hidden vocabulary. Never infer review history from a `review_count` alone.
2. **Design/approve migration** and run only against isolated PostgreSQL first. Verify constraints, RLS, grants, and `ON DELETE` semantics. Because source IDs live in different tables, consider app-level source-specific FK validation or separate tables.
3. **Atomic shadow write**: After the server accepts a new UX-23 request and inserts its review event, project the state in that SAME database transaction. A replay or 409 must not mutate state. Test concurrent requests and controlled rollback.
4. **Handle all active legacy review routes** (shared and personal), or stop them before using materialized schedule as authoritative. Otherwise it will drift from history.
5. **Reconcile/backfill** from complete history in stable per-account order, resumably and idempotently. Do not overwrite a newer schedule after a concurrent review. Consider snapshot boundaries and progress version checks.
6. **Read-only parity verification**: Compare persisted and derived schedule for all QA words; expose aggregate mismatch counts only. Keep UX-24A history-derived queue as source of truth until parity and E2E pass.
7. **Explicit deployment gates**: Production UX-23 migration must be separately approved and verified first; UX-24 production migration and activation need their own approval. Do not merge this PR as a release.

## Important ordering nuance

The existing UX-23 ledger uses `reviewed_at DEFAULT now()`, which is the transaction start time, while the account-level lock serializes commits. If two transactions start in reverse order and one waits, timestamp order may differ from acceptance order. **Before materialization**, decide and test a monotonic event-order contract (e.g. per-account/per-word accepted sequence, or timestamp captured after the lock plus deterministic tie-breaking) and a backfill compatibility rule. The pure projector deliberately refuses unordered events rather than silently fabricating a schedule.

## Test plan

- New, success-after-due, early repeated success, immediate need-review, history replay
- Equal timestamp tie-break, duplicate event reject, UTC offset equivalence, interval cap
- Read-only derived queue vs materialized shadow state on isolated PostgreSQL
- Concurrent double-device conflict; same UUID retry; rollback; actor switch
- Shared/personal isolation; browser filter persistence; no Production 503
