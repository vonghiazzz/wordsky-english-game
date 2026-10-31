# WordSky: incremental QA/product roadmap after UX42

**Baseline audited 2026-10-31:** GitHub `main` at `1fb998f` (research UX43E2B2), last verified Production deployment at `a1c877b` (UX42). They are **not the same**. Current research UX43 components are not a user-facing release.

**Delivery rules:** Exactly one small change set per PR; no direct DB/Prod writes, no silent Vercel preview/production builds, no automatic merge. Test each PR via GitHub CI with isolated PostgreSQL17 and Chromium/Firefox. Stage related features in a single isolated Preview build only after stable, then run real-device QA and explicit deployment approval. Existing player SRS data must remain authoritative and protected.

## QA-S1 — First: recall/SRS correctness

### QA-S1A (this PR): lexical audit of public seed, no runtime changes
- Scope: `db/seed-vocabulary.json`, the repository's **260-card sample seed**, not the live 365-word Production catalog or any account's personal words.
- A *pure* lexical audit flags: Vietnamese cue shared by different English answers; English string embedded as a standalone cue token; blank Vietnamese meaning; and same English with multiple cue meanings.
- Every result is a **candidate for human bilingual judgment**, never proof of a wrong translation. Borrowed words (e.g. sofa/taxi/internet) may be legitimate; do not automatically remove them.
- Observed seed baseline from preliminary static inspection: **26 topics, 260 cards, 1 identical-cue collision**: Vietnamese `năm` for `five` and `year`; **4 lexical English overlap candidates**: `wake`, `sofa`, `taxi`, `internet`; **0 blank meanings**. Do not generalize these counts to live Production.
- This PR adds no changes to `gradeRecall`, `public/ux28-practice.js`, SRS flags, APIs, SQL, reviewer activation, or state transitions.

### QA-S1B (next, only after QA-S1A CI)
- On a private QA fixture, manually label ambiguous cue/answer cases and test the current strict grader against representative valid answers and common mistakes.
- Define an explicit **uncertain/appeal** path for a plausible but unverified alternative; avoid silently recording `remembered=true` or approving user-submitted synonyms.
- Ensure account identity, idempotent retry, early-review due-date preservation and cross-browser SRS coherence. No live-user evidence reclassification.

### QA-S1C (requires human-reviewed answer catalog & security approval)
- Adopt only curated and revisioned answer variants from a trusted reviewer workflow with independent human validation. Do not synthesize synonyms or trust browser-sent answer lists.
- Change grading and persistence only after tests prove correct/incorrect/uncertain semantics for every branch, negative cases, concurrent retries and migration rollback.
- Keep UX43C/E experimental; no Production activation without reviewers, consent and release gates.

## UX-S2 — Simplify learning sources
Show one primary **account-owned progress** for signed-in users, and a plainly marked offline/local path for guests. Move legacy transfer and server-vs-local explanations into a reversible **Advanced** panel; never silently import, overwrite or delete stored words. Test account switching and three-browser sync.

## UX-S3 — Game-result → targeted practice
Keep the existing Solo wrong-word notebook and server sync as source of truth. Introduce one contextual "Practice the words I missed" entry after each of MATCH/BOMB/CAR/MATRIX/MEMORY; do not re-introduce duplicated page navigation. Verify no false mistake identities or SRS auto-mastering for successful game answers.

## QA-S4 — Accessibility, mobile and performance
Fix modal focus/Escape/Tab semantics, maintain 360/390/430px layouts with native keyboard, optimize My Learning focus refresh only after request-count and latency measurements. Fix verified runtime deprecations after tracing their origin. Run Chromium/Firefox and real mobile devices.

## UX-S5 — Guided five-minute daily learning
For guest and logged-in learners, one path through short Flashcard, practice and session summary without forced account registration; keep XP/game score separate from mastery. Add minimal and consistent progress/re-entry cues.

## UX-S6 — Pronunciation & listening
After correctness/UX gates, introduce trustworthy licensed pronunciation sources or explicit TTS fallback, replay/speed controls and accessible captions; no auto-marking memorized from listening.

## QA-S1A execution

```bash
npm run check
npm test
npm run audit:recall:seed
```

Acceptance:
- Audit tests validate collision detection, diacritics, whole-word lexical overlap, ambiguous polysemy, blank cue, private data rejection and deterministic reports.
- CI green (unit/PostgreSQL and browser/SRS), no changes to runtime paths, no DB secrets or external calls.
- Human content review is a follow-on deliverable; lexical reports are **never** imported into grading/SRS or UX43 approval automatically.

**Next action after this PR:** QA-S1B isolated fixture evaluation and reviewed answer-candidate policy, then stop for QA before any runtime behavior changes.
