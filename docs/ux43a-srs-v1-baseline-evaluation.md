# UX43A — Research baseline for the current WordSky SRS v1

**Status:** Offline audit harness. Not a proposal to enable a new production
scheduler. No public API, UI, SRS flags, database migration, Production
user reviews or Vercel deployment are changed.

## Verified source of truth

- lib/srs-schedule.js defines the current fixed-interval prototype:
  **1, 3, 7, 14, 30, 60, 90 days**.
- lib/srs-projection.js versions the materialized shadow as
  **ux24-fixed-v1**. Accepted history remains authoritative; shadow
  schedules can be incomplete.
- lib/unified-review.js accepts explicit learner decisions
  (remembered true or false). lib/auto-game-review.js also records
  remembered=false after identifiable completed Solo mistakes and
  unanswered CAR practice words. These are not objective retention tests.
- lib/srs-release-gates.js requires TWO independent approvals before
  Production SRS behavior can change. Variable existence alone does not
  mean a switch is enabled. This audit modifies none of them.
- Shared history: ws_learning_flashcard_reviews.
  Personal history: ws_personal_card_reviews.
  Progress: ws_learning_word_progress and ws_personal_card_progress.
  Optional projection: ws_user_srs_schedules.

## Research question and measurement boundary

Does SRS v1 deterministically replay its stored accepted history,
and when did learners record new decisions relative to the previous
due date? Do we have enough reliable *measured recall* evidence to
compare SRS v2 against the existing policy?

**Important:** No verified per-attempt objective recall grade,
prompt type or origin field exists on all review events.
“Đã nhớ” and “Cần ôn” are self-reports, or automatic game marks.
They cannot be called correct/incorrect quiz answers, recall rate,
retention curve, or supervised FSRS training labels.

## Metrics and denominators

The aggregate-only audit in lib/srs-v1-audit.js returns:

| Metric | Meaning |
|---|---|
| accounts_with_history | Distinct users with recorded events in this isolated dataset |
| reviewed_cards | Distinct account + source + word with history, not the whole vocabulary catalog |
| marked_remembered / marked_need_review | Raw accepted decisions, not graded answers |
| first_review_events | First event per recorded card |
| repeat_review_events | Subsequent events for that card |
| before_due | Subsequent event strictly before previous computed due time |
| at_or_after_due | Subsequent event at/after previous computed due time |
| more_than_24h_after_due / more_than_7d_after_due | Strict overdue thresholds, subset of at/after due |
| early_remembered_preserved_due | Early remembered marking did not extend the previous due date |
| due / scheduled | Status among reviewed cards only at the snapshot instant |
| parity | Current fixed-policy incremental projection vs history-derived v1 |
| progress | Current progress vs accepted event count, last label and timestamp |
| shadow | Materialized projection vs full accepted history and policy version |

Missing shadow or progress rows are *not* silently converted to
mismatches: missing can mean older history not yet backfilled.
Orphan, missing and conflicting rows are separately counted.

Equal timestamps are ordered by event ID. Account, shared and personal
card identities are never conflated. Duplicate event IDs, timezone-less
timestamps, future events and oversized datasets fail closed.
The result never contains raw account IDs, word IDs or review events.

## Reproducible local-only commands

Use an already migrated, seeded isolated PostgreSQL17 instance:
**127.0.0.1:5547 / wordsky_v6_test / wordsky_test**.

1. **npm run audit:srs:fixture**: insert one synthetic QA user,
   11 review events across 3 cards, current progress and one shadow
   row inside a PostgreSQL transaction that ALWAYS ROLLBACKS,
   even if a check fails. Expected: 0 history/projection mismatches,
   3 matched progress rows and 1 matched / 2 missing shadow rows.
   Dataset tag: synthetic-qa-transaction-rollback.
2. **npm run audit:srs:local**: take a REPEATABLE READ READ ONLY
   transaction over existing *local isolated* history, returning
   aggregate counts only. If QA users have been removed and the
   history is empty, this yields zeros, not a real-user conclusion.
   Dataset tag: isolated-read-only.
3. **npm test** and **npm run check**: source, invariant, privacy
   and historical timing regression checks.

The runner allows only exact localhost hostname, port, database and
test username. It refuses Vercel runtimes, applies strict row limits,
does not retrieve passwords or return individual events or identities,
and never calls COMMIT. Only the isolation QA fixture can INSERT, and
those inserts disappear at ROLLBACK.

GitHub CI runs the fixture after applying isolated migrations and
seeding, BEFORE the existing browser/account/SRS acceptance flow.
There are no Production DB credentials in this test.

## Research and release gates

Engineering PASS means:
- Both GitHub CI jobs succeed on the exact branch SHA.
- All fixture replay/progress invariants pass with zero mismatches.
- Existing QA account cleanup still succeeds, and no user progress
  is modified.
- Output is aggregate-only and labeled as synthetic/isolated.
- No Production deployment, schema change or schedule flag change.

This **does not prove a new scheduler is better**. UX43B must first
define an opt-in objectively graded retrieval event and its data
privacy, idempotency and device-sync contract. Then compare candidate
policies on held-out time-forward evidence, with clear coverage,
censoring, and per-learner/per-word cohort design. Never relabel
old self-reports as objective correct/incorrect outcomes.

**No Vercel Preview is needed for UX43A:** this is a research/QA
utility only, without an API route, UI, new DB table or feature flag.
Avoid creating a build simply to host an offline script. A code review
and CI success do not authorize activating SRS v2 in Production.
