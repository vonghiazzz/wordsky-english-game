# UX33 — Ma trận thẻ (MATRIX Solo)

## Scope

New standalone WordSky Solo game at `/matrix.html`, linked from Game Library
and the shared Games navigation. This feature is **NOT** enabled on Production
and must not be deployed merely by merging this development PR.

### User rules

- All tiles are face-up. A tile has **one** label: English **or** Vietnamese,
  never both. Each pair has exactly one EN and one VI tile.
- Presets: **8×8 = 64 tiles / 32 pairs / 10 minutes**,
  **12×12 = 144 tiles / 72 pairs / 20 minutes**,
  **16×16 = 256 tiles / 128 pairs / 30 minutes**.
- The player chooses one EN and one VI tile. Matching is graded on the server.
- Correct: **+100** points, matched tiles become inactive.
- Wrong: **−25** points (score never below zero), minus one heart.
  There are exactly **3 hearts**; losing the third immediately fails the run.
- Other terminal conditions: all pairs matched (COMPLETED) or timer expired (TIMEOUT).
- Each run uses the currently enabled server vocabulary from all 26 topics.
  There are currently more than 128 distinct bilingual pairs in production,
  but a single topic has fewer than the 32 required by the smallest grid.
  Topic filters and multiplayer rounds are excluded from UX33.
- The board scrolls horizontally/vertically on narrow screens. Text uses a
  readable minimum tile size rather than shrinking the entire 16×16 board.
- Music and correct/damage/win/lose effects reuse original Web Audio synthesis.
  Playback requires a user interaction and honors WordSky's existing volume,
  music, and effect settings.

## Server ownership and learning integration

- All game state, mapping and scoring remain in `ws_solo_runs.state` JSONB.
- Each visible tile gets a random UUID. The public state includes only
  `{id,label,lang,matched}`; it never exposes the paired tile ID, actual
  vocabulary word ID or hidden mapping.
- The server selects a unique English and a unique Vietnamese label per pair,
  avoiding ambiguous duplicate faces.
- An attempt is idempotent through `attemptId`. The client stores only run ID
  and in-flight attempt IDs in per-tab sessionStorage; it checks receipts
  before retrying the same attempted pair.
- The three existing Solo endpoints are reused to read runs and submit answers:
  `GET /api/solo/runs/:runId`,
  `GET /api/solo/runs/:runId/attempts/:attemptId`, and
  `POST /api/solo/runs/:runId/answer`.
  The only new game endpoint is `POST /api/solo/matrix/start`.
- Wrong attempts record both identifiable underlying words in
  `wrongWordIds`; at game end signed-in learners use the existing
  `syncFinishedSoloReview` idempotent path to My Learning / SRS. Guest runs
  cannot sync without an account. Correct answers do **not** auto-mark words
  remembered.
- No XP or multiplayer leaderboard changes.

## Database and rollout

`db/migrations/20261030_ux33_matrix_solo.sql` extends only Solo CHECK
constraints and inserts the `MATRIX` feature with **enabled=false**.
It does not rewrite existing Solo runs or learning progress. Production
currently uses a three-mode Solo constraint so **migration must run before**
new code or attempting MATRIX creation.

Required gates:

1. Develop in `feature/ux33-matrix-cards-solo`; keep auto-Vercel deploy off.
2. Run Node checks, unit tests, isolated PostgreSQL 17 integration tests,
   plus browser QA covering desktop and mobile board interactions.
3. Apply migration only to isolated Preview first and explicitly turn on the
   Preview feature; verify 8×8, 12×12 and 16×16, 3-heart failure, resume,
   idempotent duplicate answers, wrong-word auto enqueue and original music.
4. Prepare a reviewed release candidate; run exact-SHA CI.
5. Before Production migration, take a *fresh* encrypted backup and verify
   an isolated restore; compare user/progress/SRS counts.
6. After explicit Production approval, apply migration with feature OFF,
   stage a single Production build without alias, test, then promote.
7. Only enable `MATRIX` on Production after post-deploy verification and
   user acceptance. Existing MATCH/BOMB/CAR remain unchanged.

## Acceptance checks

- Every grid is square and has 50% EN and 50% VI faces; labels are unique.
- Selecting two of the same language does not silently deduct a heart.
- Attempt replay with the same UUID is idempotent; reuse with different tile
  IDs is rejected; invalid/unowned run accesses fail.
- A wrong selection reduces score by 25 and hearts by one, max three wrong
  attempts. Two mismatched word IDs are remembered only server-side.
- Scroll position persists while the grid updates. Keyboard focus styling,
  live scoreboard, motion preferences and mobile responsiveness work.
- Audio does not autoplay; only original procedural tracks are used.
- Preview tested before merge; Production remains untouched by this PR.
