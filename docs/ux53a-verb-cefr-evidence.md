# UX53A — CEFR evidence for verb dictionary (Batch 01)

## State / scope
- Catalog: 300 distinct V1 headwords, V2, V3, Vietnamese glosses.
- **47** matched to **Oxford 3000 English edition, pages 1–2/11**, POS **verb**, at headword level (A1–B2).
- **253** are `unreviewed`; `cefr.level=null` and `source_id=null`. Missing evidence is **not** interpreted as C1, B2, or "too advanced".
- Status `source_matched` means the English headword and verb POS align with the printed source, **not** that Vietnamese translation, particular verb sense, exact inflection difficulty, or an individual learner is evaluated.
- No CEFR filter, SRS mutation, database change, or new learning-history writes in this batch.

## Source of truth
- [Oxford 3000 English (PDF), pages 1–2](https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf)
- [Oxford overview: how levels are assigned](https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000.html)
- Source evidence data: `public/verb-cefr-evidence.js`; lookup embedded read-only into `public/verb-dictionary.js`.

## Next gate
1. Validate remaining words in small groups with headword/POS/sense provenance, from Oxford 3000/5000 and/or Cambridge dictionary sense CEFR labels.
2. Disambiguate meanings (e.g., `book` verb vs noun) and variant spellings; do **not** transfer one sense's level to all senses.
3. Separately review/approve a training eligibility set and design UX53B filters; never silently treat `source_matched` as `approved`.
4. Update tests on every new evidence batch; no production deploy until CI and review are green.
