# WordSky shared vocabulary imports — historical audit ledger (2026-11-17)

> **Historical evidence only; no SQL or API mutations.** Reconstructed from the post-import record in old PR #100. The counts below were observed at that time, **not re-verified against today's live database**. This document does not approve draft CEFR senses or authorize reimport. Prefer current public API/database/audit evidence for live state.

## Reported additive release timeline

| Source | Audit ID | Enabled shared words after | Enabled topics after | New words | Editorial status of new words |
|---|---:|---:|---:|---:|---|
| Original baseline | — | 365 | 26 | — | 365 APPROVED |
| LIFE-01 | 469 | 465 | 26 | +100 | PROVISIONAL |
| LIFE-02..07 | 470 | 1,064 | 30 | +599 | PROVISIONAL |
| Extra legacy candidate release | 471 | 1,099 | 30 | +35 | PROVISIONAL |

The original LIFE-02..07 batch files proposed 600 entries; one English duplicate (`itinerary`) was skipped. The legacy candidate release re-used previously existing rows and excluded a conflicting Vietnamese cue. Recorded totals: **365 APPROVED + 734 PROVISIONAL**, 30 active topics. These values should be confirmed again before any later release.

### Imported batch provenance reported in PR #100

| Batch | Source Git blob | Newly inserted |
|---|---|---:|
| LIFE-01 | `1c2dc5febb15688c4155ce8cb2eb923f0baa78e8` | 100 |
| LIFE-02 | `32079414551a733ea8af7104f06f79d6ee67d96f` | 100 |
| LIFE-03 | `ea4786fa91ee47a241b4bd4b45adc6a33bac8118` | 100 |
| LIFE-04 | `f650d8a2d02b68f6101c91e5da053c3d068b132d` | 100 |
| LIFE-05 | `a20594c8f7afeb67a66fdc6b60cf87968df9d98a` | 100 |
| LIFE-06 | `dcce483c4ae9a68be96758bb123447547199572c` | 99 |
| LIFE-07 | `7cc16fe73dc64740d52a032910c03acb7c56c90a` | 100 |
| Extra legacy provisional | `4a1b5b9f81110d016776e48bfb8e2ca5c8aa0bce` | 35 |

Four topics were reported as created and enabled with audit #470: **Everyday Conversation**, **Social Relationships**, **Cooking & Kitchen**, and **Money & Payments**. Do not execute older inactive-topic registration PRs #93/#94 against a production database where those topics already exist.

## Read-only re-verification protocol

1. Check production catalog only via anonymous GET endpoints `/api/topics` and `/api/learning/vocabulary`, and compare counts with **current** database snapshot. HTTP GET availability alone does not prove database health or editorial approval.
2. Via authorized **read-only** SQL, inspect `ws_audit` rows 469, 470, 471 and verify their source blob IDs, before/after counts, recorded UUIDs, and matching current words. Do not paste audit JSON with user identifiers into tickets or CI logs.
3. Check how many words currently have `cefr_review_status=APPROVED` vs `PROVISIONAL` and whether topics remain enabled. Do not infer CEFR validity from headword/POS labels.
4. Check any current learner progress, SRS records, active OPEN/LIVE events and duplicate/ambiguous Vietnamese cues before corrective action. These counts may have changed since 2026-11-17.
5. For future LIFE-08..10 preparation, compare new entries against the **current** catalog, not the historical 365-word seed. No automatic import or silent change of word UUIDs.

## Safety gates

- **NEVER re-run LIFE-01..07 or extra legacy imports** merely because an old PR contains preflight scripts or unpublished topic setup.
- The 734 imported provisional records still require editorial sense, IPA, translation and ambiguity review; no blanket upgrade to APPROVED.
- Any correction to live content should be a separately reviewed, audited, targeted transaction using exact UUIDs. Preserve the word rows and learner history; prefer reviewed soft-disable over destructive deletion where necessary.
- A Vercel code deployment does **not** change the shared vocabulary count, because My Learning reads the production database.
- This ledger is evidence archiving only. It makes no claim of a successful restore drill or of current real-device sign-off.

### Related decisions
- Old [PR #100](https://github.com/vonghiazzz/wordsky-english-game/pull/100) blended obsolete *pre-import* numbers with later post-import records and has conflicts with main. Preserve history but do not merge its obsolete preflight wholesale.
- [UX55 release issue #128](https://github.com/vonghiazzz/wordsky-english-game/issues/128) governs V1/V2/V3 CEFR code promotion separately.
- [WORDSKY_CURRENT_STATE.md](../WORDSKY_CURRENT_STATE.md) describes the known main/preview/production SHA snapshot; refresh from GitHub and Vercel when it changes.
