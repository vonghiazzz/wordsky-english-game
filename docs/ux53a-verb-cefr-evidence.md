# UX53A — CEFR evidence for 300-verb dictionary

## State / scope
- Catalog: 300 distinct V1 headwords, V2, V3, Vietnamese glosses.
- **295** matched to **Oxford 3000 (281) or the Oxford 5000 extension (14)**, POS **verb**, at headword level (A1–B2).
- **5** are `unreviewed`; `cefr.level=null` and `source_id=null`. Missing evidence is **not** interpreted as C1, B2, or "too advanced".
- Status `source_matched` means the English headword and verb POS align with the printed source, **not** that Vietnamese translation, particular verb sense, exact inflection difficulty, or an individual learner is evaluated.
- No CEFR filter, SRS mutation, database change, or new learning-history writes in this batch.

## Source of truth
- [Oxford 3000 English (PDF), pages 1–11](https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf)
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

## Batch 04 — Oxford source matches, release gate
- 50 additional English **verb/POS** matches from the Oxford 3000 PDF, printed pages 6–11 (leave through visit).
- Total 197/300 `source_matched` and 103/300 `unreviewed`; **zero approved sense-level CEFR records**. Missing is not assigned C1.
- Full per-word regression in `tests/ux53a-oxford-batch04.test.js`.
- This commit **does not** enable CEFR filtering or adaptivity and **does not** write user vocabulary, SRS or practice records.
- Oxford's wordlist levels are attached at the English verb-headword level. A later editorial review of Vietnamese meanings and intended usage senses is required before UX53B.

## Batch 05 — Oxford 3000 source matches
- 50 additional English verb/POS CEFR labels, verified against Oxford 3000 PDF (pages 5–11); all entries belong to the 300-verb WordSky dictionary.
- Source-matched coverage: **247/300**; explicitly unreviewed: **53/300**.
- `source_matched` remains an English headword/POS reference, not CEFR approval for a Vietnamese translation or usage sense.
- No new CEFR filter, no database migration, no account/SRS mutation; QA: `tests/ux53a-oxford-batch05.test.js`.

## Batch 06 — Explicit Oxford 3000 + Oxford 5000 provenance
- Matched **34** additional English verb/POS headwords in the Oxford 3000 (A1–B2).
- Matched **14** additional English verb/POS headwords in the **Oxford 5000 expansion**, with explicit B2 (3) / C1 (11) labels. These entries must carry the separate `oxford-5000-extension-en-pos-cefr` source ID; never attribute them to Oxford 3000.
- Totals: **281 Oxford 3000 + 14 Oxford 5000 = 295/300 source-matched**.
- **5 unchanged and unreviewed**: `practice`, `kneel`, `sting`, `stink`, `undo`. The Oxford 3000 British list includes `practice n.` / `practise v.`: the WordSky spelling `practice` as a verb cannot silently inherit a British noun POS label. Other missing headwords must not receive an inferred C1 level.
- Source URLs:
  - https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
  - https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000_by_CEFR_level.pdf
- Tests: `tests/ux53a-oxford-batch06.test.js` plus previous batch regressions.
- **No sense-level or Vietnamese-gloss CEFR approval** yet. UX53B training-level filters remain disabled; no account/SRS/DB mutations.

## Next step
Before exposing a CEFR filter, conduct sense-specific editorial review of the 295 sourced headwords and review the five withheld words independently; maintain clear provenance for any proposed/approved label.
