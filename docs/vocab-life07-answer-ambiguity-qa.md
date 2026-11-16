# LIFE-07 — Alternative-answer ambiguity triage

This stage-5 audit scans all **100 bilingual editorial candidates** for contextual answer ambiguity and medical-language risk. It does **not** define accepted gameplay answers.

| Priority | Count | Meaning |
|---|---:|---|
| HIGH | 12 | Medication/symptom safety, particularly ambiguous medical expressions |
| MEDIUM | 38 | Likely equivalent natural English learner answers requiring adjudication |
| LOW | 50 | No specific alternative nominated, still requires review |
| **Total** | **100** | All pending bilingual editorial review |

**43 expressions** have one or more *proposed* alternate ways of saying the same idea. These are **not** approved acceptable answers and must not be fed to existing MATCH/BOMB/CAR strict-grading logic.

## Priority sample

| Main expression | Alternative(s) to check | Editorial issue |
|---|---|---|
| have a blocked nose | have a stuffy nose; have a congested nose | Regional phrasing and equivalence |
| feel nauseous | feel sick; feel queasy | Register and possible broader meanings of sick |
| have a chesty cough | have a productive cough | Medical language versus everyday usage |
| ask about side effects | enquire about side effects | Medical C1 headword vs B1 whole-phrase estimate, plus UK register |
| check the expiry date | check the expiration date | British versus American spelling/usage |
| pick up a prescription | collect a prescription | Collect medicine versus collect a paper prescription |
| feel short of breath | have difficulty breathing; feel breathless | Safety-sensitive symptom and semantic severity |
| feel homesick | miss home | Broad emotional sense versus exact headword sense |

## Safe workflow

1. Have a bilingual reviewer decide whether each proposed alternative is equivalent **within the Vietnamese cue and example context**, and reject variants with mismatched meaning.
2. Record approved alternatives in a **separate reviewed artifact** with explicit reviewer evidence. This pending review file keeps `accepted_answers_approved=[]` and `grading_mode=NOT_AUTHORIZED` for every item.
3. Do not modify game scoring, SRS, account vocabulary, live PostgreSQL, or Production from this report.
4. Run `node scripts/qa-life07-answer-ambiguity.mjs`, `node scripts/qa-life07-unified.mjs`, plus the existing test suites on the PR's exact head.
5. Continue remaining CEFR/IPA source work and create a complete `vocab/batches/LIFE-07.json` only after required editorial reviews.

No human reviewer signoff, certified phrase-level CEFR, full-phrase IPA, or release approval is claimed.
