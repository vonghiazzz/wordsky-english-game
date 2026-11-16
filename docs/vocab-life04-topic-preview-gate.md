# LIFE-04 — Cooking & Kitchen inactive-topic Preview gate

**Preparation only. No database change or Production release.** This PR depends on LIFE-04 content PR #91: it provides the unpublished 100-entry file to validate. The actual new topic `Cooking & Kitchen - Nấu ăn` is not present in the seed/database until a separate user-authorized test operation.

## Scope

Of the 100 PROVISIONAL LIFE-04 candidates, **50** map to the proposed new topic (25 `kitchen` and 25 `cooking`). The other 50 remain in existing `Food` and `Restaurant - Nhà hàng`. The registration script cannot approve, import, activate or expose any of them.

WordSky's Admin create-topic API defaults to `enabled=true`; therefore **do not use that API to prepare a pending topic**. This developer command is deliberately separate and inserts only `ws_topics(title, enabled) VALUES($1, FALSE)` after all checks pass.

## Offline default / reproducible QA

    npm run vocab:topic:plan:life04
    # node scripts/register-life04-topic.mjs

The default mode validates the approved-format roadmap, LIFE-04 JSON, all previous LIFE batches, original seed and provisional review list. It performs no DB or network connection. The result has zero approved words and denies any authorization to import or deploy.

## Target isolation and explicit approval

Optional local test-only insert (manual):

    WORDSKY_TEST_DATABASE_URL="postgresql://wordsky_test:LOCAL_TEST_SECRET@127.0.0.1:5547/wordsky_v6_test" \
      node scripts/register-life04-topic.mjs --write-local-test

Only the pinned local test DB, port and role are accepted. CI instead runs the same registration logic in a transaction, verifies disabled/empty/invisible state and repeated idempotency, then **ROLLBACK** and verifies no record remains.

A remote Preview write is **not authorized by merge and not executed in this PR**. Before separately approved isolated Preview execution, independently verify the DB and require:

- `WORDSKY_TARGET_ENV=preview`
- `WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED=true`
- `WORDSKY_LIFE04_TOPIC_WRITE_APPROVED=true` (separate topic-specific human gate)
- `WORDSKY_PREVIEW_DATABASE_URL`; the independently verified `WORDSKY_PREVIEW_EXPECTED_HOST`, `WORDSKY_PREVIEW_EXPECTED_DB` and `WORDSKY_PREVIEW_EXPECTED_ROLE`
- Explicit `node scripts/register-life04-topic.mjs --write-preview`

Pre-connection target guard rejects CI remote writes, declared Production environments, known Production connection aliases and mismatched host/DB/role; post-connect query checks `current_database()` and `current_user`. A matching host alone is not proof of Preview isolation. Without trusted provenance, **do not perform any write**.

## Transaction and rollback semantics

1. SERIALIZABLE BEGIN and a 3-second transaction lock timeout.
2. Verify DB name and role; advisory-lock the normalized topic.
3. Refuse duplicate/alias titles, already enabled topics or any linked word/round.
4. Insert **one disabled empty topic**, or re-use the identical existing disabled empty row (idempotent).
5. Commit only after all restrictions pass. On error, ROLLBACK. No word import, SRS change, game exposure or user-record mutation.

CI integrates a rollback-only real local PostgreSQL17 test after existing browser account/SRS checks; tests validate the dry-run and reject fake reviewer fields, wrong group quota, improper target, enabled topic and occupied topic.

## Release gate remaining

Independent human bilingual content verification; CEFR per-sense checks for 86 inferred entries; synonym and answer-ambiguity policy; vetted Admin authorization changes; a separate content importer that preserves word UUIDs and SRS; catalog deduplication vs Production; backup and rollback rehearsal. An inactive topic **must not be enabled** before a separate release authorization.

**Do not merge until PR #91 has been merged and this PR's CI is green on the exact final diff.**
