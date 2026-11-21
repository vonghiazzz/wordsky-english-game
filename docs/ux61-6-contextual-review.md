# UX61.6 — Contextual sense review (pending editorial approval)

**Status:** `PENDING_HUMAN_REVIEW` — not a vocabulary migration or CEFR approval.

**Evidence:** Read-only GET `https://wordsky-english-game.vercel.app/api/learning/vocabulary` on 2026-11-21, production shared catalog 2,099 cards. The six cards below still have ambiguous Vietnamese recall cues. The references below reproduce *existing WordSky examples*, not replacement example sentences. Source vocabulary remains the source of truth; recheck live IDs before any edit.

| English | Topic | Existing Vietnamese cue | Existing WordSky example | Candidate editorial direction — NOT APPROVED |
| --- | --- | --- | --- | --- |
| five | Numbers - Số đếm | Năm | She has five books. | For the number sense, consider `số đếm 5` |
| year | Time & Dates - Thời gian | Năm | I learn English this year. | For the time-unit sense, consider `một năm (đơn vị thời gian)` |
| assess | School - Trường học | đánh giá | The teacher will assess our progress. | Assess learning/progress; overlapping synonym `evaluate` makes a single-Vietnamese-cue quiz unsafe |
| evaluate | School - Trường học | đánh giá | We must evaluate the results carefully. | Evaluate outcomes/results; `assess` can also fit this sense; do not assert uniqueness from this sentence alone |
| significant | Adjectives - Tính từ | đáng kể | There was a significant improvement. | Significant can emphasize noticeable or important change; this example overlaps `substantial` |
| substantial | Adjectives - Tính từ | đáng kể | The team made substantial progress. | Substantial can emphasize amount/size; this example overlaps `significant` |

**Existing two-topic word:** `habitat` appears separately under Animals and Nature, with different Vietnamese wording; this is **not** one of the six cue-collision cards. Preserve the cards and existing progress.

## Evidence to consider (dictionary references)

- `five`: https://dictionary.cambridge.org/dictionary/english/five
- `year`: https://dictionary.cambridge.org/dictionary/english/year
- `assess`: https://dictionary.cambridge.org/dictionary/english/assess
- `evaluate`: https://dictionary.cambridge.org/dictionary/english/evaluate
- `significant`: https://dictionary.cambridge.org/dictionary/english/significant
- `substantial`: https://dictionary.cambridge.org/dictionary/english/substantial

## Release contract

1. Keep all six `isPendingEditorialRecall` holds enabled until an editor reviews **each** sense and approves a quiz prompt, example and accepted-answer contract. Showing an original sentence for reference is **not** approval to grade its translation as unique.
2. The UX61.6 reference panel is **collapsed**, visible only after the account is reverified, and displays vocabulary using DOM `textContent`. It never makes a new review request, modifies SRS scheduling, edits CEFR or mutates shared vocabulary.
3. Use original English examples only as read-only study material. Do not use these English examples as answer-bearing *question* hints during a spelling quiz. For `assess/evaluate` and `significant/substantial`, define a fair accepted-answer policy or ensure a truly distinguishing context before removing a hold.
4. A reviewer must record `reviewed_by`, a real approval timestamp, a justified contextual cue and exact production IDs in an approved migration packet. Verify deployed preview/browser QA and production rollback plan *before* importing edited content. This document records **no** such approval.
5. Keep existing V1/V2/V3, per-account progress and historical SRS review rows untouched. If editorial signoff is unavailable, leave the hold and the read-only reference panel in place.

**Next evidence needed:** editor decisions for all six senses, evidence-based contextual prompts, and a separate, gated vocabulary-change PR. No automatic production content update is authorized by this document.
