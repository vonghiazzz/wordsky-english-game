# UX56 — Production shared vocabulary quality inventory

> Observation snapshot: 2026-11-19 (Asia/Ho_Chi_Minh). Read-only queries against WordSky Production PostgreSQL plus public catalog. Not a lexical/CEFR approval, editing request, or release permission.

## Inventory observed

| Category | Count |
| --- | ---: |
| Enabled public vocabulary | 2,099 |
| Enabled topics | 30 |
| `APPROVED` | 365 |
| `PROVISIONAL` | 1,734 |
| Empty English | 0 |
| Empty Vietnamese meaning | 0 |
| Empty example | 0 |
| Empty example translation | 0 |
| Empty IPA | 1,105 |
| Exact normalized English duplicate groups | 1 |
| Same normalized Vietnamese cue with different English answers | 3 |
| Missing/invalid CEFR label (outside A1-C2) | 0 |

### Collision candidates (requires review)

- `habitat` twice: **Animals - Động vật**, **Nature - Thiên nhiên**. Same headword in different topics may be intentional; inspect whether senses/examples differ and prevent unintentional duplicated practice cards.
- `đáng kể`: **significant**, **substantial** — both Adjectives. May be legitimate synonyms; single-correct-answer recall needs explicit disambiguating context.
- `đánh giá`: **assess**, **evaluate** — School. Context or accepted-answer policy required; never accept synonym variants automatically.
- `năm`: **five**, **year** — Numbers versus Time & Dates. Needs a clearer cue, otherwise a single-answer prompt is ambiguous.

### IPA completeness by level/review state

| Level | Status | Items | Missing IPA |
| --- | --- | ---: | ---: |
| A1 | APPROVED | 206 | 0 |
| A1 | PROVISIONAL | 91 | 0 |
| A2 | APPROVED | 47 | 1 |
| A2 | PROVISIONAL | 1,039 | 742 |
| B1 | APPROVED | 22 | 14 |
| B1 | PROVISIONAL | 524 | 258 |
| B2 | APPROVED | 21 | 21 |
| B2 | PROVISIONAL | 74 | 0 |
| C1 | APPROVED | 43 | 43 |
| C1 | PROVISIONAL | 3 | 0 |
| C2 | APPROVED | 26 | 26 |
| C2 | PROVISIONAL | 3 | 0 |

A blank IPA indicates unavailable pronunciation metadata, **not** a wrong word or proof of an invalid CEFR judgment. Do not synthesize IPA without pronunciation source review.

## What the tooling does

- `scripts/ux56-public-vocabulary-quality-audit.mjs`: anonymous HTTPS GET from the fixed public production catalog; checks schema, missing optional fields and lexical collision candidates, leveraging existing `lib/qa-s1a-recall-cue-audit.js`.
- `.github/workflows/ux55-public-production-get-smoke.yml`: runs the UX56 read-only check after the UX55 GET smoke on PR and manual dispatch. Produces only public word/topic names and counts. No admin tokens, Supabase credentials, personal cards, auth sessions, request bodies or POST operations.
- The public catalog **does not expose** CEFR approval metadata by design; the status counts above were retrieved by authorized **read-only SQL**. The public audit cannot infer approvals.

## Research/engineering next actions

1. Prioritize **duplicate and ambiguous cues** by assessing exact word/sense/topic/example, quiz direction and user-facing question text. Record a reviewer decision for each affected word **before** grading/prompt changes.
2. Track IPA availability as a separate editorial field. Prioritize pronunciation for approved vocabulary that is missing IPA, then provisional batches. TTS fallback must be labeled and should not be mistaken for phonetic certification.
3. Audit the 1,734 PROVISIONAL items in small, source-verifiable batches (e.g. 50–100), with a sense/POS/IPA/translation evidence ledger and explicit human review. No blanket CEFR certification.
4. Before changing live content, rerun catalog comparison, confirm current audit IDs and account/SRS references; propose a targeted, reversible, separately approved DB operation. **Never update/delete live users or reset learning histories.**

### Status limitations

The numbers are a one-time database snapshot; later releases may change them. A matching exact Vietnamese cue may be valid in a dictionary, but could be ambiguous in forced single-answer recall. The GitHub public GET report is lexical-only and cannot replace academic editorial QA or authenticated browser acceptance.
