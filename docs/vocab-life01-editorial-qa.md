# LIFE-01 — Daily living vocabulary (100 candidates)

**Status: offline editorial DRAFT only.** This PR is **stacked on PR #85**, the LIFE-1000 foundation. Merge PR #85 first. Do not merge this PR before the foundation is approved and its complete exact-SHA CI is green.

## Scope and provenance

100 *new* English headwords, grouped into four sets of 25, chosen against the repository's 280-word public seed and 117 pre-existing provisional CEFR draft items. There are **zero exact English duplicates** across those baselines, no duplicate literal Vietnamese cues among this batch or across those baselines, and zero added database topics. This is a **repository draft**, not a live Production catalogue update. The Production vocabulary count is independently stored and must be checked again before any later import.

| Editorial group | Count | Example candidate headwords |
|---|---:|---|
| Buổi sáng và thức dậy | 25 | alarm, clock, breakfast, cereal, toast, butter, jam, early, ... |
| Vệ sinh và chăm sóc cá nhân | 25 | soap, shampoo, toothpaste, toothbrush, towel, mirror, brush, comb, ... |
| Công việc nhà | 25 | laundry, detergent, dishwasher, vacuum, broom, mop, bucket, rubbish, ... |
| Buổi tối và cuối tuần | 25 | relax, rest, nap, supper, dessert, snack, movie, series, ... |

Every item contains `english`, `ipa`, Vietnamese `meaning`, an original English example and Vietnamese translation, `part_of_speech`, proposed `level`, `source_url`, and `cefr_evidence_kind` with notes. The IPA, Vietnamese nuances and original example text have **not been signed off by independent bilingual editors** and require final review.

## CEFR reference method — avoid overstating certainty

- **51 `headword_pos_label`**: the University of Oxford's **Oxford 3000** CEFR table explicitly associates the headword and part of speech with the recorded level. Its headword/POS tag is **not automatically an endorsement of every meaning or translated phrase**.
  Primary official reference: https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
- **19 `exact_sense_label`**: Cambridge Dictionary has an explicit CEFR label on the matching practical sense (e.g., `cereal` breakfast food A2, `toast` bread A2, `toothpaste` B1, `toothbrush` A2, `laundry` dirty clothes B2, `deodorant` C1). Each record points to its entry.
  Cambridge CEFR meaning explanation: https://dictionary.cambridge.org/help.htm
- **30 `contextual_inference`**: the suggested CEFR level is an *editorial hypothesis*. The URL points to a dictionary headword definition, **not verified evidence of a matching CEFR marker**. Each record has `cefr_source_label=null`. These 30 items need further source-by-source academic review, possibly a new level, or a different candidate term.
- **No lexical item has a reviewer signoff.** All 100 remain `PROVISIONAL`, and the batch remains `DRAFT` with no path to automatically mark `APPROVED`.

Oxford states that CEFR is an assessment of language ability; graded wordlists are a learning aid, not a rigid claim that all senses must be known at a certain level:
https://www.oxfordlearnersdictionaries.com/about/wordlists/cefr

### Observed proposed distribution (not a required target)

| A1 | A2 | B1 | B2 | C1 | Total |
|---:|---:|---:|---:|---:|---:|
| 23 | 36 | 33 | 7 | 1 | 100 |

**Important exceptions:** `deodorant` is **C1** for the checked Cambridge sense. The LIFE-1000 roadmap's A1–B2 editorial distribution is aspirational, so we do **not** mislabel this item merely to satisfy that target. `face` is marked B1 according to Oxford's headword/POS table even though learner resources sometimes differ. `oven` is B1 for the selected Cambridge cooking sense; Oxford's broad noun list differs. Keep both variations for review, never overwrite prior trusted CEFR metadata.

## Review and release boundaries

1. Validate full 100 words / four 25-word groups via `npm run vocab:plan` and `node scripts/qa-vocab-life1000.mjs --file=vocab/batches/LIFE-01.json`.
2. Run unit + isolated PostgreSQL17 and Chromium/Firefox/SRS browser CI for the exact PR head. No real account data, database mutations or Vercel build in this PR.
3. Review IPA, selected English POS/sense, Vietnamese translation, UK/US distinctions, answer ambiguity and example quality. Recheck the 30 unverified CEFR hypotheses; optionally replace difficult or poorly sourced words in another PR.
4. Only then prepare a **separate** Preview-only importer/content review workflow, ensuring topics, game-round eligibility and existing word UUID/history remain safe. Backup, approval and a rehearsed rollback are prerequisites to Production.
5. A GitHub merge alone **never increases the Production database word count**.

## 100-item review inventory

The table below is an inventory of the draft's claimed level/evidence type, **not an APPROVED bibliography**. Consult each entry's `source_url` and `source_note` in the JSON before validation.

| # | Group | English | Proposed CEFR | Evidence |
|---:|---|---|---|---|
| 001 | morning | alarm | B1 | headword_pos_label |
| 002 | morning | clock | A1 | headword_pos_label |
| 003 | morning | breakfast | A1 | headword_pos_label |
| 004 | morning | cereal | A2 | exact_sense_label |
| 005 | morning | toast | A2 | exact_sense_label |
| 006 | morning | butter | A1 | headword_pos_label |
| 007 | morning | jam | A2 | headword_pos_label |
| 008 | morning | early | A1 | headword_pos_label |
| 009 | morning | late | A1 | headword_pos_label |
| 010 | morning | minute | A1 | headword_pos_label |
| 011 | morning | hour | A1 | headword_pos_label |
| 012 | morning | routine | A1 | headword_pos_label |
| 013 | morning | habit | A2 | headword_pos_label |
| 014 | morning | schedule | A2 | headword_pos_label |
| 015 | morning | ready | A1 | headword_pos_label |
| 016 | morning | pack | A2 | headword_pos_label |
| 017 | morning | rush | B2 | headword_pos_label |
| 018 | morning | quiet | A1 | headword_pos_label |
| 019 | morning | daily | A2 | headword_pos_label |
| 020 | morning | curtain | B1 | headword_pos_label |
| 021 | morning | fresh | A2 | headword_pos_label |
| 022 | morning | pillow | A2 | exact_sense_label |
| 023 | morning | blanket | A2 | exact_sense_label |
| 024 | morning | light | A1 | contextual_inference |
| 025 | morning | rise | A2 | headword_pos_label |
| 026 | personal-care | soap | A2 | headword_pos_label |
| 027 | personal-care | shampoo | A2 | exact_sense_label |
| 028 | personal-care | toothpaste | B1 | exact_sense_label |
| 029 | personal-care | toothbrush | A2 | exact_sense_label |
| 030 | personal-care | towel | A2 | headword_pos_label |
| 031 | personal-care | mirror | A2 | headword_pos_label |
| 032 | personal-care | brush | A2 | headword_pos_label |
| 033 | personal-care | comb | A2 | exact_sense_label |
| 034 | personal-care | razor | B2 | exact_sense_label |
| 035 | personal-care | deodorant | C1 | exact_sense_label |
| 036 | personal-care | lotion | B1 | contextual_inference |
| 037 | personal-care | sink | A2 | contextual_inference |
| 038 | personal-care | tap | B1 | exact_sense_label |
| 039 | personal-care | tissue | B1 | exact_sense_label |
| 040 | personal-care | nail | B1 | headword_pos_label |
| 041 | personal-care | skin | A2 | headword_pos_label |
| 042 | personal-care | hair | A1 | headword_pos_label |
| 043 | personal-care | face | B1 | headword_pos_label |
| 044 | personal-care | tooth | A1 | headword_pos_label |
| 045 | personal-care | clean | A1 | headword_pos_label |
| 046 | personal-care | dry | A2 | headword_pos_label |
| 047 | personal-care | wet | A2 | contextual_inference |
| 048 | personal-care | shave | B1 | exact_sense_label |
| 049 | personal-care | rinse | B1 | contextual_inference |
| 050 | personal-care | perfume | B1 | contextual_inference |
| 051 | household | laundry | B2 | exact_sense_label |
| 052 | household | detergent | B2 | contextual_inference |
| 053 | household | dishwasher | B1 | exact_sense_label |
| 054 | household | vacuum | B1 | contextual_inference |
| 055 | household | broom | B1 | contextual_inference |
| 056 | household | mop | B1 | contextual_inference |
| 057 | household | bucket | B1 | exact_sense_label |
| 058 | household | rubbish | A2 | headword_pos_label |
| 059 | household | trash | A2 | contextual_inference |
| 060 | household | bin | A2 | headword_pos_label |
| 061 | household | dust | B1 | headword_pos_label |
| 062 | household | floor | A1 | headword_pos_label |
| 063 | household | shelf | B1 | headword_pos_label |
| 064 | household | drawer | B1 | contextual_inference |
| 065 | household | cupboard | A2 | headword_pos_label |
| 066 | household | fridge | A2 | headword_pos_label |
| 067 | household | freezer | B1 | exact_sense_label |
| 068 | household | microwave | B1 | contextual_inference |
| 069 | household | oven | B1 | exact_sense_label |
| 070 | household | stove | A2 | exact_sense_label |
| 071 | household | plug | B1 | contextual_inference |
| 072 | household | socket | B2 | contextual_inference |
| 073 | household | switch | B1 | contextual_inference |
| 074 | household | polish | B2 | contextual_inference |
| 075 | household | tidy | B1 | contextual_inference |
| 076 | evening | relax | A1 | headword_pos_label |
| 077 | evening | rest | A2 | headword_pos_label |
| 078 | evening | nap | B1 | contextual_inference |
| 079 | evening | supper | B1 | contextual_inference |
| 080 | evening | dessert | A2 | contextual_inference |
| 081 | evening | snack | A2 | contextual_inference |
| 082 | evening | movie | A1 | headword_pos_label |
| 083 | evening | series | A2 | headword_pos_label |
| 084 | evening | episode | B1 | headword_pos_label |
| 085 | evening | television | A1 | headword_pos_label |
| 086 | evening | radio | A1 | headword_pos_label |
| 087 | evening | hobby | A1 | headword_pos_label |
| 088 | evening | visit | A1 | headword_pos_label |
| 089 | evening | celebrate | A2 | headword_pos_label |
| 090 | evening | guest | A2 | headword_pos_label |
| 091 | evening | picnic | A2 | contextual_inference |
| 092 | evening | barbecue | B1 | contextual_inference |
| 093 | evening | hike | B1 | contextual_inference |
| 094 | evening | stroll | B2 | contextual_inference |
| 095 | evening | garden | A1 | headword_pos_label |
| 096 | evening | balcony | B1 | contextual_inference |
| 097 | evening | party | A1 | headword_pos_label |
| 098 | evening | puzzle | B1 | contextual_inference |
| 099 | evening | candle | B1 | contextual_inference |
| 100 | evening | chat | A2 | contextual_inference |
