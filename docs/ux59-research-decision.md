# UX59 M1–M3 — Research decision record (2026-11-19)

**Decision: HOLD / do not deploy the 12-hour candidate.**

## Source-of-truth & current implementation
- Canonical runtime policy: `lib/srs-schedule.js` (`computeSrsState`), fixed intervals **1 / 3 / 7 / 14 / 30 / 60 / 90 days**.
- An early `remembered: true` review inside an existing positive streak preserves its previous due date; `remembered: false` immediately marks the item due and resets its streak.
- `remembered` is a subjective learner decision, sometimes automatic game-originated activity; it is **not** an independently measured memory or correctness outcome.
- UX59 code in Draft PR #146 is offline-only. `lib/ux59-srs-offline.js` compares fixed histories; `lib/ux59-srs-cycles.js` simulates separate policy-dependent event histories; `lib/ux59-research-gate.js` always returns `HOLD_NO_RUNTIME_CHANGE`.

## M1: fixed-history counterfactual comparison
- Candidate hypothesis: after two consecutive *need review* entries followed by remembered, set first subsequent due date to **12 hours** instead of baseline **24 hours**.
- Nine deliberately small synthetic cases, with expectations: **2 earlier**, **1 later**, **6 unchanged** compared with the baseline's final due dates.
- The later case is important: a review performed at +13 hours is still an *early* positive review under the 24-hour baseline, but *on time* under the candidate and advances the next interval to 3 days. Thus *shortening an earlier due date can cause a later due date further in the future*.
- This comparison holds events fixed across policies. It cannot represent how a learner would change their future behavior when shown different schedules.

## M2: synthetic policy-dependent replay
- Four illustrative scenarios: 30d/90d, always marked remembered after two initial needs; 30d at a hypothetical 2-day threshold; 90d at a hypothetical 7-day threshold.
- Every schedule drives its own future review times. Review outcomes after the initial events are **fabricated by explicit deterministic rules**, not derived from users.
- To stop an infinite same-time loop for repeatedly due cards, the simulation inserts a **1-hour minimum gap**. This is an engineering simulation rule, not a measured intervention.
- The script `node scripts/ux59-cycles-report.mjs` produces a reproducible summary of review counts, subjective need-review counts and final due times.
- No population estimates, confidence intervals, real-world retention effect or comparative efficacy can be inferred from these scenarios.

## M3: safety and interpretation gate
**Status: HOLD.** Gate blockers:
1. Candidate can produce unexpectedly later final due dates even within a small fixed-history example.
2. No validated delayed-recall outcome dataset or reviewed evaluation protocol.
3. UX58 account-isolation / authenticated protected Preview release gate remains in Issue #144.
4. Synthetic policy-dependent trajectories do not measure learning effectiveness.

**Not an approval to merge or release the candidate.** CI passing certifies executable tests under repository setup, not educational value or deployment readiness.

## Future evidence requirements before an algorithm change
1. Define a consistent, consented, privacy-preserving **independent delayed-recall assessment**. Do not use the binary `remembered` UI signal as a ground-truth accuracy label.
2. Pre-register comparison protocol, eligible population, evaluation horizon, stopping conditions, primary outcome and workload guardrails; stratify by reviewed/not reviewed and avoid cross-device duplicate counts.
3. Run an isolated, no-user-write replay over vetted or appropriately de-identified histories if permissible, clearly labeling any proxy assumptions; consider a controlled opt-in study only after ethics/privacy and UX review.
4. Add versioned algorithm assignment, dry-run/shadow evaluation and safe rollback without rewriting existing due dates or review history.
5. Finish UX58 Preview QA #144 and release only a separately reviewed rollout PR with exact-head CI, account isolation, mobile E2E and protected Preview signoff.

## Reproduction and evidence locations
- M1: `node scripts/ux59-offline-report.mjs`, `tests/ux59-srs-offline.test.js`, `tests/ux59-offline-report.test.js`
- M2: `node scripts/ux59-cycles-report.mjs`, `tests/ux59-srs-cycles.test.js`, `tests/ux59-cycles-report.test.js`
- M3: `tests/ux59-research-gate.test.js`
- Source PR: #146. Planning issues: #145, #147; release blocker: #144.
- Check latest exact-head CI and record its run conclusions before calling any commit green.

**Scope guarantee:** This research branch does not modify runtime scheduler, DB schema, stored histories, the API, client learning behavior, production deployment or user data.
