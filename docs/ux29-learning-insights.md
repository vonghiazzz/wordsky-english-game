# UX29 — Learning Insights (Read-only learning effectiveness)

## Product decision
Embed one compact **Learning Insights** area in existing \`/progress.html\` (My Learning).
Do **not** add a new nav item, page or "Luyện từ" button. UX28.1 already made
My Learning the single home for studying.

Learners can inspect **7 or 30 recent Vietnam-calendar days** of:
- Daily accepted Flashcard/practice review events (both shared and personal).
- Daily completed MATCH/BOMB/CAR Solo counts, split by game mode.
- Number of active days with at least one review event or finished Solo run.
- Share of review events marked "Đã nhớ", explicitly **not quiz accuracy**.
- Current \`remembered=true\` and \`remembered=false\` active vocabulary
  snapshot across the account, separately from the 7/30-day activity window.
- Up to eight **currently needing review** words with the most
  \`remembered=false\` events in the selected window.

All metrics are read from PostgreSQL at request time. There are no fabricated
streaks, mastery probabilities, skill levels, or personalized scores. Nothing
is persisted by analytics GET requests.

## Source of truth and semantics
- \`ws_learning_flashcard_reviews\`: historical shared vocabulary events.
- \`ws_personal_card_reviews\`: historical private vocabulary events.
- \`ws_learning_word_progress\` and \`ws_personal_card_progress\`: *current*
  last-marked states. Disabled catalog words and deleted personal words
  are excluded from the current-state counts.
- \`ws_solo_runs\`: finished, account-owned Solo matches. Guest runs and
  still-playing runs are excluded. Only count them; game correctness has
  different metrics from Flashcard and is not mingled with review decisions.
- Existing UX23 ledger/SRS and UX27 auto-review feed the **same** history
  tables, so they appear naturally without duplicating events.
- This dashboard intentionally does **not** depend on the feature-gated UX24
  SRS queue being enabled. The SRS release gates remain unchanged.

**Interpretation:** \`remembered=true\` is the user's selection or
a learning-flow event, not objective measurement of spelling correctness.
UX27 game-driven misses are included as "Cần ôn" decisions. Therefore the
"Đã nhớ %" card says "tỷ lệ lượt đánh dấu nhớ" and never "accuracy".

## API/security
\`GET /api/learning/insights?days=7|30\`

- Must be a logged-in player; \`actor_id\` comes from the server session,
  never query or body. \`days\` only permits "7" or "30".
- SQL runs in \`REPEATABLE READ READ ONLY\` transaction with one
  \`transaction_timestamp()\`/Vietnam-local \`today\`. Date filtering is
  inclusive from today-(days-1) through today, and bounded to the snapshot.
- All source queries contain \`user_id=$1\`; all word joins enforce account
  ownership/active vocabulary. Never expose hidden/deleted personal cards.
- Use existing \`no-store\` JSON response; the browser verifies
  \`actor_id\` and rechecks \`auth/me\` after receipt, then discards stale
  results on actor change or period change.
- Read-only, indexed historical queries; no new migrations, environment
  secrets, cron jobs, jobs, user progress resets or materialized reports.
- Scope: current account only; no leaderboard or cross-user ranking.

## Empty states and privacy
- Guest: no analytics panel and HTTP 401 for the API.
- User with no review history: 0 daily bars, 0 activity days and **—**
  for "Đã nhớ %" (no denominator).
- A historical word marked "Cần ôn" is shown in the focus list only if
  it is **still** marked \`remembered=false\` in account progress.
- User B never sees user A's personal vocabulary or history, even if the
  request adds \`user_id\` to its query.
- No "true recall" or "accuracy" claim is inferred from the game review flags.

## CI and release gates
1. Syntax + unit tests for strict window validation, UTC/Vietnam date span,
   zero denominators, mixed data, unauthorized actor and script XSS safety.
2. PostgreSQL17 E2E + Chromium/Firefox at 360/390px: account/guest isolation,
   shared/personal review aggregation, finished Solo grouping, 7/30 switch,
   mobile chart scroll, cross-device updates and actor switch.
3. Confirm E2E cleanup removes all disposable QA accounts.
4. Vercel Preview READY at exact tested head; merge only after CI success.
5. Production: verify commit/alias and read-only logs. No Production SQL
   or live account writes for deployment smoke checks.
