# WordSky vocabulary content batch 1 — expand existing topics (QA only)

**Status:** Proposal / code review. No Production data writes, database migration, app feature flags or Vercel deployment.

## Decision

Grow the existing core vocabulary before introducing more topics. Current repository's **sample seed** has 26 topics × 10 cards = 260 entries; this is not the live production catalog (previously observed separately at 365 words). This batch adds **4 new entries each to 5 existing topics, for 280 total seed entries**, without renaming or deleting existing words.

| Existing topic | New English expressions |
| --- | --- |
| Daily Life | wash dishes; get dressed; take a shower; set the table |
| Food | vegetable; cheese; sandwich; noodles |
| School - Trường học | textbook; dictionary; classmate; timetable |
| Travel - Du lịch | boarding pass; luggage; destination; departure |
| Technology - Công nghệ | charger; battery; browser; attachment |

Each entry contains the existing 5 fields: English, IPA, Vietnamese meaning, English example and Vietnamese translation. These IPA entries and translations are **editorial candidates**, not proof of bilingual validation or CEFR-approved learning prompts. Human review of wording, pronunciation variants and contextual meaning remains necessary before publishing.

## Data lineage and safe rollout

- `db/seed-vocabulary.json` feeds `scripts/seed.js` for local/isolated testing. The seed script uses `ON CONFLICT(topic_id,english) DO NOTHING`. Running it repeatedly does not overwrite older existing rows, progress records or user cards.
- **Do not run this seed against Production** without a separate content release decision, backup and approved migration/rollback plan. The public Production catalog is managed by PostgreSQL/Admin and will not change from a GitHub merge alone.
- Existing game eligibility/CEFR approval checks must not be bypassed to expose newly seeded words in SOLO/competitions. No automatic activation of draft questions or `accepted_english` answer lists.
- The new meaning cues are intended to be distinct, avoiding additional literal cue collisions.
- The original suggestion `library` was already present in the frozen 117-record `PROVISIONAL` CEFR draft. Replace it with `textbook` instead of duplicating an existing candidate.
- This content batch updates `vocab/cefr-review-all-topics.json` in lockstep: 280 unreviewed seed words + 117 provisional candidates = **397 review records**. Every added word remains `UNREVIEWED`, with `level=null` and no reviewer approval. The CI test now checks exact seed/queue field parity and rejects provisional overlaps. This does not authorize any production import. QA-S1A (separate PR #82) records the pre-existing ambiguous cue `năm` corresponding to `five` and `year`. That existing case still needs a human content decision.
- Do not use real student data, account word lists or progress history to assess these words; test from public seed + synthetic QA accounts only.
- **Acceptance:** `npm run check`, `npm test`, local isolated PostgreSQL17 and Chromium/Firefox E2E; verify no duplicate English words or new identical Vietnamese cues; human sign-off on IPA and usage before any actual content release.

## Follow-up small batches

1. Complete QA-S1A and this Batch 1 PR; manually review the 20 entries.
2. **Batch 2 (separate PR):** 20 additional practical words across Family, Shopping, Weather, Feelings and Jobs, after usage/ambiguity checks.
3. **Batch 3 (separate PR):** 1–2 new topics with 10–12 curated words each (candidates: Environment – Môi trường and Everyday Communication – Giao tiếp thực tế). Validate topic naming against existing Greetings and Nature to avoid duplicates.
4. Only after content and release QA, prepare a reviewed Admin import into an isolated environment, observe SRS/learning impact and request explicit Production promotion approval.

This PR changes **content fixtures only**. It does not change the UX28 grader, the server's SRS behavior, review receipts, personal vocabulary, player progression or production availability.
