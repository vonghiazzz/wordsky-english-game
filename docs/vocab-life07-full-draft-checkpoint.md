# LIFE-07 — full 100-candidate DRAFT JSON checkpoint

Date: 2026-11-16. `vocab/batches/LIFE-07.json` now contains **100 structurally complete candidate records**, four roadmap groups × 25, with the exact fields expected by `validateLife1000Candidates` (14 keys in actual schema; previous planning messages described 15 incorrectly). All remain `PROVISIONAL` and the batch remains `DRAFT`.

- Draft UK-style IPA strings: **100/100 authored**, **0/100 independently reviewed for full phrases**. Do not call them Cambridge pronunciations.
- Proposed A1=6, A2=29, B1=43, B2=22; **all 100 contextual_inference** and `cefr_source_label=null`. British Council URLs supply broad topic context, not individual CEFR certification.
- English examples and Vietnamese translations 100/100, copied from the prior editorial stage. Bilingual/editorial approval: **0/100**.
- Connector-based preflight compared 280 seed + 117 legacy drafts + 600 records LIFE-01..06: **0 normalized exact English collisions and 0 exact Vietnamese cue collisions**. Semantic uniqueness, live Production DB, per-account vocabulary and grading alternatives were **not checked**.
- Source-anchor review currently 26/100 expressions with Cambridge component/collocation references, **not** full-expression CEFR or full-expression pronunciation certification.
- 12 high-risk phrase meanings and 43 candidate alternative-answer proposals remain pending human bilingual adjudication.

## Offline commands required on a real checkout

```sh
node scripts/qa-life07-candidate.mjs
npm run vocab:plan
npm run check
npm test
```

Then test Chromium and Firefox gameplay, account sync and SRS on the **exact final PR HEAD** with an isolated PostgreSQL database. This session's execution container could not resolve github.com, so these commands have **not been executed or certified** here. Connector-side structural QA is not equivalent to running Node or browser E2E.

## Merge and release boundaries

PR #96 is stacked on #95 → #92 → #91, and target `main` is used to surface standard CI. Merge dependencies first, narrow and re-review final PR diff. The JSON draft does **not** approve CEFR, activate topics, change SRS, enable game answers, import PostgreSQL vocabulary or deploy Vercel. A later independent bilingual review, Production catalog reconciliation and explicit release approval are mandatory.
