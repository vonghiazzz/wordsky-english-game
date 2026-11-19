# UX59 M5 — Offline delayed-recall eligibility audit

Status: research-only, no live trial or deployment. Related #149 and design #148; SRS policy decision remains HOLD (#146).

## Purpose
Demonstrate a **privacy-minimal aggregation contract** over a complete synthetic scheduled-assessment roster. Not a recruitment service, not real UX43 evidence extraction, and not an estimator of memory retention. It must never be attached to a production request handler as-is.

`lib/ux59-delayed-recall-audit.js` accepts an array of synthetic rows that must include a trial ID, a timezone-aware target due time, observed time or explicit missing record, result, and server-confirmed eligibility flags. These flags cannot legitimately be trusted from a browser; any future integration must derive them from authenticated transactions and an independently registered assessment assignment.

## Counting contract
- Unique scheduled roster rows define **scheduled**. Exact replay of the same row counts once; conflicting versions of the same trial ID cause a hard error.
- **Missing** = scheduled assessment with no observed attempt; not called an incorrect answer and never silently omitted from the scheduled denominator.
- **Eligible** = submitted at/after due and within a fixed 24-hour default window, actively consented, curated, independently assigned, answer hidden, unassisted, first attempt. Correct or incorrect both count.
- **Excluded submitted** = no consent, unapproved prompt, not independent, answer exposed, assisted, repeated or outside window. Reason precedence is deterministic, so one excluded trial is counted once under the first applicable reason.
- Eligible accuracy = eligible correct / (eligible correct + eligible incorrect); null when no eligible submissions.
- Eligible coverage = eligible submitted / scheduled; completion coverage = all submitted, including excluded, / scheduled; null when roster empty.
- Returned JSON has aggregate counts only, never trial ID, typed answer, account ID, word ID or raw review history.

## Known limitations and controls
- No independent held-out delay or randomized assignment is implemented. Existing UX43 challenge issuance is random and **cannot be assumed** to fulfill the research design.
- Row validity is validated, but the prototype cannot prove the source of `consent`, `curated`, `independent`, `answer_hidden`, `hints_used` or `attempt_index`. These values are fabricated in tests. Backend provenance must be separately specified, checked and security reviewed.
- A 24-hour assessment window is an illustrative default; choose a reviewed, pre-registered window in the actual study.
- Raw per-trial input is accepted in process memory for a pure offline audit, but the module does not collect, fetch, export or persist data. Any use of actual learner data would require a separate approved privacy and de-identification protocol.
- Consent withdrawal, deletion, study refusal, nonresponse, curator revisions and assignment governance require dedicated end-to-end testing before real enrollment.

## Test and release gate
- `node --test tests/ux59-delayed-recall-audit.test.js` covers eligibility, missingness, duplicate replay/conflicts, exclusions, timing, malformed inputs and zero denominator.
- Exact-head repository CI must pass before the research package is accepted. CI does not validate an empirical SRS improvement.
- **Decision stays HOLD_NO_RUNTIME_CHANGE.** No SRS due-date changes, schema migrations, live participant data collection, flag activation, PR merge or Vercel deploy in this phase.
