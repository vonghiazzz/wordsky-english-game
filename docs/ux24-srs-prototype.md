# UX-24 — Smart Review/SRS algorithm prototype (NOT a release)

## Why this phase is isolated

UX-23C merged, but the Production database is still missing the UX-23A review-request ledger as of the 27 October 2026 read-only audit. **Do not merge, activate UX-24 endpoints, migrate Production, or deploy the scheduling feature until that separate release blocker is resolved.** This PR is a pure function plus unit tests only. It does not query or mutate any user data.

## Source of truth and semantics

- Signed-in account review history (shared and personal, scoped by authenticated `user_id`) is the conceptual input to SRS. Browser localStorage, server vocabulary catalog, and idempotency-operation ledger are **not** the canonical review history.
- The existing `remembered` boolean is a learner-selected state, **not a measured test score**. Calling a card `remembered` does not prove long-term mastery.
- The new algorithm is an explicitly provisional, simple fixed-interval heuristic; **not FSRS and not a validated personalized forgetting model**.
- `remembered=true` starts a success streak or advances it **only when the word is due**. An early repeated click remains in review history but cannot extend due time or inflate the interval. Review intervals: **1, 3, 7, 14, 30, 60, 90 days**, with a cap of 90 days. `remembered=false` resets that streak and makes the card due immediately.
- A word with no review history is **new**, not **due**. A due word is one that has a review event and whose `due_at` is at or before the evaluation instant.
- All scheduling compares absolute UTC instants. Store UTC `timestamptz`; show local dates in the UI (e.g., Asia/Ho_Chi_Minh) without changing evaluation semantics.
- The input uses append-only history rows `{id, remembered, reviewed_at}`, ordered deterministically by `reviewed_at ASC, id ASC`. Equal timestamps use event ID as a deterministic tie-break; commit order cannot be recovered from timestamps alone.
- The server eventually owns a single queue per account, with separate `shared:{uuid}` and `personal:{uuid}` identities. The pure prototype accepts already scoped data, **not arbitrary user-selected account IDs**.
- There is **no hard 20-word UI limit**. Any batch limit during legacy-import processing is an API limit, not a vocabulary or review-list limit.
- A game answer is not automatically a SRS success. UX-25 must explicitly define what constitutes trustworthy evidence.

## Prototype contract

`computeSrsState(history,{now})` returns `status` (new/due/scheduled), `review_count`, `remembered`, `consecutive_remembered`, `interval_days`, `last_reviewed_at`, and `due_at`. Empty history yields `new`, no due timestamp.

`buildSrsQueue(cards,historyByWord,{now})` returns complete `due`, `upcoming`, and `new` arrays and counts. Sorting is stable, due and upcoming oldest first, and repeated identical inputs give identical results across browsers.

## Next implementation slices (gated)

1. Confirm schema/history consistency in the isolated Preview database: progress rows vs. review events, including imported legacy events and deleted/disabled words. Decide a safe, no-data-loss initialization strategy for old accounts; do not fabricate historical success streaks.
2. Define and review an additive SRS state migration and an index for efficient due-date queries. Consider per-user/per-word schedule rows maintained atomically with UX-23 review transactions (never in localStorage). Keep old progress/ledger/history unchanged.
3. Implement authenticated read-only queue API with pagination, deterministic ordering, per-user authorization, and simultaneous-device tests. Respect the `shared` and `personal` word boundaries.
4. Implement the user interface (Due / New / Upcoming and next due time), with explicit review actions and conflict 409 recovery. Confirm one DB result across desktop/mobile browsers.
5. Verify in an isolated Preview, then separately approve Production migration and release in the correct sequence. No auto-merge. Build an evidence gate (reliability/retention) before claiming SRS improves learning.

## Test evidence expected

Deterministic time handling; review/forget/reset; duplicate history IDs; equal timestamp tie-breaking; no 20-item truncation; separate shared/personal IDs; stable queue regardless of browser ordering; no browser progress writes.
