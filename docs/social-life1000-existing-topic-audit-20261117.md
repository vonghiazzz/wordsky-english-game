# SOCIAL-1000 — Existing-topic deduplication and editorial review (2026-11-17)

## Scope / source of truth
Audited all 1,000 records of `vocab/social-life-batches/SOCIAL-01..10.json` against repository catalogs: `db/seed-vocabulary.json`, `vocab/cefr-provisional.json`, `vocab/cefr-approved-editorial-27.json`, `vocab/batches/LIFE-01..07.json`. Comparison corpus includes 1,124 source entries **before deduplication** (not a production row count). Production snapshot from prior editorial audit was 1,099, but was **not** refreshed by this report.

## Deterministic duplicate screening
- 1,000 candidate phrases across 10 batches; 100 records per existing topic.
- 0 duplicate English strings within SOCIAL-1000, after NFKC, case, whitespace, curly-apostrophe and terminal punctuation normalization.
- 0 exact English collisions with repository source catalogs.
- 0 exact Vietnamese cue collisions with repository source catalogs.
- Token-Jaccard screen (English tokens longer than 2 chars; cutoff >=0.72) surfaced 6 potential lexical near overlaps (review manually; overlap does not mean same teaching item):

| New ID | Existing repository overlap | Decision |
|---|---|---|
| SOCIAL-01-049 | LIFE-02: “That is very kind of you” | Keep pending: distinct thank-you conversational response, but related intent |
| SOCIAL-01-097 | LIFE-03: “have a lot in common” | Keep pending: full contextual utterance vs lexical expression |
| SOCIAL-05-064 | LIFE-04: “peel the potatoes” | Keep pending: full request/action vs lexical expression |
| SOCIAL-05-068 | LIFE-04: “stir the sauce” | Keep pending: full request/action vs lexical expression |
| SOCIAL-05-075 | Seed: “set the table” | Keep pending: contextual utterance vs lexical expression |
| SOCIAL-07-036 | LIFE-03: “ask for help” | Keep pending: contextual utterance vs lexical expression |

This semantic screening is incomplete; full expert review remains necessary for paraphrases and ambiguous Vietnamese cues.

## Editorial correction applied
- SOCIAL-01-007: Changed incomplete “It's great to finally meet” to “It's great to finally meet you” and synchronized the Vietnamese translation and editorial queue. Remains PROVISIONAL; no fabricated human signoff.

## Existing topic allocation

| Batch | Exact existing topic | Candidates |
|---|---|---:|
| SOCIAL-01 | Everyday Conversation - Giao tiếp hằng ngày | 100 |
| SOCIAL-02 | Social Relationships - Quan hệ xã hội | 100 |
| SOCIAL-03 | Home - Nhà cửa | 100 |
| SOCIAL-04 | Shopping - Mua sắm | 100 |
| SOCIAL-05 | Restaurant - Nhà hàng | 100 |
| SOCIAL-06 | Jobs - Nghề nghiệp | 100 |
| SOCIAL-07 | Feelings - Cảm xúc | 100 |
| SOCIAL-08 | Travel - Du lịch | 100 |
| SOCIAL-09 | Technology - Công nghệ | 100 |
| SOCIAL-10 | Daily Life | 100 |

**No new topic creation required.** The existing `ws_topics.title` keys and 10 topic assignments must be preserved at import time.

## CEFR and pedagogy audit
- Existing A2/B1 labels are *editorial estimates* only, not sourced individual-expression certifications.
- 50 flagged language/grammar/level cases are enumerated in `docs/social-life1000-ai-prescreen-20261117.md`. Those remain to be reviewed.
- IPA blank and IPA status PENDING for all sentences; don't invent dictionary IPA for sentence-level material.
- All 1,000 records remain DRAFT/PROVISIONAL; no human approval metadata should be fabricated.
- Phrase-length items are not safe to enable in BOMB/CAR/MATCH without gameplay filters. Existing `ws_words` catalog feeds both learning and games, so merely using an existing `ws_topics` entry does **not** guarantee learning-only.

## Release and database safety
**No production insert, migration, or deployment by this PR.** Next tasks: implement a phrase-specific safe import policy / game exclusion guard; isolated Postgres import test with duplicate checks and idempotency; verify account My Learning + SRS and production backup; refresh production snapshot before any write.

Note that My Learning `lib/unified-learning.js` consumes enabled `ws_words` directly and has a 5,000 shared-word guard. It does not read JSON from GitHub: merging this content PR does not change live catalog count.
