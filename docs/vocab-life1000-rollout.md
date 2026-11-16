# LIFE-1000 — Ten incremental vocabulary batches for WordSky

**Scope:** an editorial plan, not 1,000 prewritten words, not an approved CEFR list, not a database migration, and not a Production deployment. Each of 10 upcoming batches targets exactly **100 new English words or practical expressions**, in four groups of 25.

## Verified baseline and data boundaries

- Repository public seed: 280 words across 26 existing topics. This is **not** the separately managed Production catalog.
- Existing provisional CEFR draft list: 117 records in `vocab/cefr-provisional.json`.
- PR #84 proposes sourced CEFR for 20 words from PR #83; until it merges, `main` still has 397 review rows (280 UNREVIEWED, 117 PROVISIONAL).
- No new topic is created just because it appears in a roadmap. Seven new topics remain `REQUIRES_SEPARATE_APPROVAL`.

## Batch allocation

The machine-readable source of truth is `vocab/life-1000-roadmap.json`.

| Batch | Focus | Four groups (25 each) | Intended topics |
|---|---|---|---|
| LIFE-01 | Daily routines | morning, personal-care, household, evening | Daily Life, Home |
| LIFE-02 | Everyday conversation | introductions, checking-in, small-talk, requests | New Everyday Conversation |
| LIFE-03 | Social relationships | family, friendship, gatherings, feelings | Family, Feelings, new Social Relationships |
| LIFE-04 | Food and cooking | ingredients, kitchen, cooking, dining | Food, Restaurant, new Cooking & Kitchen |
| LIFE-05 | Shopping and payments | shopping, prices, payments, returns | Shopping, new Money & Payments |
| LIFE-06 | Commute and travel | commute, navigation, bookings, disruptions | Transport, Directions, Travel |
| LIFE-07 | Health and wellbeing | symptoms, pharmacy, habits, wellbeing | Health, Sports, Feelings |
| LIFE-08 | Work communication | workday, messages, meetings, feedback | Jobs, new Work Communication |
| LIFE-09 | Community services | neighbourhood, housing, services, appointments | Places, new Community Services |
| LIFE-10 | Opinions and problem solving | opinions, agreement, problems, plans | Verbs, new Problem Solving |

**Editorial CEFR mix target:** A1 200, A2 400, B1 300, B2 100. These are aspirational and must never override observed evidence for individual word senses. An academic lookup or a course syllabus does not automatically establish a dictionary-certified CEFR grade.

## Candidate word contract

A future file `vocab/batches/LIFE-01.json` must have `batch_id:"LIFE-01"`, `status:"DRAFT"` and a `records` array containing exactly 100 entries, 25 for each defined group.

**Synthetic schema illustration — no word or academic level here is verified:**

    {
      "group_id": "morning",
      "topic": "Daily Life",
      "english": "EXAMPLE-PHRASE-NOT-FOR-IMPORT",
      "ipa": "/example/",
      "meaning": "Nghĩa minh họa, không được nhập",
      "example": "This is a synthetic sample.",
      "translation": "Đây là ví dụ giả lập.",
      "part_of_speech": "phrase",
      "level": "A2",
      "review_status": "PROVISIONAL",
      "source_url": "https://dictionary.cambridge.org/dictionary/english/example",
      "cefr_evidence_kind": "contextual_inference",
      "cefr_source_label": null,
      "source_note": "SYNTHETIC ONLY: not evidence that this expression has the claimed CEFR level."
    }

Each real entry needs original learner-facing example text, IPA, meaning, translation, part of speech, source and an evidence note explaining the **specific sense**. Allowed evidence types are `exact_sense_label`, `collocation_in_labeled_sense` and `contextual_inference`. Inferred words must set `cefr_source_label=null`. All candidates remain `PROVISIONAL`; no client-provided reviewer/approval metadata. A syntactically valid source URL does not prove its claim: human checking is required.

## Deterministic QA

Run the roadmap check (it also **automatically validates every LIFE-NN.json file** already present in the vocab/batches folder):

    npm run vocab:plan

When a real set of 100 proposals is authored, an explicit single-batch check is also available:

    node scripts/qa-vocab-life1000.mjs --file=vocab/batches/LIFE-01.json

Checks include: 10 batches and 4x25 group quotas, new topic allowlist, duplicate English across public seed / earlier CEFR drafts / previously saved batches, ambiguous Vietnamese cues, inconsistent CEFR evidence, missing data, unsafe URLs, attempted APPROVED statuses or reviewer metadata.

Passing the tool means the **offline structure is valid**, not that 100 definitions were independently verified. The result always sets `candidate_import_authorized:false` and `production_deployment_authorized:false`. No Supabase/Vercel queries or live account reads occur.

## Incremental rollout and approvals

1. **Preparation (this PR):** establish the 10x100 plan, topic destinations, batch schema and no-write CI gates.
2. **LIFE-01 editorial PR:** research 100 distinct daily-life expressions with usable IPA/meaning/examples and defensible CEFR evidence, then pass QA. Human bilingual review still pending.
3. **Independent topic approval before LIFE-02:** review nomenclature, overlapping topics and business permission; develop isolated Preview-only creation and promotion for proposed topics. The current importer admits only already-seeded and enabled topics, and must never implicitly create Production topics.
4. **Human content review:** verify dictionary sense, UK/US IPA, Vietnamese meaning, lexical ambiguities, English alternatives, example quality and provenance. Only trusted authorized reviewer processes can set APPROVED.
5. **Isolated QA, backup and release:** PostgreSQL17 and Chromium/Firefox, idempotent imports, unchanged UUIDs, protected player SRS and rollback rehearsal. User approves Production update separately.

Existing 26-topic/280-word tests remain baseline invariants until a reviewed content batch intentionally updates their expectations. This PR does not alter grading, the CEFR importer, SRS, Admin routes or feature flags.
