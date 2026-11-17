# SOCIAL-1000 — Giao tiếp xã hội và đời sống (v1, editorial preflight)

Updated 2026-11-17. **Source-of-truth: GitHub DRAFT** — NOT published to WordSky Production.

## Goal and inventory

Add **1,000 new conversational learning items**, in 10 batches x 100 (files at `vocab/social-life-batches/SOCIAL-01.json` through `SOCIAL-10.json`), to support
natural English interaction at home, work, online and in the community.
These are **English utterances / phrases, not necessarily single dictionary headwords**.

| Batch | Topic (already exists in WordSky) | Quantity |
| --- | --- | ---: |
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
| **Total** | 10 existing topics | **1,000** |

Each new record includes topic, phrase, Vietnamese cue, complete-utterance
usage example, translation, **proposed** CEFR level, general learning reference,
provenance warning and explicit review flags. Speaking examples are purposefully
the standalone sentence/prompt with correct question or statement punctuation;
richer two-sentence contextual examples require a separate editorial pass.

## Evidence and QA 2026-11-17

- Production at audit: **1,099** active public WordSky entries across **30 topics**;
  365 CEFR APPROVED and 734 PROVISIONAL already in PostgreSQL.
- 1,000 source records and 1,000 distinct English strings and Vietnamese cues.
- Normalized case, whitespace, curly quotes and terminal punctuation.
- **0 exact English collisions and 0 exact Vietnamese cue collisions** with
  the 1,099-record Production API snapshot after **7 collision corrections**
  (3 English matches, 4 same-meaning cues). No duplicates among new records.
- **5 high-similarity expressions** were subsequently replaced after conservative
  Jaccard review to avoid trivial variations on existing WordSky cards.
- All 10 topics exist and were enabled in Production at audit.
- 1,000/1,000 English items <=80 chars; 1,000/1,000 Vietnamese cues <=180 chars.
- Editor-estimated CEFR distribution: **A2 = 742, B1 = 258**. This is a
  **rule-based starting estimate, not Oxford/Cambridge/CEFR-accredited evidence**.
- Every record status is **PROVISIONAL**; every entry has
  `editorial_status=AI_DRAFT_NEEDS_BILINGUAL_REVIEW`, `ipa_quality=PENDING`.
- `ipa=""` deliberately: no fabricated phonetic transcript for complete sentences.
  The web app already has browser-based SpeechSynthesis, but speaker audio / UK vs
  US variations still need human QA.

## CEFR evidence boundaries

- [Council of Europe CEFR descriptors](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors)
  assess a learner's communicative skills; they do **not** certify arbitrary
  individual sentences as A2/B1.
- [Oxford's explanation of wordlists and CEFR](https://www.oxfordlearnersdictionaries.com/about/wordlists/cefr)
  distinguishes CEFR skills from pedagogically aligned vocabulary lists.
- [British Council LearnEnglish Speaking](https://learnenglish.britishcouncil.org/free-resources/speaking)
  groups practical conversations into A1–B2 activities; the URL is a
  **general pedagogical reference**, **not** proof that any particular newly
  authored WordSky expression has a British-Council-approved CEFR label.
- No independently checked per-sense Cambridge/Oxford evidence, no named
  human reviewer, no IPA signoff, no approval date is asserted.

## Editorial review work queue

Use `vocab/editorial/SOCIAL-1000-review-queue.csv`. One row per ID, with
independent bilingual, sense, CEFR and IPA review columns still **PENDING**.
Do NOT bulk-write `APPROVED` without reviewing each unique word sense/phrase
register and source evidence. For longer spoken phrases, a learner-level
conversation can be aligned to A2/B1 without an individual official label;
record that distinction explicitly in any approval policy.

### Blocking checks before publishing

1. **Bilingual editorial:** verify natural English use, Vietnamese sense/intent,
   register (formal/informal), answer ambiguity, and question punctuation.
   Check whether a stored item is a genuinely distinct learning target rather
   than a paraphrase of an already available card.
2. **Pedagogy:** separate standalone utterances from single vocabulary words.
   Most phrases have **5–8 words**; do not put them blindly into BOMB/CAR typing
   rounds. Decide whether to use a learning-only phrase corpus, or guard game
   selection to avoid questions with long sentence answers.
3. **CEFR:** audit level and references per meaning/function; no fabricated
   reviewer metadata or A2/B1 approval.
4. **Pronunciation:** keep Web Speech as assistive only; if phonetic IPA is
   promised in the learning UI, validate or omit the value until checked.
5. **Isolated DB:** test import with a separate isolated PostgreSQL/Preview,
   duplicate English + Vietnamese cue checks, transaction idempotency,
   historical word ID preservation, and two-browser account/SRS E2E.
6. **Release controls:** current Production has real users; require backup
   verification, active-game guard, owner approval of the exact release
   manifest, audit of inserted IDs, safe rollback and a post-import API
   verification. No release or migration is authorized by this PR.

## Deployment status

`vocab/social-life-batches/SOCIAL-01..10.json` and the review CSV are GitHub editorial files only.
There is **no importer or app mutation** in this PR. No Production SQL INSERT,
Vercel redeploy or user account changes were performed. My Learning stays at
**1,099 shared words** pending a separate, quality-gated release.

After **1,000 net-new distinct** entries are reviewed and genuinely published,
the numeric target would become **2,099 shared learning items** assuming no
other database changes. **Do not claim that count until verified in live API.**

## When continuing this project

1. Read the actual DRAFT files and the review CSV.
2. Check the current live API and the GitHub HEAD for changes since this audit.
3. Work one batch of 100 at a time; record review decisions, links, corrected
   values and reviewer signoff per line; run `node --test tests/social-life1000-content.test.js`.
4. After content approval, design **learning-only phrase distribution** or a
   game exclusion gate, then import a single tested batch and verify the
   account learning UI before continuing to the next.
