# UX43D – Prompt curation quality and SRS v2 evidence-readiness protocol

**Scope:** Offline reproducible quality audit and a research protocol. This
PR does NOT activate UX43C, add a database migration, alter consent,
change authenticated API endpoints, migrate user schedules or compare
models. GitHub CI runs synthetic fixtures without any real account data.

## Verified baseline

- UX43A established a deterministic historical replay of
  `ux24-fixed-v1` SRS with intervals 1/3/7/14/30/60/90 days.
- UX43B introduced opt-in, unassisted first-attempt typed English evidence
  semantics, with deliberately strict answer normalization.
- UX43C introduced an isolated-DB-only typed test with signed player
  sessions, explicit consent/withdrawal and a private challenge/evidence
  ledger; it is **not** available on the live Production deployment.
- UX43C stored evidence rows are
  `trial_id, user_id, request_id, word_id, answer_revision, prompt_kind,
  result, response_latency, consent_version, observed_at`.
  They do **not** contain `first_attempt` and `unassisted` fields from
  UX43B's in-memory prototype, nor a verified review-exposure timeline,
  policy assignment, randomized comparison group, or long-horizon target.
- The UX43C curation table defaults to `approved=false`,
  `active=false`. A WordSky CEFR review is NOT a manually reviewed
  bilingual recall prompt.

## Part A: Standardize a shared-card prompt curation audit

`lib/ux43d-curation-readiness.js` takes **trusted** offline arrays of
enabled shared vocabulary cards and manually curated prompt snapshots;
it does not query or modify PostgreSQL. Each candidate should have:

```text
id, word_id, prompt_vi, accepted_english[], answer_revision,
curator, approved, active
```

For each *active AND approved* candidate, block and aggregate:

| Reason | Meaning |
|---|---|
| missing_or_disabled_word | Unknown/disabled word or disabled topic |
| untrusted_curator | Curator not recorded as the WordSky owner |
| catalog_answer_missing | Exact normalized current English entry absent from allowed variants |
| invalid_prompt_or_variants | UX43B validation rejects empty/unreviewed/answer-leaking prompt or invalid variants |
| duplicate_active_word | Multiple active prompt revisions for one word |
| ambiguous_shared_cue | Same normalized Vietnamese cue is active for different English words |

No accepted variants are invented or expanded automatically. Detecting
identical Vietnamese cues is only a **minimum** ambiguity check:
different Vietnamese phrases may still translate to multiple English
words, and a correct variant may be missing. Therefore
`lexically_eligible_records` is NOT proof of semantic validity.
`human_semantic_review_required=true` and
`authorized_to_activate_prompts=false` are always returned.

**Required manual review before authorizing a prompt:**

- Two reviewers proficient in both languages independently inspect the
  Vietnamese clue, precise target meaning, article/inflection, part of
  speech, acceptable spelling variants and whether plausible competing
  answers exist in the same catalog.
- Record a stable answer revision and a curator's approval decision.
  Resolve reviewer disagreement with explicit documented adjudication;
  never silently choose the first dictionary translation.
- Freeze the exact prompt/accepted-variant set for a trial so later
  curation cannot rewrite the meaning of earlier results.
- Reject prompts containing the literal English answer, examples that
  reveal it, circular hints or cues with irreducible ambiguity. Examples
  such as `Thức dậy (wake up)` already show the target and cannot be
  reused without review.
- Audit scope is currently **shared words only**. No private vocabulary
  extraction, no automatic publishing or bulk enabling all 365 words.

The offline audit returns aggregate reason counts and coverage among
enabled vocabulary. It never emits user IDs, word IDs, Vietnamese clues
or answer keys. If a reviewer needs item-level error details, that
workflow must stay on an authenticated, access-controlled internal tool;
do not add private details to a public report.

## Part B: Audit the *actual persisted* UX43C evidence

`auditUx43cEvidenceReadiness` validates the UX43C database evidence
schema, not the richer UX43B prototype object. The offline input is a
trusted, purpose-limited, explicitly authorized read extract from an
**isolated** environment. No Production export is requested or run.

Checks:

- Explicit consent version, known prompt kind and server-stored outcome;
- Valid UUIDs/UTC instants, result/latency categories and answer revision;
- No duplicate trial ID or repeated request ID from one account;
- No embedded raw learner responses, prompts, answers or password hashes;
- No event later than the fixed snapshot timestamp.

The private internal report counts unique participating accounts,
distinct words, first and repeat account-word observations, correct and
incorrect typed responses, response-latency buckets, and repeat
*assessment* gaps of 7+ days. These are only repeated test timestamps:
**they are NOT necessarily intervals without intervening practice**.
The reader is told not to publish small cohorts with fewer than five
participants. Reports contain aggregate-only statistics and no raw
identifiers.

The offline audit must **always** report:

```text
valid_to_estimate_long_term_retention = false
valid_to_compare_srs_v2_effectiveness = false
```

This is a logical limitation, not a software failure: UX43C data has
no complete exposure history, no randomized/logged scheduling policy
assignment, no independently specified delayed retention horizon, and
no censoring/intervening practice measurements. A high observed
first-attempt correctness rate in that pilot would not prove a new
scheduling policy is better.

## Preregistered future evaluation design (not executed in UX43D)

**Phase 0 – Compliance and measurement:** Approve age/guardian
eligibility, consent language, retention and withdrawal policy,
purpose-limited access, encryption and audit controls. Obtain formal
authorization before any collection beyond disposable QA. In
particular, existing Production users should never be implicitly
enrolled. Catalog QA and nonconsented exercises must be isolated.

**Phase 1 – Standardize prompt and grading:** Freeze curated prompt
versions and answer-variant sets. Collect server-issued blinded
retrieval trials with documented exposure histories, hints/reveal
flags, retries and eligible first-attempt outcomes. Ensure consistent
conditions and document missing responses, unobserved exposures,
practice in other modes and withdrawals. Keep `remembered` and
game performance separated from measured typed answers.

**Phase 2 – Predictive offline study:** Predeclare a temporal cutoff,
an embargo interval and a held-out time window before fitting any
parameters; optionally hold out entire learners or word families to
check generalization, with careful non-overlap. Compare a calibrated
v1 baseline and candidate on the SAME eligible assessment events,
matching review budget and interval conditions. For probability
predictions, report coverage, Brier score, log-loss, calibration plots,
predeclared subgroups and confidence intervals clustered by learner.
Do not train on future events, repeat/near-duplicate prompts across
train/test, or infer censoring as incorrect answers. If predictions
or enough real evidence are missing, report `not estimable` rather
than fabricate scores.

**Phase 3 – Causal scheduling comparison:** Only after ethics/product
approval and a prespecified power analysis, randomize eligible users
(or an appropriate interference-safe unit) to v1 versus v2 with
equalized opportunity/review workload. Define the primary delayed
recall outcome, observation window, minimum clinically/educationally
meaningful effect, attrition handling and rollback criterion up front.
Use intention-to-treat and report uncertainty; do not declare victory
from offline fitting alone. Stop a harmful arm under a prespecified
guardrail, and never migrate current Production due dates silently.

UX43E, if approved, could add a reviewer workflow, explicit opt-in
eligibility and research-grade exposure instrumentation behind isolated
Preview flags. This will require separate security, schema and privacy
reviews. UX43D itself makes **none** of those changes.

## Reproducible quality gates

1. `npm run check`, `npm test`, and
   `node scripts/ux43d-offline-research-qa.mjs` on the exact PR SHA.
2. Test duplicate prompts, bilingual cue collisions, answer exposure,
   disabled vocabulary, inactive revisions and answer-key mismatch.
3. Test actual UX43C persisted-event shape, strict consent/time/UUID
   validation, replay duplicates, no raw answers and small-cohort warning.
4. Run existing PostgreSQL17, Chromium, Firefox and mobile SRS suite as
   regression. No new Vercel build or DB migration for this offline PR.
5. Review the study's unverified assumptions. No claim of measured
   long-term recall or algorithm superiority is permitted.

**Safety status:** No Supabase Preview/Production SQL execution, no user
account reads, no Vercel deployment, no SRS behavior changes.
