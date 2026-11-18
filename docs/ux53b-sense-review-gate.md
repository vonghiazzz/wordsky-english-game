# UX53B — Sense-level CEFR eligibility gate (phase 1)

## Current state
- Verb catalog has **300** English V1 entries with V2, V3 and Vietnamese glosses.
- **295** have Oxford 3000/5000 evidence on the English verb *headword/POS* only, **5** explicitly unreviewed.
- A headword's CEFR does **not** prove that every Vietnamese gloss or prompted sense has the same level.
- **Zero** sense-level approvals are currently established. Do not present an A1–C1 level filter to learners yet.

## Implementation
- `public/verb-cefr-sense-review.js`: initial queue of 20 exact Vietnamese meaning anchors for independent editorial approval, each `proposed`. `approved` is an explicit separate gate and is intentionally empty.
- `getApprovedVerbCefrLevel(v1,meaning)` only returns a CEFR level for a fully approved, exact-meaning review; currently returns `null` for all entries.
- `createVerbQuiz({cefrLevel:'A1'})`: fail-closed level-specific candidate selection. Before approval, returns `[]`; **no fallback to random unverified words**.
- `createVerbQuiz()` and `createVerbQuiz({kind:'regular'})` retain existing 10-question behavior; all user history and retry flows unchanged.
- No Vercel DB schema, user/SRS data, server grading, or frontend filter changed in this phase.

## Editorial approval criteria for UX53B phase 2
For each word:
1. Verify exact Vietnamese gloss against an explicitly identified English **verb sense** (Oxford/Cambridge entry URL and meaning definition).
2. Record independent sense-level CEFR evidence where offered; avoid blindly using the headword-POS CEFR for a different sense.
3. Document reviewer, review timestamp and source, then create explicit approved record in code with tests.
4. Apply filter only when each offered level has a useful number of distinct approved senses for a 10-question session.
5. Ensure account history remains server-graded and retries do not introduce out-of-scope vocabulary.
6. Run unit/PostgreSQL and browser QA before enabling the selector.

## Tests
`tests/ux53b-sense-approval-gate.test.js` verifies 20 proposals, 0 approvals, fail-closed A1–C1 requests, meaning drift, null/invalid levels, and legacy quiz behavior.

## Sources of headword CEFR
- [Oxford 3000](https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf)
- [Oxford 5000 additional words](https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000_by_CEFR_level.pdf)

These PDFs alone do **not** constitute sense-level approval.
