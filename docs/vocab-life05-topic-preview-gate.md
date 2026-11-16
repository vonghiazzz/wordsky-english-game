# LIFE-05 — Money & Payments disabled-topic Preview gate

**Status:** Developer safety tooling only. All LIFE-05 candidates are `PROVISIONAL` and not imported. The new topic `Money & Payments - Thanh toán` is **proposed but not in the active 26-topic catalog**; this PR cannot activate it.

## Scope and dependencies

Requires **LIFE-04 content PR #91** and **LIFE-05 draft PR #92** to be merged before this gate is merged. Built from PR #92 to run full isolated CI; the diffs should be narrowed after dependencies merge.

Exactly **75 of LIFE-05's 100 candidates** belong to this pending topic:
- 25 prices/discount/budget expressions;
- 25 payment methods, transfers and confirmation expressions;
- 25 returns/refunds/warranties and complaints.

The other 25 shopping expressions target the existing `Shopping - Mua sắm` category. No actual topic, word, round, gameplay or SRS record is created by merging this PR.

## Target isolation

Default command is **offline dry-run**:

    npm run vocab:topic:plan:life05
    # equivalent: node scripts/register-life05-topic.mjs

This validates LIFE-1000 roadmap, original seed/CEFR queue, prior LIFE-01 to LIFE-04 drafts, and LIFE-05's 100 candidates. All 100 must be `PROVISIONAL`, no reviewer impersonation, and four 25-entry allocations with exactly 75 to the new topic.

Optional **isolated local** write for manual testing:

    WORDSKY_TEST_DATABASE_URL="postgresql://wordsky_test:LOCAL_SECRET@127.0.0.1:5547/wordsky_v6_test" \
      node scripts/register-life05-topic.mjs --write-local-test

The role, database, host and port are pinned, and the actual PostgreSQL `current_database()`/`current_user` are checked again after connecting.

Optional real Preview write is **NOT performed in this PR**. It is permitted only after the user explicitly authorizes that operation and the isolated Preview target is independently verified. Required environment variables:
- `WORDSKY_TARGET_ENV=preview`
- `WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED=true` (generic explicit manual gate)
- `WORDSKY_LIFE05_TOPIC_WRITE_APPROVED=true` (additional LIFE-05-specific gate)
- `WORDSKY_PREVIEW_DATABASE_URL` and independently verified `WORDSKY_PREVIEW_EXPECTED_HOST`, `WORDSKY_PREVIEW_EXPECTED_DB`, `WORDSKY_PREVIEW_EXPECTED_ROLE`
- Explicit `node scripts/register-life05-topic.mjs --write-preview`

The shared security policy refuses remote writes in CI, declared Production targets, mismatched DB identities, known Production connection aliases, and localhost Preview URL. It is a defense-in-depth check; **matching hostname alone does not prove Preview isolation**. Do not improvise remote credentials or run the write without independent evidence and user approval.

## Transaction semantics and automated checks

1. Start SERIALIZABLE transaction and set local lock timeout.
2. Recheck real DB name/user. Acquire an advisory lock on the normalized topic title.
3. Reject duplicate/alias, enabled or occupied existing topic; ensure there are no linked words or rounds.
4. Insert exactly one `ws_topics(title,enabled) VALUES($1,FALSE)`, or reuse same disabled and empty row idempotently. **Never enable the topic**.
5. Local PostgreSQL17 CI checks hidden state, 0 words, 0 rounds, safe rerun and then **ROLLBACK**; no topic is persisted.
6. Existing account sync and SRS browser tests must pass. No forced acceptance of alternative answers.

## Content approval and release blockers

LIFE-05 still has 98 contextual CEFR estimates and 2 Cambridge-linked evidence items, not approved teaching or game cards. Check Vietnamese prompt ambiguity, UK/US payment terms, abbreviations and original examples, with bilingual reviewer provenance. A subsequent approved-only importer must preserve word IDs/user SRS; direct activation from this script is forbidden.

A Production release requires read-only catalog reconciliation, isolated Preview QA with backup/rehearsed rollback, explicitly approved topic activation, and an explicit user request. This PR does not modify Production, deploy Vercel, or approve any word.
