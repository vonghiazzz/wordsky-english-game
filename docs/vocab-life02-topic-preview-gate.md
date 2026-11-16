# LIFE-02 — Isolated Preview topic-registration gate

**State:** Code/CI preparation only. This PR does not write to the remote Preview database or Production. No SRS, account, word approval, game or Admin route is changed.

## Why

- `ws_topics.enabled` defaults to true in `db/schema.sql`.
- Existing `POST /api/admin/topics` inserts without `enabled=false`, creating a visible topic immediately.
- Public topic, word and SRS queries filter to enabled topics. Disabled, empty topics stay invisible to ordinary players.
- The CEFR importer still intentionally accepts only the existing 26 seeded/enabled topics; this PR does **not** bypass it.

The proposed title `Everyday Conversation - Giao tiếp hằng ngày` must be added **disabled** on an independently verified, isolated Preview database, not via the existing Admin POST route.

## Behavior

`scripts/register-life02-topic.mjs` defaults to read-only dry-run.

It validates the machine-readable roadmap, LIFE-02's four groups × 25 PROVISIONAL entries, no approved/reviewer fields, and exact duplicate checks against seed, original CEFR drafts and LIFE-01. Before any DB operation, target policy verifies the chosen mode and database identity.

With explicit write mode only, a SERIALIZABLE transaction:

1. Checks PostgreSQL's actual `current_database()` and `current_user` match the independently verified intended target.
2. Takes a transaction advisory lock for the topic title.
3. Checks for a pre-existing topic with the same normalized name. Rejects an enabled topic, alias collision, or any linked words/rounds.
4. Inserts exactly one `ws_topics(title,enabled) VALUES($1,FALSE)`, or safely reuses the same disabled and empty topic.
5. Keeps words=0, rounds=0, approved=0 and enabled=false. **No migration or import of vocabulary**.

## Commands

No environment or DB required (fully offline):

    node scripts/register-life02-topic.mjs
    # or npm run vocab:topic:plan

Pinned local test DB ONLY, if explicitly requested:

    WORDSKY_TEST_DATABASE_URL="postgresql://wordsky_test:LOCAL_SECRET@127.0.0.1:5547/wordsky_v6_test" \
      node scripts/register-life02-topic.mjs --write-local-test

This mode refuses unexpected DB name, user, host or port and refuses Production. CI does not persist anything: it runs the SQL in a transaction and rolls back.

Optional remote Preview write remains **unexecuted in this PR**. Before invoking, independently verify the isolated Preview database, then require the following exact environment variables and the explicit `--write-preview` flag:

- `WORDSKY_TARGET_ENV=preview`
- `WORDSKY_PREVIEW_TOPIC_WRITE_APPROVED=true` — manual, explicit authorization for this operation
- `WORDSKY_PREVIEW_DATABASE_URL` — isolated Preview URL, not any Production URL
- `WORDSKY_PREVIEW_EXPECTED_HOST` — exact independently verified hostname
- `WORDSKY_PREVIEW_EXPECTED_DB` — exact independently verified DB name
- `WORDSKY_PREVIEW_EXPECTED_ROLE` — exact independently verified database role

Remote Preview writes are denied in CI, in Vercel Production, on localhost, when any named Production URL matches Preview, or when the known Production project ID appears. Actual PostgreSQL database and role are rechecked after connection. **Without confirmed Preview provenance, do not use write mode.** No credentials are checked into Git.

## CI gates

- `npm run vocab:topic:plan` must confirm dry-run, 100 candidates, disabled topic and zero approval.
- Unit tests cover target-policy failures, forgery, topic collision, duplicate creation, enabled/occupied-row rejection, and idempotency.
- After the existing isolated PostgreSQL/Chromium/Firefox/SRS browser suite, local DB QA tests one disabled insertion and its idempotent rerun, verifies hidden state in enabled-topic queries, then **ROLLBACKS** and checks no trace remains.
- Existing LIFE-1000 content tests continue unchanged.

## Rollback and production separation

For a future independently authorized Preview write, rollback must inspect for associated words, rounds and references before any deletion. Never perform an unrestricted cascade delete of a topic with users' words or other references.

This PR does not enable LIFE-02, alter `scripts/import-cefr-approved.js`, or approve any phrase. Further PRs are needed for a trusted reviewer workflow, strict-recall alternate-answer policy, new-topic importer, Admin creation restrictions, UI/Preview QA and Production rollout. Git merge does not create a topic or increase live word count.
