# UX59 M8 — Existing UX43 DDL audit and Preview migration readiness

**Status: CODE-SOURCE AUDIT PASS; ACTUAL ISOLATED PREVIEW DB AUDIT NOT RUN. NO NEW DDL AUTHORIZED.**

## Exact source verified

- Canonical existing migration on main: `db/migrations/20261031_ux43c_typed_recall_pilot.sql` (introduced by PR #76).
- Runtime source: `lib/ux43c-recall-service.js`, gated to Preview/local when enabled; independent UX59 delayed scheduling does not exist.
- The migration comments explicitly restrict execution to isolated QA/approved Preview PostgreSQL and require distinct authorization before any Production execution.
- Source code and DDL were inspected; there was **no DB connection or migration execution** in this audit.

## Existing table constraints

| Table | Verified schema contract | Important implications for assignment design |
| --- | --- | --- |
| `ws_recall_curated_prompts` | UUID primary key; word FK `ON DELETE CASCADE`; unique `(word_id, answer_revision)`; curator `owner`; `approved` / `active` | Assignment must capture immutable approved prompt revision and handle later prompt deletion/revision |
| `ws_recall_consents` | `user_id` PK, FK to `ws_users` `ON DELETE CASCADE`; consent version `ux43b-opt-in-v1` | Enrollment must require active consent; account deletion cascades |
| `ws_recall_trials` | UUID PK; consent user FK `ON DELETE CASCADE`; prompt FK without explicit delete action (default NO ACTION); word FK cascade; unique `(user_id,id)`; 5-min max expiry; atomic submit-result consistency check | Proposed assignment link must respect existing trial IDs and user IDs; prompt deletion needs an explicit editorial handling policy |
| `ws_recall_evidence` | `trial_id` PK; user FK to consent `ON DELETE CASCADE`; composite `(user_id,trial_id)` FK to trials `ON DELETE CASCADE`; unique `(user_id,request_id)` | Must not create a second score source; replays and cross-account linkage already have relevant DB constraints |

All four tables enable row-level security and revoke access from `PUBLIC`, plus `anon`/`authenticated` roles when present. The trusted server role operates with its own signed/versioned WordSky session authorization, not Supabase Auth identity. Exact runtime role privileges and deployment schema must still be inspected, not assumed.

## Minimal proposed assignment schema (design only)

A separate Preview-only `ws_recall_delayed_assignments` table may be appropriate after approval. It should store `id`, `user_id`, `prompt_id`, `word_id`, `answer_revision`, `protocol_version`, `assigned_at`, `due_at`, `window_end_at`, `state`, `idempotency_key`, `linked_trial_id`, and holdout/consent metadata.

Design requirements before writing SQL:
1. FK from `user_id` to `ws_recall_consents(user_id)` with `ON DELETE CASCADE` to preserve withdrawal/delete semantics; preferably a composite `(user_id,linked_trial_id)` foreign key to existing `ws_recall_trials(user_id,id)` with carefully specified `ON DELETE` behavior. A nullable trial link must not create orphan assignment rows after consent withdrawal.
2. Preserve the existing `ws_recall_evidence` as the only graded outcome; no new `correct` or raw answer column.
3. Unique idempotency key scoped to the account and protocol, plus a carefully reviewed uniqueness rule for study/account/prompt/revision/assessment interval. Decide how repeated studies or re-enrollment should work before setting constraints.
4. Server-owned immutable assignment and due times with `assigned_at < due_at < window_end_at`; trial issued only within window. Store instants as `timestamptz`, render dates in Asia/Ho_Chi_Minh only in presentation.
5. Consent-withdrawal and prompt-deletion behavior must be tested together; `ws_recall_trials.prompt_id` currently uses implicit NO ACTION, and a new FK may affect deletion operations.
6. Server-only SQL privileges/RLS, actor-pinned access, account row locks, transaction and replay checks are required. Client assertions of `independent`, consent, curation, assignment, due time or observed correctness are untrusted.
7. Study independent holdout/answer-exposure contamination requires an independently reviewed protocol. UX43 randomly selected trials are not automatically valid delayed assessments.

## Exact Preview DB audit checklist (not performed)

In an **isolated, explicitly approved nonproduction PostgreSQL** database:
- Confirm migration file application and compare `pg_constraint`, `pg_indexes`, RLS `relrowsecurity`, table privileges and role ownership to the source migration; do not print secrets or user rows.
- Execute only additive, rolled-back schema smoke tests for FK delete behavior, idempotent insert, unique trial linkage, account isolation, withdrawn consent cascade, prompt revision drift, and UTC/Vietnam boundary.
- Verify the trusted server DB role can access only what UX43 requires; public/anon/authenticated cannot read/write research tables.
- Demonstrate no changes to `ws_learning_word_progress`, SRS schedule or history tables.
- Record SHA of migration and exact source commit plus per-test PASS/FAIL before any implementation or Preview rollout approval.

## Decision

**M8 schema source inspection is complete; database-level verification is blocked.** Do not merge the Draft research PR, execute SQL, enroll users, enable flags or deploy UX59. The separately gated UX58 Production release is still on #144. Keep algorithm decision `HOLD_NO_RUNTIME_CHANGE`.
