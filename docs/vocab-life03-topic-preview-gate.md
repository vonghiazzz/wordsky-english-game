# LIFE-03 — Social Relationships inactive-topic gate

This is a developer safety gate, not a Production vocabulary release. LIFE-03 has 100 editorial proposals, but only **50** belong to the new topic `Social Relationships - Quan hệ xã hội`; the other 50 map to the existing Family and Feelings topics. **All 100 remain `PROVISIONAL`.**

The current WordSky Admin API creates new topics with `enabled=true` by default. Do not use it for unapproved subjects. Instead, the proposed new topic must remain **disabled, empty, and hidden** until content review and a separate release.

## Safe commands

Default dry-run (no environment variables, passwords or DB connection):

    npm run vocab:topic:plan:life03
    # equivalent to: node scripts/register-life03-topic.mjs

Local isolated PostgreSQL only (manual explicit operation):

    WORDSKY_TEST_DATABASE_URL="postgresql://wordsky_test:LOCAL_TEST_PASSWORD@127.0.0.1:5547/wordsky_v6_test" \
      node scripts/register-life03-topic.mjs --write-local-test

The test runner uses a *rollback-only* SQL transaction, so no topic remains after CI.

Optional Preview write **must not be executed without explicit user authorization** and independent verification of the Preview DB host, database and role. Both `WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED=true` and the **additional topic-specific** `WORDSKY_LIFE03_TOPIC_WRITE_APPROVED=true` are required, along with:

- `WORDSKY_TARGET_ENV=preview`
- `WORDSKY_PREVIEW_DATABASE_URL` and independently verified `WORDSKY_PREVIEW_EXPECTED_HOST`, `WORDSKY_PREVIEW_EXPECTED_DB`, `WORDSKY_PREVIEW_EXPECTED_ROLE`
- Explicit `node scripts/register-life03-topic.mjs --write-preview`

The target guard rejects Production mode, remote Preview writes in CI, mismatching database identities and connection-string aliasing to known Production DB URLs. No credentials or connection strings are committed or logged. Failing to prove that a database is isolated Preview is a blocker; a hostname comparison alone does not independently prove isolation.

## What happens in an authorized test transaction

1. Validate LIFE-1000 plan and LIFE-03 100-entry batch with cross-batch uniqueness and 4 groups × 25.
2. Verify exactly 50 friendship/gatherings entries are *proposed* for the new topic; all records remain `PROVISIONAL`. No fake reviewer fields.
3. Verify PostgreSQL `current_database()` and `current_user`, lock the exact normalized topic title, and reject aliases or an enabled existing topic.
4. Insert `ws_topics(title, enabled) VALUES($1, FALSE)` or reuse an existing same-title, disabled, empty record. Reject linked words or rounds. Never insert vocabulary or change scoring.
5. CI tests disabled/invisible state and idempotency, then **ROLLBACK** and verify no topic persisted.

## Release boundaries

Before any real Production catalog changes: bilingual editor review (Vietnamese synonyms, ambiguous family relationships, phrase IPA and CEFR at exact senses); Admin/API gate; topic importer allowlist with independent reviewer authorization; Production catalog reconciliation including account-owned progress; Preview tests; backup and rehearsed rollback.

**This PR does not update Production, deploy Vercel, approve CEFR or enable a topic.** GitHub merge only adds the tools/tests.
