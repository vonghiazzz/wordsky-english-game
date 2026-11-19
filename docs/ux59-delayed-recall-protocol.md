# UX59 M4 — Delayed Recall Evidence Protocol (design only)

**Status:** DRAFT / NOT AUTHORIZED FOR LIVE ENROLLMENT. Tracking: #148. Offline SRS research: #146, #145, #147. Preview release blocker: #144.

## 1. Grounded reuse: do not duplicate UX43
CODE-level audit of `lib/ux43b-recall-evidence.js` and `lib/ux43c-recall-service.js`:
- Existing typed Vietnamese-to-English challenge evidence is deliberately separate from UX24 subjective `remembered`, game-generated reviews and the SRS schedule.
- `ux43b-opt-in-v1` consent is explicit. A trial must be curated, no answer leak, the first attempt, unassisted, within its expiry; result is `correct` or `incorrect`. Exclusions include no consent, expiration, repeat, assisted/exposed and blank.
- The service is Preview/local-only (`VERCEL_ENV !== 'production'` AND `WORDSKY_RECALL_PREVIEW_ENABLED === 'true'`), authenticated to a pinned player/session, limited to curated shared words and 25 trials/24h; 4-minute response window; idempotent submissions and account-level consent withdrawal delete associated trial/evidence data. Recorded evidence omits raw typed response.
- Existing random trial issuance and immediate response measure **a current recall attempt**, NOT independently verified delayed retention. Do not relabel it a delayed-retention outcome.
- The existing `schedule_unchanged:true` contract must remain intact.

## 2. Proposed research question
For consenting, eligible learners and curator-approved nonambiguous prompts, does a separately assigned scheduling policy improve **unassisted delayed first-attempt typed-recall correctness** at a **predeclared assessment delay** while keeping review workload and learner burden acceptable?

The research must be pre-registered and independently reviewed BEFORE enabling any real learner enrollment or changing SRS. The UX59 12-hour candidate is not endorsed.

## 3. Assessment protocol (not yet implemented)
1. Eligibility: opted-in adult/otherwise appropriately consented study participants under reviewed privacy terms; curated, correctly mapped shared word/sense prompts; no duplicate/ambiguous VI cue and no prompt leaking English answer. Do not assume headword-level Oxford evidence certifies a sense.
2. Independent assignment: pre-register unit of randomization (participant or word, not both); control for cross-account and cross-device contamination. A user must never silently switch schedule arms. Do not infer assignment from localStorage.
3. Study timeline: baseline eligibility check → supervised initial exposure → scheduled learning sessions → **fixed-delay independent assessment** (e.g. pre-specified 7 or 14 days, choice approved in protocol). Fix the target window/tolerance in advance and record deviation, not dynamically from the policy's next due date.
4. The assessment uses server-only curated answer keys with hidden answer, one unassisted typed first attempt and no hint/answer exposure. The independent assessment must not itself update SRS progress or schedule. Answer exposure from a prior trial is a contamination exclusion, not a passing score.
5. A pre-registered holdout item and assessment timing must prevent studying on the same prompt immediately before testing. Current UX43 randomly issues a prompt and **does not** track study-assessment assignment or delayed holdout; separate guarded implementation review is necessary.
6. Respect opt-out: consent withdrawal removes research evidence per verified DB guarantees; no continued collection or reidentification. Validate retention/expiry and access governance before study.

## 4. Outcomes and analysis
**Primary outcome:** eligible independent delayed trials with `result=correct` divided by all eligible independent first attempts (correct+incorrect). Report denominator, missing scheduled assessments and attrition separately; never hide missingness as exclusions or call the ratio mastery/CEFR certification.

**Secondary:** number of reviews per enrolled unique word, due/overdue distribution, time-to-review, trial latency buckets and burden, disaggregated by predeclared strata; cross-device replay and event deduplication must be checked.

**Eligibility/exclusion:** explicit active consent, pinned account, curated approved revision, no answer leaks, first unassisted try, assessment-in-window, independent holdout and correct treatment assignment. Track *counts of reasons*, not typed raw responses. Protocol amendments and manual curator decisions require an audit trail.

**Privacy-minimal reporting:** aggregate only; suppress small groups, avoid joining on names/email, never export answer strings or raw per-user histories to a public artifact. Do not move data out of its consented scope.

## 5. Required gate before live usage
- Protocol review: ethics/privacy, consent copy, sampling plan, power/sample size, registration before observation, independent primary outcome, sensitivity to missing assessments.
- Engineering: tests of account/role isolation, time window and timezone, actor-switch, identical request replay, answer-key secrecy, consent withdrawal/deletion, malformed input, expiry and server-only assessment schedule.
- Research: blinded/independent grading where feasible; no optimistic metric selection; explicitly compare to canonical UX24, with fixed evaluation horizon and workload guardrails.
- UX58 #144 authenticated Preview gate and controlled study-specific Preview signoff.
- Versioned assignment, rollback that preserves existing SRS schedules, and clear do-not-promote flag; separate implementation PR reviewed before any production activation.

## 6. Decision
**UX59 remains HOLD_NO_RUNTIME_CHANGE.** UX43 supplies a useful existing typed-recall pilot, but a delayed-retention study requires additional independent trial scheduling/holdout and methodological approvals. This document does not authorize study enrollment, live data capture, migration, PR merge or deploy.
