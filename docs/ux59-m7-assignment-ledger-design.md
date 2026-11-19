# UX59 M7 — Delayed-recall assignment ledger: schema design review

**Status: DESIGN ONLY / UX43 migration source verified; isolated Preview DB constraints not yet verified.** Related #151, protocol #148, M5 #149, M6 #150, draft PR #146, UX58 Preview release gate #144.

## Source of truth / known code
From `lib/ux43c-recall-service.js` (verified on main/PR branch), the Preview/local research pilot writes to `public.ws_recall_consents`, `public.ws_recall_trials` and `public.ws_recall_evidence`, and reads `public.ws_recall_curated_prompts`. Actor/session version and consent are checked in a transaction, review evidence is server-graded and idempotent, and opt-out removes research data. The feature is disabled on Production independently of Preview flags. No UX59 code is integrated into the runtime.

The UX43 migration source has now been verified at `db/migrations/20261031_ux43c_typed_recall_pilot.sql` on `main` (originally introduced via PR #76). The deployed Preview DB schema and actual migration application status **have not** been verified. The following is a **proposed contract, not executable SQL or an approved schema**.

## Proposed separate assignment ledger (review before DDL)
An independently scheduled delayed assessment should use a server-owned immutable record with:
- `assignment_id`: opaque UUID primary key and trial binding key
- `account_id`: authorized player, FK to existing user; deletion semantics aligned with UX43 consent cascade
- `source`, `word_id`, `curated_prompt_id`, `answer_revision`: immutable reviewed item/sense and answer revision; restrict MVP to approved shared vocabulary
- `study_protocol_version`, `arm_assignment`, `assignment_nonce`: pre-registered study configuration and idempotent enrollment/assignment; no runtime SRS changes
- `assigned_at`, `assessment_due_at`, `assessment_window_end_at`: server-recorded timezone-aware instants; assigned_at must be earlier than due, with pre-declared evaluation window independent of each algorithm's due date
- `consent_version`, `curation_revision`, `holdout_provenance`: snapshot evidence for current/revoked study consent, question review and independent holdout; avoid storing raw user answers or email
- `state`: `scheduled`, `issued`, `completed`, `missed`, `withdrawn`, `invalidated` (exact transitions require design approval)
- `linked_trial_id` nullable until trial issuance, unique at most once and pinned to same account/word/revision; do not duplicate `result` or source-of-truth score already in UX43

Require a uniqueness contract preventing duplicate assessments under the same study/account/item/target interval; exact keys and FK strategy depend on the inspected real schema. Index permitted due-time lookups by assignment state; partial/filtered index decisions require query review.

## Proposed lifecycle (server-owned, Preview-only)
1. Server validates opted-in actor, current session version, approved question/sense revision, study eligibility and independent holdout status.
2. In one authenticated DB transaction, record a fixed due/window assignment from the approved study protocol. Idempotent repeated enrollment returns the original assignment. Protect per-account concurrency.
3. Read-only due queue returns only assigned/pending card prompts without the accepted answer. Never expose the correct answer or future assignment details that alter learning.
4. On due trial issuance, atomically claim the assignment, check current consent/session/cue revision, create the original UX43 trial with its existing server-only grading workflow, and persist immutable assignment-to-trial linkage.
5. On result, reconcile the corresponding UX43 evidence, treating expired/repeats/assistance as excluded, and report missing scheduled assessments without marking them wrong. Event replays must never double count.
6. On withdrawal, enforce verified cascading deletion or documented irreversible anonymized aggregation policy consistent with the consent and privacy approval. Do not leave orphan trial references or join keys.
7. On rollback or study stop, disable new assignment/issuance without rewriting baseline SRS due dates/history; preserve or delete existing study data only according to approved consent and retention controls.

## Threat and correctness gates
- Do not accept browser-submitted `independent`, `curated`, `answer_hidden`, consent, result, due time, assignment or arm as authoritative.
- Check actor-switch, simultaneous devices, repeated submit, stale consent, prompt revision drift, prior answer exposure and no-account access under isolated PostgreSQL/Preview tests.
- Enforce clock ordering and UTC storage versus Vietnam calendar presentation, fixed evaluation horizon and missed assessments.
- The current UX43 random selection and 4-minute challenge TTL are **not** equivalent to a delayed holdout schedule. Study-specific issuance must be reviewed separately, not silently reused.
- Keep study roster apart from SRS progress; never infer CEFR mastery or claim observed retention from synthetic examples.
- Ensure the actual schema supports account deletion/withdrawal and cannot cross-link another user. Review migration history for version conflicts.

## Release gates / next action
**STOP before creating or running migration.** Existing UX43 DDL source has been inspected (see M8 audit). Next confirm actual constraints and applied migration in an isolated nonproduction database. Then obtain study/privacy/editorial protocol approval, design a minimal Preview-only migration on a separate PR, test transaction/rollback/replay and sign off protected Preview (#144). Production feature flags remain off. UX59 algorithm status remains **HOLD_NO_RUNTIME_CHANGE**.
