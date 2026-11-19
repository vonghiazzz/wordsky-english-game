# UX57 Preview / Gameplay release evidence — 2026-11-19

## Checked
- GitHub `main` at `15992dad535ef6db98d49f78a397c3411b3b390a` includes merged UX57 cue uniqueness guard (#136).
- Vercel Preview **`dpl_EMitztjky8zjBL5a4wu7DHzQxRT9`**, `wordsky-english-game-orxeaq0vc-nghias-projects-6f5417e1.vercel.app`, deployed from that exact SHA, reported **READY**. The production alias remained on `dpl_9xRDMv1wY8RsMbAtuRgyLtXb9nCg` (older `aa3c425`).
- Previous #136 exact-head GitHub CI unit/PostgreSQL, browser/SRS and production GET all **SUCCESS**. Tests do not themselves prove end-user Preview gameplay.
- Automated request from the available execution environment to the unique Preview URL failed DNS resolution. The Preview is also subject to Vercel Deployment Protection; no anonymous bypass or production credentials are introduced. Therefore **authenticated Preview GUI acceptance remains UNVERIFIED**, not PASS.

## Added isolation regressions in this QA PR
- Test actual eight public Production-derived ambiguous cards (no user records) against MATCH, MATRIX, MEMORY and BOMB for unique English/Vietnamese cues across each entire round, including MATCH distractors.
- Negative test when raw word count is enough but distinct cues are insufficient: each mode must reject with HTTP-compatible 400 and an understandable reason instead of showing unfair duplicate answer choices.
- Validate random selection repeatedly and normal state confidentiality (meaning never leaked with MATCH English card; English never leaked on BOMB public view; MEMORY cards hidden).
- Preserve score, wrong-word list and SRS; no real accounts, production database mutations, Vercel redeploys or semantic synonym additions.

## Remaining Preview acceptance before Production promotion
- Test with an authorized browser session or scoped Vercel development OIDC token; do not expose auth tokens to CI logs or commit them.
- Preview should use isolated test accounts/storage. Do not create or mutate real Production learner records in Preview. Check that Preview env is isolated **before** any state-changing gameplay test.
- Verify MATCH, MATRIX, MEMORY, BOMB visual interactions with duplicate-cue and low-capacity fixtures, including displayed 400 error messaging; narrow viewport and Chromium/Firefox.
- Ensure **CAR** and **My Learning typed recall** are separately evaluated; this change does not certify those modes.
- Only then stage an exact-SHA Production build, verify, and promote with documented rollback. Do not promote the protected Preview build directly.

**Verdict:** Preview build READY and isolated code-level QA available; authenticated manual Preview signoff is a distinct pending gate.
