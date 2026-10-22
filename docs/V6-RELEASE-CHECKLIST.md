# WordSky Arena V6 — Release hardening checkpoint (2026-10-21)

## Scope

- Keep existing **26 topic identities** and all 260 original words.
- Lane Escape: obstacle costs a heart without an English word; ordinary uses A2; ⭐ uses B1/B2; ×2 uses C1/C2. Answers validated by backend.
- Physical **carLane** is stored server-side, distinct from the frontend `selectedLane` target. Selecting a target **does not** move the car. A server-confirmed correct translation updates carLane and triggers a ~400 ms lane-change animation (respects reduced motion) before the next stage renders. Wrong word and blocked collision do not move the car.
- Bomb falls in **two wider tracks**, showing the **entire Vietnamese prompt**. English solution remains server-secret.
- CEFR import can safely add new approved words **or approve existing seed words** when topic, English and meaning all match; preserves original word, meaning, IPA, example, translation. Conflicting meanings / previously-approved labels cause a full transaction rollback. Does not create new topics; rejects OPEN/LIVE dependent competitions.

## Vocabulary source and review truth

- `vocab/cefr-provisional.json` / CSV: 117 **AI proposed** words, now represented in all **26** original topics (90 earlier + 27 additions). These are **not Cambridge-verified** and all have `PROVISIONAL` status.
- `vocab/cefr-review-all-topics.json` / CSV: all **377** review queue records, including **260 original WordSky words UNREVIEWED, CEFR level null** (no guessed labels) and **117 candidates PROVISIONAL**.
- The complete review queue includes blank part-of-speech and source/review fields for human completion. Cambridge CEFR varies by *meaning/sense*, not just spelling. Current V6 DB holds a single label per existing word record; words with multiple senses need explicit editorial resolution before approval.
- To approve any real word, carefully verify its *specific sense*, IPA, difficulty and examples with appropriately licensed references (such as Cambridge Dictionary). Enter `review_status=APPROVED`, confirmed `level`, `reviewed_by`, `reviewed_at` ISO date, and HTTPS `source_url`. Never automatically copy Cambridge copyrighted definitions/examples at scale without a license.
- Importer only applies **APPROVED**, ignores UNREVIEWED and PROVISIONAL. All sample words remain unapproved.
- `node scripts/audit-cefr-coverage.mjs`: per-topic approved/provisional counts and minimum stock for NORMAL 3/12 stages; by design **0/26 topics are ready right now**, until a person approves reviewed words.
- A Normal 3-stage Car needs >= 3 A2 + 3 B1/B2 + 3 C1/C2 approved words in its selected topic; Normal 12-stage needs >= 12 in each tier (36 distinct approved words) in its selected topic. Global mode combines topics and deduplicates words.

## Local repeatable verification (user's Mac)

```sh
npm run check
npm test
node scripts/import-cefr-approved.js
node scripts/import-cefr-approved.js --file=vocab/cefr-review-all-topics.json
node scripts/audit-cefr-coverage.mjs
bash dev/wordsky-v6-test/local-db.sh test
python3 scripts/qa_v6_ui.py
python3 scripts/qa_car_motion.py

git diff --check
```

**Local DB:** `127.0.0.1:5547 / wordsky_v6_test`; test-only fixtures are fake approvals and never appropriate for Production.

## Rollout gate: one Supabase Production database

1. Verify Git branch and preserve the pre-existing `.gitignore` edit; stage only reviewed source files. Avoid `git add .`.
2. Run local E2E with updated importer; demonstrate **existing-word approval update** with a separately marked local test review record, verifying original meaning/IPA/example unchanged and no duplicate row.
3. Human CEFR review; import **only** signed-off APPROVED entries. If not enough approved words for intended rooms, do **not** release Car to users. Expand and review the curriculum instead of silently using easy words.
4. Take and validate a recoverable backup of Production; list its current tables, columns and counts; verify zero pending LIVE/OPEN game impacts. Confirm migration is additive (two columns, checks, index) on a local clone.
5. Apply vetted `db/migrations/20261021_150000_wordsky_cefr_review.sql` to the *existing* Supabase database only during a controlled maintenance window. No second permanent Production database is required. Verify 26 topics / 260 existing words remain, review statuses UNREVIEWED, and API connects.
6. Insert only real approved words after a dry run and backup. **Never** ship the 12 fake-approved local test words or any `test_only=true` fixture.
7. Push reviewed feature branch; test Preview with safe DB compatibility, admin create/join/start, keyboard (desktop/mobile), Bom/Car and visible scores. Never direct Preview at incompatible Production schema.
8. After all release checks pass, merge PR into `main`, verify Vercel Production deployment and error logs; prepare rollback. Keep local test DB for regression testing (or stop container, don't delete data without permission).

## Current status

Local tests and browser simulations passed in the build environment. No remote Production database was mutated, no unreviewed vocabulary was approved, and **no merge or Production deploy was performed**. Running live DB E2E / device UAT and approval of real CEFR senses are required gates, not optional.
