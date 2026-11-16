# WordSky Vocabulary Batch 1 — CEFR source review (2026-11-16)

**Scope:** exactly 20 new entries in 5 existing topics introduced in the merged Batch 1 content PR. This is a **source-checked proposal**, NOT a classroom experiment or an independent human bilingual approval. No Production database, SRS, player progress, approved content, CEFR game flags, or runtime API has been changed.

## Rules for interpreting levels

- Cambridge explains that A1–C2 labels apply to a particular **word, phrase or meaning**, not the entire word in every context: https://dictionary.cambridge.org/help.htm
- Oxford clarifies that CEFR itself grades **language competence**; its word- and phrase-level mappings are instructional guidance: https://www.oxfordlearnersdictionaries.com/about/wordlists/cefr
- **14 exact-sense dictionary labels**: the Cambridge entry explicitly labels the matching sense.
- **3 collocations under labeled senses**: the Cambridge entry labels the component sense and provides the compound use in an example or explanation; the entire expression may not carry a separate label.
- **3 contextual inferences**: there is **no explicit sense-level A1–C2 label** in the consulted entry. A best-effort placement is recorded, backed by learning materials or a topic tag, and MUST NOT be presented as a certified lexical CEFR designation.

## Proposed level distribution

**A1**: `wash dishes`, `take a shower`, `vegetable`, `cheese`, `sandwich`, `dictionary`

**A2**: `get dressed`, `noodles`, `textbook`, `classmate`, `timetable`, `luggage`, `battery`

**B1**: `set the table`, `boarding pass`, `destination`, `departure`

**B2**: `charger`, `browser`, `attachment`

## Source-by-source review table

| Topic | Word / phrase | Proposed CEFR | Evidence type | Sources |
|---|---|---:|---|---|
| Daily Life | `wash dishes` | **A1** | `collocation_in_labeled_sense` | [Source](https://dictionary.cambridge.org/dictionary/learner-english/wash) |
| Daily Life | `get dressed` | **A2** | `collocation_in_labeled_sense` | [Source](https://dictionary.cambridge.org/dictionary/essential-british-english/dress) |
| Daily Life | `take a shower` | **A1** | `collocation_in_labeled_sense` | [Source](https://dictionary.cambridge.org/dictionary/learner-english/shower) |
| Daily Life | `set the table` | **B1** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/set-the-table) |
| Food | `vegetable` | **A1** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/vegetable) |
| Food | `cheese` | **A1** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/learner-english/cheese) |
| Food | `sandwich` | **A1** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/sandwich) |
| Food | `noodles` | **A2** | `contextual_inference` | [Source](https://dictionary.cambridge.org/dictionary/english/noodle) · [Context](https://www.pearsoncanadaschool.com/content/dam/websites/pearson-canada-school/assets/documents/literacy/nik/NIK-ScopeAndSequence-L4.pdf) |
| School - Trường học | `textbook` | **A2** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/textbook) |
| School - Trường học | `dictionary` | **A1** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/dictionary) |
| School - Trường học | `classmate` | **A2** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/classmate) |
| School - Trường học | `timetable` | **A2** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/timetable) |
| Travel - Du lịch | `boarding pass` | **B1** | `contextual_inference` | [Source](https://www.cambridgeenglish.org/vn/Images/506887-b1-preliminary-vocabulary-list.pdf) · [Context](https://dictionary.cambridge.org/dictionary/english/boarding-pass) |
| Travel - Du lịch | `luggage` | **A2** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/luggage) |
| Travel - Du lịch | `destination` | **B1** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/destination) |
| Travel - Du lịch | `departure` | **B1** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/departure) |
| Technology - Công nghệ | `charger` | **B2** | `contextual_inference` | [Source](https://www.oxfordlearnersdictionaries.com/definition/english/charger) · [Context](https://dictionary.cambridge.org/dictionary/english/charger) |
| Technology - Công nghệ | `battery` | **A2** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/battery) |
| Technology - Công nghệ | `browser` | **B2** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/browser) |
| Technology - Công nghệ | `attachment` | **B2** | `exact_sense_label` | [Source](https://dictionary.cambridge.org/dictionary/english/attachment) |

The structured record of the evidence is `vocab/batch1-cefr-evidence.json` (20 unique records, exact source URL, sense/POS, dated reason, evidence type and explicit-vs-inferred distinction).

## Specific exceptions — human adjudication needed

1. **noodles → A2 (contextual inference):** Cambridge describes the food noun but shows no CEFR label. Pearson's A2+/B1 learning sequence includes noodles. Oxford's Food topic carries a `b2` topic tag, which is **not proof of a CEFR label for this exact word and sense**. These pedagogical signals are not fully consistent; A2 here is a deliberate *local teaching placement*, not an official Cambridge level.
2. **boarding pass → B1 (curriculum-list inference):** the official Cambridge English B1 Preliminary vocabulary list includes `boarding pass`. Its presence indicates a B1 exam preparation syllabus, not that the individual phrase cannot be encountered below B1. Cambridge Dictionary's standalone definition has no level.
3. **charger → B2 (topic-tag inference):** Oxford Advanced Learner's Dictionary includes it under Physics and chemistry `b2`, while Cambridge's phone charger noun has no explicit CEFR label. That Oxford topic tag must not be mistaken for an official individual sense-level CEFR assertion.

## Integration and safety

`vocab/cefr-review-all-topics.json` now consists of **260 untouched original seed records `UNREVIEWED` and 137 `PROVISIONAL` records**, the latter including these 20 sourced proposals and 117 pre-existing drafts, total 397. All 20 have a proposed `level`, evidence `source_url`, `source_type`, `cefr_evidence_kind`, `cefr_source_label` and `verification_scope`; **none are `APPROVED`** or assigned `reviewed_by` / `reviewed_at`.

The 5-field `db/seed-vocabulary.json` remains unchanged because that format does not carry CEFR metadata. This PR does not alter user-facing grading or apply migrations. The existing importer is dry-run-only by default, and has zero `APPROVED` rows to import from this source queue.

Human reviewers still need to verify the exact Vietnamese sense, IPA/UK-US variants, usage/examples and potential multiple valid recall answers, and sign records with authorization and source metadata before a separate release decision. New levels are useful for editorial sorting but do not bypass CEFR-approved game eligibility.

## QA acceptance

- CI `npm run check`, `npm test` and isolated PostgreSQL17 + Chromium/Firefox SRS browser suite green.
- `tests/vocab-cefr-batch1-evidence.test.js`: 20/20 exact mapping, all 3 contextual inferences explicitly distinguished, source URLs validated syntactically, no changes to 260 original rows or 117 legacy drafts, importer dry-run shows `approved: 0`.
- No Vercel deployment or Production ingestion from this PR.

**Next step:** independent bilingual reviewer sign-off, plus QA-S1 ambiguity audit and isolated import smoke. **Never silently switch to `APPROVED` or deploy.**
