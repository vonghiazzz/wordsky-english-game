# UX57 — Ambiguous English/Vietnamese cue review

Snapshot: **2026-11-19**, read-only Production `ws_words` joined to `ws_topics`; eight **public/shared** vocabulary cards only, no learner UUIDs, accounts or progress. See `tests/fixtures/ux57-public-cue-review.json` for the exact publicly displayable word, topic, meaning, CEFR and example evidence. **All eight rows currently say APPROVED**, but that status does not resolve ambiguous one-answer learning prompts.

## Observations and decisions

| Group | Records | Current issue | Safe editorial action to consider |
| --- | --- | --- | --- |
| Same Vietnamese cue | `five` / `year` — both `Năm` | English typing from the bare cue `năm` has two context-dependent answers | Distinguish `số năm (5)` from `một năm (đơn vị thời gian)` only after reviewer approves wording, then update prompts/meaning with an audited reversible change |
| Same Vietnamese cue | `assess` / `evaluate` — both `đánh giá` | Two valid verbs in different contexts; exact-match grading currently rejects the alternate | Evaluate adding a short school/analysis context in the question; **never** silently accept a synonym or award SRS credit |
| Same Vietnamese cue | `significant` / `substantial` — both `đáng kể` | Similar translation, overlapping contexts | Check adjective usage examples and specify cues without claiming that one translation is inherently wrong |
| Same English | `habitat` twice, Animals and Nature | Two topic cards with overlapping but distinct meanings/examples | Preserve both records and UUIDs pending review of intended per-topic usage and learning history; do **not** delete/dedupe automatically |

All records have public examples; the example sentences help a human reviewer but **do not** automatically prove the user-facing quiz currently displays disambiguating context.

## Engineering impact verified in code

- `public/ux28-practice-core.js` `gradeRecall()` compares normalized English input against one expected English answer. It does not accept synonyms automatically. UX57 tests deliberately preserve this behavior and do not mutate SRS.
- `lib/game.js` MATCH/MATRIX pairs use server-side IDs. Thus overlapping Vietnamese labels need UX inspection for confusing choices, but different IDs remain distinct; a lexical report alone is not evidence of an incorrect server scoring rule.
- BOMB/CAR full-word typing uses selected/current expected English terms. When shown only a duplicate Vietnamese cue, a player may be unable to infer which of two accepted terms the server expects. Review each mode's rendered prompt before changing accepted answers or gameplay.
- Existing `lib/qa-s1a-recall-cue-audit.js` is a **read-only lexical flagger**, not an editorial approval system.

## Review gates before any production correction

1. Bilingual reviewer checks meanings, POS, example context, target CEFR **sense**, and official/credible dictionary evidence for each affected entry.
2. Decide whether a **question-presentation** change (mode-specific contextual cue) is safer than editing shared word meanings. A change to shared `ws_words.meaning` affects more than flashcards.
3. Run isolated browser QA for My Learning typed recall and MATCH/BOMB/MATRIX/MEMORY/CAR with duplicate-cue fixtures. Verify no accidental mastery, wrongful "wrong word" history or silent accepted-answer expansion.
4. Check live row IDs, audit provenance, active games and whether user SRS history references those exact IDs. Obtain separate approval for any database write, and prepare a reversible targeted patch preserving UUIDs/history.
5. Retest public production GET health and signed-in test-account behavior before declaring a release.

### What this PR intentionally does **not** do

No vocabulary INSERT/UPDATE/DELETE, no CEFR reclassification, no auto-synonym lists, no gameplay/SRS change, no Vercel redeployment. It packages a repeatable **eight-row review fixture + five regression tests** so the subsequent editorial and engineering change can be evidence-driven.
