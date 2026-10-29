# UX27 — Học lại từ sai sau game Solo

## Current state / Source of truth
- App DB: PostgreSQL `ws_solo_runs` is already durable and has nullable `user_id`, `state jsonb`, `status`, and `finished_at`.
- SRS SoT: `ws_learning_review_requests` + `ws_learning_flashcard_reviews` + `ws_learning_word_progress`; SRS uses existing review policy. **A game mistake is not an SRS review**.
- UX04 already provides Solo end-of-run score summaries but **does not** currently identify wrong words.
- UX27 uses the `state.wrongWordIds` JSONB array in existing runs; **no new migration, no production table writes from CI**.

## Scope for this PR
1. **MATCH Solo**: mark the selected English word when the player picks a mismatched Vietnamese option. Repeated attempts within one run are deduplicated. A word remains in the list even if subsequently matched correctly.
2. **BOMB Solo**: mark actual exploded bombs with known server-side word IDs. Auto-typed guesses without a matching bomb are not counted as errors. Do not mark bombs that have not spawned.
3. **CAR Solo**: mark the selected safe-lane word when a manually selected lane gets an incorrect typed answer. Auto-check guesses, blocked lanes and timeouts have no unambiguous target word, so do not manufacture one.
4. The **terminal run** includes `reviewWords` (English, Vietnamese meaning, topic, optional CEFR/IPA), but only after run authorization and terminal reconciliation. **Never reveal those answers while PLAYING**.
5. `GET /api/learning/game-mistakes`: signed-in learner only; actor is taken from the WordSky session, not supplied query or request body. Aggregates completed Solo run JSONB (up to 200 most-recent distinct words) and current actual review_count, excluding disabled vocabulary. Guests cannot use the account notebook.
6. `/mistakes.html`: synced account notebook, search/mode filters, link from My Learning and Solo results. **"Cần ôn ngay"** explicitly calls existing idempotent `POST /api/learning/reviews` with `remembered:false`, `expected_review_count` and `expected_actor_id`. Do not update SRS on gameplay automatically.

## Known boundaries
- Only Solo `MATCH`/`BOMB`/`CAR` for games started **after release**; old runs cannot be accurately reconstructed.
- Only runs started while authenticated are automatically synchronized across the user's browsers. Anonymous runs are still visible immediately after a terminal result in their authorized browser, but are not auto-assigned to an account later.
- Multiplayer rooms and Falling Words are intentionally not included.
- Stored numbers represent the **count of runs containing a wrong word**, not raw failed keystrokes.
- Only identifiable mistakes are saved. CAR timeout / obstacle penalties and BOMB incomplete guesses are deliberately excluded. 
- A lost HTTP response can be retried with the same request_id while the notebook page remains open; refreshing after an uncertain request requires reloading current state first.
- No changes to Session Secret, token logic, leaderboard, XP, or DB migrations.

## Regression / security checks
```sh
npm run check
npm test
# With isolated DB and local server in GitHub Actions:
node scripts/ux27-local-integration.mjs
```

Local E2E creates two disposable accounts and synthetic finished Solo runs **only in a CI-local PostgreSQL 17 database**, checks same-account cross-browser visibility and isolation across accounts, verifies per-run owner authorization, and confirms that an explicit Need Review writes the existing idempotent ledger once. All QA data is deleted afterward.

## Release gates
- [ ] Unit / integration / browser CI green.
- [ ] Preview is isolated from Production database; do not bypass preview DB guards.
- [ ] Manual mobile: results show accurate Vietnamese meanings after end, no answers leaked while PLAYING, page readable at 360px, logout/login changes the correct account.
- [ ] Review schema already present and authorized for launch; **no migrations required**.
- [ ] Production deployment by reviewed PR merge only.
