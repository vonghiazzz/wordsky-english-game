# LIFE-07 — Cambridge source anchor audit (Phase 4)

Checked 2026-11-16. **9 selected phrase anchors verified**, not 9 complete phrase pronunciations or source-certified phrase CEFR labels.

This is separate from the 100-row editorial CEFR guess. A word's CEFR must **not** be copied as a certified label for an entire expression.

| Expression | Verified anchor | Cambridge UK IPA | Direct anchor CEFR | Whole phrase verified? |
|---|---|---|---|---|
| feel light-headed | [light-headed](https://dictionary.cambridge.org/dictionary/english/light-headed) | /ˌlaɪtˈhed.ɪd/ | not shown | No |
| feel feverish | [feverish](https://dictionary.cambridge.org/dictionary/english/feverish) | /ˈfiː.vər.ɪʃ/ | not shown | No |
| feel nauseous | [nauseous](https://dictionary.cambridge.org/dictionary/english/nauseous) | /ˈnɔː.zi.əs/ (also /ˈnɔːʒəs/) | not shown | No |
| have a toothache | [toothache](https://dictionary.cambridge.org/dictionary/english/toothache) | /ˈtuːθ.eɪk/ | A2 | No |
| have a migraine | [migraine](https://dictionary.cambridge.org/dictionary/english/migraine) | /ˈmiː.ɡreɪn/ (also /ˈmaɪ.ɡreɪn/) | not shown | No |
| ask for a pharmacist | [pharmacist](https://dictionary.cambridge.org/pronunciation/english/pharmacist) | /ˈfɑː.mə.sɪst/ | not shown | No |
| show a prescription | [prescription](https://dictionary.cambridge.org/pronunciation/english/prescription) | /prɪˈskrɪp.ʃən/ | not shown | No |
| ask about side effects | [side effect](https://dictionary.cambridge.org/dictionary/english/side-effect) | /ˈsaɪd ɪˌfekt/ | C1 | No |
| feel homesick | [homesick](https://dictionary.cambridge.org/dictionary/english/homesick) | /ˈhəʊm.sɪk/ | not shown | No |

## Blocking semantic issue

The medical noun **side effect** has Cambridge **C1** in the drug/treatment sense; unrelated unexpected consequence sense is **C2**. LIFE-07's phrase **ask about side effects** currently has a WordSky teaching estimate **B1**. This is **not a direct technical contradiction of phrase CEFR**, because the units differ, but the mismatch warrants an explicit reviewer decision. Do not automatically overwrite the phrase label with the headword label or downgrade the source label.

**Other attention items:** `have a migraine` and `feel nauseous` have multiple UK headword pronunciations; `have a toothache` inherits an A2-labeled headword but not an A2-labeled phrase; `feel short of breath` must retain a clear learner-facing warning that difficulty breathing may be urgent, never medication instructions. All full-phrase IPA remains unverified.

## Release gate

All 100 English expressions are still `EDITORIAL_ENRICHMENT_NOT_IMPORTABLE`. Before `vocab/batches/LIFE-07.json`, review 100 exact expressions, confirm pronunciation decisions (headword vs connected-speech phrases), per-sense CEFR provenance, bilingual answers and naturalness. This file provides source anchors only, no reviewer signature, DB action or deployment authorization.
