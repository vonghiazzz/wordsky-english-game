# LIFE-07 — evidence checkpoint after fifth Cambridge batch

**Evidence scope:** 26 unique WordSky expressions are linked to Cambridge evidence for a *component or dictionary collocation*. This is **not 26 verified whole-phrase CEFR grades** or full-phrase IPA transcriptions.

- Anchors across 5 staged files: 9 + 6 + 5 + 3 + 3 = **26 unique**.
- Of those anchors, **15** have a recorded Cambridge CEFR label for a *selected component sense*; others document pronunciation or a collocation without a corresponding certified grade.
- All 100 WordSky teaching-level placements remain editorial `contextual_inference`, with `cefr_source_label=null`.
- Full-phrase IPA confirmed: **0/100**. Full-phrase CEFR confirmed: **0/100**. Independent bilingual editor approvals: **0/100**.
- Additional direct Cambridge evidence: [sore throat](https://dictionary.cambridge.org/dictionary/english/sore-throat) has UK IPA `/ˌsɔː ˈθrəʊt/` but no listed CEFR; [cough](https://dictionary.cambridge.org/dictionary/english/cough) has UK IPA `/kɒf/` and B1 for the medical noun, with `dry cough` shown as usage. Neither automatically certifies `have a dry cough` or `have a chesty cough`.

## Priority blocking tasks before creating an importable vocabulary batch

1. Check full-expression naturalness and whether each Vietnamese cue accepts several valid English phrases; provide explicit accepted-answer decisions rather than guessing automatic single answers.
2. Resolve two CEFR disagreements between whole-phrase estimates and component labels: `ask about side effects` (B1 editorial vs C1 medical component); `break out in a rash` (B2 editorial vs C2 medical component). The mismatch is a **review flag**, not automatic evidence that the phrase shares the component's CEFR level.
3. Establish full-expression UK IPA methodology, including connected speech and acceptable variants. Do **not** concatenate unrelated dictionary headword IPA as verified whole-expression IPA.
4. Maintain independent source-by-sense reviews. The remaining **74** expressions have no Cambridge source anchor recorded in the five audit files.
5. Build the 15-field `vocab/batches/LIFE-07.json` only after completing those evidence/linguistic steps; then run `npm run vocab:plan`, Node 24/PostgreSQL tests and Chromium/Firefox E2E on the exact SHA.

## Executable QA

```sh
node scripts/qa-life07-unified.mjs
node scripts/qa-life07-inventory.mjs
node scripts/qa-life07-examples.mjs
node scripts/qa-life07-cefr-pos.mjs
```

The unified script consolidates the 5 Cambridge files and checks expression uniqueness, source URLs, evidence scopes, proposed CEFR separation and inventory alignment. **No local Node or CI run is claimed for these scripts in this checkpoint**. All tests must be executed on the eventual PR head SHA and a safe isolated test environment.

**Release:** no approval, no Production database import, no user data access, no gameplay changes, no merge or Vercel deployment.
