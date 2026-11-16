# LIFE-07 — high-risk semantic and answer review (12 entries)

All 12 previously flagged HIGH items now have **explicit sense boundaries, proposed equivalent phrasings and examples that should not be treated as equivalent**. The source-of-truth review queue is `vocab/editorial/LIFE-07-high-risk-review-decisions.json`.

**Not a release or human review:** These are editorial *proposals* only. `approved_accepted_answers=[]`, `reviewer_signed_off=false` and `gameplay_approved=false` for all 12. No scoring rule should consume this file.

## Review decisions that must be adjudicated

| Entry | Distinction / risk |
|---|---|
| feel nauseous | *feel sick* can be broader than nausea; editor must judge context |
| have a migraine | migraine is not interchangeable with any severe headache |
| have a splitting headache | severe headache does not necessarily mean migraine |
| pick up a prescription | picking up medicine versus collecting a paper prescription must be clarified |
| feel short of breath | difficulty breathing must not be equated with general exhaustion |
| take medicine with food | wording must not become universal medical advice |
| take medicine on an empty stomach | likewise only describe label-specific instructions |
| mention a drug allergy | medication allergy must be distinguished from a side effect |
| request a medical certificate | a *sick note* is not always the same document across countries |
| ask about side effects | B1 phrase estimate versus C1 medical component: unresolved |
| break out in a rash | B2 phrase estimate versus C2 medical component: unresolved |
| follow the dosage instructions | describe adherence without inventing specific dosing advice |

For every item a reviewer must check whether proposed alternative phrasing matches the **Vietnamese cue, sample sentence, and intended sense**. Do not blanket-approve synonyms. Preserve British/American variants where truly equivalent; never treat the exclusion examples as globally forbidden words — the exclusions are context-specific.

## Offline gate

```sh
node scripts/qa-life07-high-risk.mjs
node scripts/qa-life07-answer-ambiguity.mjs
node scripts/qa-life07-unified.mjs
```

No Node/CI success or Production interaction is claimed by creation of these files. Later test results must be tied to an exact GitHub commit SHA. The next workflow should stop accumulating parallel audit files and instead finish full-expression IPA/source review and the controlled 15-field LIFE-07 candidate batch.
