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

Then test Chromium and Firefox gameplay, account sync and SRS on the **exact final PR HEAD** with an isolated PostgreSQL database. GitHub Actions #159 on the earlier SHA `c10760854` finished SUCCESS with 622/622 unit/PostgreSQL tests and browser/SRS acceptance. A subsequent workflow on `d442a3b4` finished SUCCESS with 627/627 tests and browser E2E. **New edits must rerun on their own exact SHA; past results do not certify the edited commit.**

## Merge and release boundaries

PR #96 is stacked on #95 → #92 → #91, and target `main` is used to surface standard CI. Merge dependencies first, narrow and re-review final PR diff. The JSON draft does **not** approve CEFR, activate topics, change SRS, enable game answers, import PostgreSQL vocabulary or deploy Vercel. A later independent bilingual review, Production catalog reconciliation and explicit release approval are mandatory.

## Editorial correction pass — 2026-11-16

The candidate and all matching editorial stages were reconciled for eight expressions. Six Vietnamese teaching cues are more natural/less ambiguous:

| English | Revised Vietnamese cue | Rationale |
|---|---|---|
| break out in a rash | Bắt đầu nổi phát ban | Preserve the onset meaning of *break out* |
| have muscle cramps | Bị chuột rút | Remove the redundant `cơ` in everyday Vietnamese |
| show a prescription | Xuất trình đơn thuốc | More precise patient/pharmacy action |
| make a doctor's appointment | Đặt lịch hẹn với bác sĩ | Natural Vietnamese appointment phrase |
| take a day to recharge | Dành một ngày nghỉ ngơi để lấy lại năng lượng | *Recharge* here means regain energy, not recover from an injury |
| feel at ease | Cảm thấy thoải mái, yên tâm | Preserve calm/comfortable meaning |

Three pharmacy/doctor examples and translations were edited for clearer context: `show a prescription`, `pick up a prescription`, `mention a drug allergy`. These are **editorial changes only**, not reviewer approvals or gameplay accepted-answer updates.

### Dictionary sense and IPA checks — scoped carefully

- [Cambridge: recharge](https://dictionary.cambridge.org/dictionary/english/recharge): **C1 battery-related sense**, but **C2 rest/relax/regain energy sense**. WordSky currently estimates **B1 for the entire phrase** `take a day to recharge`. This B1/C2 discrepancy is **PENDING editorial decision**, not certified phrase-level C2. The candidate now links to the actual Cambridge sense entry, with its UK headword component transcribed as `/ˌriːˈtʃɑːdʒ/`.
- [Cambridge: medicine](https://dictionary.cambridge.org/pronunciation/english/medicine) gives two UK variants, `/ˈmed.ɪ.sən/` and `/ˈmed.sən/`. Draft medicine entries use the latter variant; do not incorrectly reject it.
- [Cambridge: migraine](https://dictionary.cambridge.org/pronunciation/english/migraine) gives UK `/ˈmiː.ɡreɪn/` and `/ˈmaɪ.ɡreɪn/`. The draft uses a valid component variant; full-expression IPA is still not certified.
- [Cambridge: sore throat](https://dictionary.cambridge.org/pronunciation/english/sore-throat) has UK collocation `/ˌsɔː ˈθrəʊt/`. The component aligns with the draft.
- [Cambridge: thoroughly](https://dictionary.cambridge.org/pronunciation/english/thoroughly) UK `/ˈθʌr.ə.li/` aligns with the draft token in `wash your hands thoroughly`.
- [Cambridge: prescription](https://dictionary.cambridge.org/dictionary/english/prescription) is **B1 in its medical-document noun sense**. The English `pick up a prescription` may be interpreted as collecting medicine in context, but must **not** be auto-accepted as retrieving any paper prescription.
- [Cambridge: medical certificate](https://dictionary.cambridge.org/dictionary/english/medical-certificate) can attest fitness **or unfitness** for work; do not auto-equate `medical certificate` with `sick note` globally.

**Release safety remains unchanged:** 100 PROVISIONAL records; no human signoff, no authorized full-expression CEFR, no imported vocabulary, no Production writes. This review verifies *specific components or definitions* only; there is still **no full-expression IPA certification**.
