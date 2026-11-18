# UX53A — CEFR evidence for verb dictionary (Batch 01)

## State / scope
- Catalog: 300 distinct V1 headwords, V2, V3, Vietnamese glosses.
- **147** matched to **Oxford 3000 English edition, pages 1–3/11**, POS **verb**, at headword level (A1–B2).
- **153** are `unreviewed`; `cefr.level=null` and `source_id=null`. Missing evidence is **not** interpreted as C1, B2, or "too advanced".
- Status `source_matched` means the English headword and verb POS align with the printed source, **not** that Vietnamese translation, particular verb sense, exact inflection difficulty, or an individual learner is evaluated.
- No CEFR filter, SRS mutation, database change, or new learning-history writes in this batch.

## Source of truth
- [Oxford 3000 English (PDF), pages 1–3](https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf)
- [Oxford overview: how levels are assigned](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000.html)
- Source evidence data: `public/verb-cefr-evidence.js`; lookup embedded read-only into `public/verb-dictionary.js`.

## Next gate
1. Validate remaining words in small groups with headword/POS/sense provenance, from Oxford 3000/5000 and/or Cambridge dictionary sense CEFR labels.
2. Disambiguate meanings (e.g., `book` verb vs noun) and variant spellings; do **not** transfer one sense's level to all senses.
3. Separately review/approve a training eligibility set and design UX53B filters; never silently treat `source_matched` as `approved`.
4. Update tests on every new evidence batch; no production deploy until CI and review are green.

## Batch 02 — source-verified verb/POS labels
- Add 50 verbs from Oxford 3000 PDF, printed pages 2–3/11 (carry through drive).
- Total source matches: 97/300; unreviewed: 203/300. Every item remains `source_matched`, not `approved`.
- Batch 02 tests: `tests/ux53a-oxford-batch02.test.js`.

## PR #115 validation gate
- Batch-02 CEFR labels remain review evidence and are not displayed as approved learning levels.
- Existing user SRS scheduling, XP, and quiz sampling remain unchanged.
- The dictionary remains 300 entries; 203 remain intentionally unreviewed.

## Batch 03 — Oxford English verb/POS evidence
- 50 further verbs (earn through learn) checked against Oxford 3000 English PDF printed pages 4–6/11.
- Coverage after batch: 147 source-matched / 153 unreviewed of 300; zero sense-level approved.
- No training-level filter, account modification, SQL migration, or SRS change. 
- Regression: `tests/ux53a-oxford-batch03.test.js`.
