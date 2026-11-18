# WordSky — current state & UX55 release handoff (2026-11-18)

This document supersedes the *status-only* sections of the historical V4 README. Prefer live CODE > TEST > CONFIG > deployment records > docs when these disagree. This is a snapshot, not an automatic deployment or vocabulary approval.

## Source revisions and deployment
- GitHub `main` at audit: `b15264e23ddf4c4da030eb454ae97dd011aaf97e` (merged PR #127).
- Current production alias `wordsky-english-game.vercel.app`: Vercel deployment `dpl_EZcs3cSVnNgFpxWmb52FX3391K9n`, commit `0c06b8001dc37374a0b0c19e7b985597b3b759ac`, READY.
- Isolated Preview deployment: `dpl_8Qcmn6haX4rGiLZP3CY3tQvLxCwE`, commit `b15264e...`, READY. Preview access is SSO-protected; a READY deployment does **not** prove an authenticated manual UI sign-off.
- `vercel.json` contains `git.deploymentEnabled=false`; merging to main does not publish a new production build.
- UX54 A1 practice selector is **coded and CI tested**, not yet confirmed on production.
- Latest CI evidence: PR #127 Actions #270, unit/PostgreSQL and Chromium/Firefox + account/SRS E2E SUCCESS.

## V1/V2/V3 learning scope
- `public/verb-dictionary.js`: 300 curated verb records with V1/V2/V3 and legacy Vietnamese meaning.
- `public/verb-cefr-evidence.js`: Oxford headword/POS evidence for 295/300. This is **not** blanket meaning-level CEFR approval.
- `public/verb-cefr-sense-review.js`: precisely 12 source-backed approved **A1** legacy exact-meaning records in main; 8 other broad meanings remain proposed. `public/verb-cefr-sense-candidates.js` stages 16 *unapproved* sense-split drafts for these 8 words.
- `public/verb-practice-core.js`: only exact approved senses enter filtered quizzes; A2/B1/B2/C1 return no eligible questions.
- `public/verbs.html` + `public/verbs.js`: A1 selector, disabled A2-C1; 10-item minimum for a selected level+kind. Legacy all-level quiz remains available. A1 all=12, irregular=11, regular=1 (start disabled).
- No migration or learner/SRS write was needed for UX54; account practice history remains separate.

## Vocabulary / My Learning caution
- The last documented production vocabulary import on 2026-11-17 reported 1,099 shared entries across 30 active topics, 365 APPROVED + 734 PROVISIONAL. **This document does not re-read the live database** and should not be treated as a new production count.
- Those 734 PROVISIONAL entries are not human-confirmed sense-level CEFR labels. Do not call them approved or re-import already-published LIFE batches.
- Do not modify existing learner progress, review history, password data, or accounts as part of a vocabulary or CEFR release.

## Legacy PR audit as of this snapshot
Five old PRs remain open: #82, #93, #94, #99, #100. Their historical PR-head CI runs reported SUCCESS, but GitHub reports `mergeable=false` against current main. Do **not** force merge.
- #99: historical current-state doc, now outdated; this document ports a minimal corrected current-state handoff.
- #100: LIFE-01 read-only preflight + records of already-performed production imports; its content is not authorization to import again.
- #93/#94: older stacked inactive-topic tooling, carrying draft LIFE-04/LIFE-05 content; requires dependency and diff re-review before merge.
- #82: older offline cue audit; re-evaluate independent of newer learning/recall behavior before merging.
A green historical CI is not a substitute for a fresh exact-head integration run and conflict resolution.

## UX55 release gate
Tracking issue: https://github.com/vonghiazzz/wordsky-english-game/issues/128
1. Validate the exact candidate SHA and complete **authenticated Preview UI sign-off** (mobile and desktop, CEFR dropdown, 10-question A1, A1 regular disabled, A2-C1 disabled, legacy all-level and account history).
2. Stage a **production-target build without assigning production domains**; avoid promoting the Preview artifact because production environment may differ.
3. Verify the staged build's exact SHA, READY status, production env, and read-only /verbs.html smoke before promoting.
4. Promote the inspected staged build; re-check the production alias target and error logs.
5. Keep prior READY production deployment `dpl_EZcs3cSVnNgFpxWmb52FX3391K9n` as rollback target; do not execute rollback unless necessary.
6. No automatic approval of outstanding CEFR senses, no database migrations and no edits to learner data during UX55.

This file is documentation only. If main or production changes, refresh SHA/status from GitHub and Vercel rather than assuming these values remain current.
