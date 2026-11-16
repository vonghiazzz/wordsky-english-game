# LIFE-07 — Cambridge additional source anchors (Phase 4 continuation)

Six additional Cambridge component-level anchors are supported by current public dictionary entries. **These do not verify the IPA or CEFR of the full WordSky phrase** and cannot approve any learner-facing card.

| Whole expression | Verified component | UK IPA for component | Cambridge CEFR for component's selected sense |
|---|---|---|---|
| break out in a rash | [rash](https://dictionary.cambridge.org/dictionary/english/rash) | /ræʃ/ | C2 |
| have a mild fever | [fever](https://dictionary.cambridge.org/uk/dictionary/english/fever) | /ˈfiː.vər/ | B1 |
| pick up a prescription | [prescription](https://dictionary.cambridge.org/dictionary/english/prescription) | /prɪˈskrɪp.ʃən/ | B1 |
| feel anxious about tomorrow | [anxious](https://dictionary.cambridge.org/dictionary/english/anxious?topic=anxious-and-worried) | /ˈæŋk.ʃəs/ | B1 |
| mention a drug allergy | [allergy](https://dictionary.cambridge.org/pronunciation/english/allergy) | /ˈæl.ə.dʒi/ | not evidenced |
| follow the dosage instructions | [dosage](https://dictionary.cambridge.org/dictionary/english/dosage?topic=medicine-in-different-forms) | /ˈdəʊ.sɪdʒ/ | not evidenced |

## New editorial mismatch to resolve

- `break out in a rash`: WordSky's proposed whole-expression grade **B2**, while Cambridge labels the skin-condition noun `rash` **C2**. Do **not** automatically overwrite the expression level; flag for independent reviewer decision.
- `follow the dosage instructions`: The word `dosage` has an evidenced medical definition and UK IPA, **but no certified CEFR label in the referenced entry**. Its whole-expression B1 remains a teaching estimate.
- `pick up a prescription`: the **medical document** noun `prescription` carries B1; the eyeglasses sense must not be substituted.
- Keep the earlier mismatch `ask about side effects` (B1 expression estimate versus C1 medical noun component) open.

Read both this file and `docs/vocab-life07-cambridge-source-audit.md` when reviewing. There are 15 source-anchored expressions total across the two checklists, not 15 full-phrase grades. Do not merge or import to Production before bilingual reviewer signoff, deduplication of semantic synonyms, full-phrase IPA decisions and exact-SHA CI.
