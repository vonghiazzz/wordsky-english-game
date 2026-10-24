# WordSky Phase 2.3 — CAR Solo (local implementation)

## Routes
- Browser: `/#solo-car` (desktop or mobile, including the existing compact keyboard).
- Start: `POST /api/solo/car/start` with `topic_id`, `difficulty` (EASY/NORMAL/HARD), `question_count` (3–30), `duration_seconds` (20–600 and at least 8 seconds/stage).
- Guest/session/retry: existing GET `/api/solo/runs/:id`, POST `/api/solo/runs/:id/answer` with `{attemptId,lane,answer}`, and GET `/api/solo/runs/:id/attempts/:attemptId`.

## Gameplay
- Reuses `createState`, `reconcile`, `answerQuestion` and `publicState` for CAR from `lib/game.js`. Five lanes; approved CEFR only. Each stage defaults to 8 seconds and cannot advance until the 1.2-second readiness interval.
- Normal lane +100, bonus lane +150, double lane +200; wrong translation costs 25 points (no stage advancement), hitting obstacle or missing a deadline costs one heart.
- The answer never leaves the server until it is validated. Retry receipts preserve idempotency under JSONB key reordering. Solo does not modify tournament runs, XP, attendance or leaderboard.
- The data query is shared with multiplayer CAR; it selects unique English words and requires capacity per tier (`carWordRequirements`, `carMissingWords`) before inserting the Solo run. Selecting a topic with inadequate stock returns HTTP 409; the chosen difficulty is not downgraded.

## Migration and release safety
- `db/migrations/20261024_110000_car_solo.sql`: additive only, expands `ws_solo_runs_mode_check` to `MATCH`, `BOMB`, `CAR`. Validates the constraint and preserves RLS. No new tables or index rebuilds.
- Run only on the **local** database first. After verifying, migrate isolated Supabase Preview and run UI/API UAT before Production. Do not apply to either Supabase remote automatically.
- Existing `.gitignore` and `preview-v6/` are intentionally excluded from the patch.

## Validation
`npm run check` → `npm test` → `bash dev/wordsky-v6-test/local-db.sh test` (needs local Docker/OrbStack). Confirm `LOCAL E2E PASS` and status row preservation, then test mobile/desktop Preview.
