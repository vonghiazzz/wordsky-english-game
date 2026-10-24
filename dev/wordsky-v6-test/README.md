# WordSky Arena V6: test database on your Mac (no cloud project)

The **only production database remains the existing Supabase database**. This kit creates an isolated, disposable PostgreSQL 17 container on your Mac bound to `127.0.0.1:5547`. It does **not** create a Supabase project and never touches production data. It keeps the original 26 topics. This is **not** a new 27th "CEFR" topic.

## Before running

- Install or start OrbStack / Docker Desktop; run `docker compose version`.
- Make sure port `5547` is free on your Mac.
- In `~/Downloads/wordsky-english-game`, stay on `feature/solo-bomb-phase2-2`.
- `npm ci` if `node_modules` is missing.
- Don't use any production `DATABASE_URL` or Supabase password; the runner supplies its **own fixed localhost-only URL**.

## Setup and true Postgres + API tests

From the repository root:

```bash
npm run check
npm test
bash dev/wordsky-v6-test/local-db.sh test
```

`test` performs:

1. Starts a **dedicated** PostgreSQL 17 container and waits for health.
2. Applies `db/schema.sql` and all V6/Solo additive migrations, including BOMB Solo, to this local DB.
3. Seeds **26 original topics + 260 original words** into local DB.
4. Creates 12 temporary **FAKE-approved test-only** CEFR cards (from draft terms); this is NOT vocabulary approval.
5. Adds 12 fake-approved words to existing topics without creating any new topics.
6. Runs real HTTP API + PostgreSQL smoke: MATCH and BOMB Solo guest start/ownership, hidden answers and concurrent idempotency, `/api/topics`, admin login, reject insufficient C1 stock, room create/open, player join, start, Car x2 answer wrong vs correct, +200 scoring.
7. Removes temporary test fixture and the test room (keeps local DB & test-only words).

Expected after first test: 26 topics, 272 words (260 + 12 temporary test words), 12 simulated APPROVED **in LOCAL DB only**.

```bash
bash dev/wordsky-v6-test/local-db.sh status
bash dev/wordsky-v6-test/local-db.sh stop
```

`stop` stops ONLY the named local test container; volumes persist. `down` removes the container and network but **keeps the named data volume**, so you can resume. If you later wish to remove all local test data, delete the specific `wordsky-v6-localtest` Docker Compose project volume manually after confirming its name. No cleanup script touches other Docker containers, Production or port 5432.

## Vocabulary review before production

- `vocab/cefr-provisional.json/csv` now contains a proposed **topic** from the existing 26 for each of 90 AI-drafted words.
- All 90 remain `PROVISIONAL`. Do not bulk-change the original draft to `APPROVED`.
- 90 draft words currently cover **17 of 26** topics. The remaining topics need their own suitable reviewed vocabulary; **do not falsely assign C1 words just to fill a quota**.
- Imported test-only fixture is **not licensed or academically certified Cambridge data**. It must never be promoted to production.
- The importer **never creates topics**. It skips words that already exist in the same topic instead of overwriting them.
- Real A1–C2 labels ideally apply to a *sense/use* of the word; current `ws_words` level is a first-stage draft model, not a complete dictionary schema.
- `node scripts/import-cefr-approved.js` is always a **dry run**. Other write modes are guarded and must not be used until the target is validated.

## Single production DB after testing

Once the unit tests, local database tests, real mobile UAT, licensing checks and human review are complete, plan **one reviewed, backed-up migration on the existing Supabase project**. Do not run test fixture/import command against Supabase. There is no automatic merge of local fake approvals into Production. Keep `main` and the existing Supabase DB unchanged until explicit production-release approval.
