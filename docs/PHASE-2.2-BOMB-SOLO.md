# Phase 2.2 — BOMB Solo

## Local play

1. Configure the normal local `DATABASE_URL`, `SESSION_SECRET` (at least 32 characters), and `APP_ORIGIN` values.
2. Initialize the isolated local database with `bash dev/wordsky-v6-test/local-db.sh init`, or apply `db/migrations/20261024_100000_bomb_solo.sql` to an existing non-production development database.
3. Run `npm run dev`.
4. Open `http://localhost:3000/#solo-bomb`, choose a topic, difficulty, bomb count, and duration, then start.

The preset timings are owned by `lib/game.js`: EASY is 20 seconds/2 bombs/10-second wave cadence, NORMAL is 16/2/9, and HARD is 10/3/6. The API rejects a total duration that cannot contain the last complete wave.

## API contract

### `POST /api/solo/bomb/start`

Request:

```json
{"topic_id":null,"difficulty":"EASY","question_count":8,"duration_seconds":90}
```

The response has status `201` and contains `{ runId, round, game }`. `game.bombs` contains only the Vietnamese meaning and server timing metadata; it never contains the English answer. Guests receive the signed, browser-scoped `ws_solo` HttpOnly cookie. Starting another run reuses the same guest identity.

### `GET /api/solo/runs/:runId`

Returns the current server-authoritative MATCH or BOMB state after reconciling deadlines. Ownership is checked from the signed guest cookie or the logged-in player session.

### `POST /api/solo/runs/:runId/answer`

BOMB request:

```json
{"attemptId":"<uuid>","answer":"english word","auto":true}
```

The client retains the same `attemptId` and normalized answer until the result is known. The server locks the run row, records one receipt, and returns the saved result for an identical retry. Reusing an attempt ID with different content returns `409`. The server throttles automatic guesses and does not accept a client-selected `bombId` for BOMB Solo.

### `GET /api/solo/runs/:runId/attempts/:attemptId`

Returns `attempt.applied` plus the current public state. The browser uses this before retrying an answer whose original response was lost.

## Persistence and isolation

- MATCH and BOMB share `ws_solo_runs`; BOMB does not write `ws_runs`.
- Solo does not update XP, streaks, attendance, tournament participants, or leaderboards.
- `db/migrations/20261024_100000_bomb_solo.sql` expands the existing checks to `MATCH`/`BOMB` and 3–30 questions without replacing the table or rewriting MATCH rows.
- RLS remains enabled and direct Data API access remains governed by the existing Phase 2.1 migration policy.
