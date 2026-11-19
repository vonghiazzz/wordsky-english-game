# UX59 M6 — Assignment-to-evidence reconciliation contract

**Status: OFFLINE-ONLY design and synthetic test; NOT a real provenance guarantee or live-study authorization.** Tracking #150; related #148, #149 and Draft PR #146.

## Source-of-truth reuse
- UX43B `RECALL_PROTOCOL`, `RECALL_KIND` and `RECALL_CONSENT` are imported as canonical evidence labels.
- UX43C currently stores an opted-in random curated recall trial after authenticating the player/session. It does **not** create an independently assigned, fixed-delay holdout roster. Consequently, a UX43 record cannot be relabeled a delayed assessment without an independently approved backend design.

## Offline reconciliation
`lib/ux59-provenance-reconciliation.js` accepts two arrays **supplied only by a hypothetical trusted server snapshot**: scheduled independent assignments and graded typed recall events. It matches trial ID, account ID and word ID, approved answer revision, canonical protocol/consent and window. Assignment must precede due time, trial issuance must fall inside the fixed window, and submission must follow issue and be inside window.

For unmatched scheduled trials, count **missing**; for exact retransmitted evidence, count once; reject contradictory retransmissions, orphan evidence, cross-account/word mismatch, missing/invalid server timestamp or malformed outcome. Ineligible submitted assessments are separately counted by consent, curated state, answer revision, answer exposure, hints, repeat attempt, trial issue window or observation window.

Only aggregate counters are returned. No account ID, word ID, trial ID, answer or response text enters output.

## Critical security limitations
The synthetic caller can assert `independent:true`, `curated:true`, `consent_version` and timestamps. This function **cannot authenticate these assertions**, or prove that they originated in a signed server session, immutable database assignment, trusted time source, or current consent ledger. Thus it must never directly process browser input or be deployed as a study authorization/aggregation endpoint.

An eventual independent delayed assessment requires a reviewed database ledger with trusted account/session pinning, immutable assignment snapshot, authorized consent and deletion semantics, key/revision curation provenance, holdout contamination tracking, server timestamps, idempotent transaction/unique constraints, and complete roster nonresponse accounting. Reuse UX43's existing security controls; no duplicate independent score source.

## Validation, release decision
Run `node --test tests/ux59-provenance-reconciliation.test.js` and full CI. Tests cover missing, replay, contradictory duplicates, cross-account/word, assignment, consent, revision, answer leakage, hints, temporal bounds and aggregate privacy. CI tests code but does not certify an ethical or statistically valid study.

**Decision: HOLD_NO_RUNTIME_CHANGE**. No user enrollment, SQL migration, account history read/write, SRS mutation, feature flag activation, PR merge or production deploy. Protected Preview UX58 release gate #144 remains separate and unresolved.
