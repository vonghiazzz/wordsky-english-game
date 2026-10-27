# UX-22 — One-confirmation legacy Flashcard sync (2026-10-27)

## Product contract
One user confirmation migrates ALL eligible device-only Flashcards (not one click per 20 words). The browser automatically sends bounded API chunks of at most 20 cards, with progress indicator. PostgreSQL is the sole authority for authenticated learning progress. User-owned personal words and shared vocabulary remain separate catalogs.

## Why bounded chunks still matter
- One confirmation; a background loop in the **active browser tab**, not a scheduled/background job.
- One endpoint POST /api/learning/import/legacy/batch with at most 20 cards and up to 96,000 characters of request body.
- Backend validates every card before writes and executes the entire chunk inside ONE transaction with an owner-scoped row lock. A failed chunk rolls back together.
- Completed chunks stay committed and are safe to retry. Client reports completed/total; a network error stops the loop, displays the partial result, and allows restarting from authoritative fresh data. No need for repeated confirmations under normal operation.
- Existing UX-21 individual legacy endpoint continues to work. No schema changes needed.

## Reconciliation and ownership
- The importer checks exact topic, English, IPA, meaning, example and translation against the shared catalog and account-personal cards.
- Exact existing match uses the canonical UUID. New cards become personal; changed or ambiguous cards are skipped for manual review.
- A prior true or false account decision is preserved. Conditional progress inserts make resubmission idempotent and prevent duplicate review-history events.
- Every import uses mustPlayer(req).id; optional expected_actor_id mismatch returns 409 before mutation.
- Browser localStorage is read but NEVER overwritten or deleted. A fresh catalog + device snapshot preflight is required after explicit confirmation.
- Guest 401; >20 cards 400; malformed cards 400; bulk endpoint body limit 96k, unlike other API endpoints' 16k standard limit.

## QA evidence
- Application commit a03a440a2eb0acfa97ea218a6b3fed815c40f640: npm run check PASS, npm test **320/320 PASS**.
- Chromium + actual Supabase Preview PostgreSQL **16/16 PASS**, using 260 mixed QA cards. 258 eligible actions were automatically processed with exactly **one** confirmation. 257 genuinely new words were inserted into the personal library; one exact shared card reused; one changed-meaning card and one prior remembered=false decision were safely skipped. Second browser logged into the same player and saw identical aggregate. Device localStorage JSON remained byte-identical. Repeated 2-card chunk created zero new cards/history.
- Live Preview endpoint security **7/7 PASS**: guest blocked 401, mismatched actor 409, 21 cards rejected 400, invalid second card rejected 400 and no writes, repeat import idempotent.
- **Actual built-in default WordSky browser deck** (260 cards): read-only comparison found **260/260 shared catalog matches**, 0 additional personal cards proposed. Then on a separate QA account with 10 local remembered marks, Preview browser QA **9/9 PASS**: one user confirmation transferred precisely 10 shared review decisions, My Learning showed **10/365**, and 0 personal cards created. Original local flags were unchanged.
- Total live Preview E2E/security checks: **32/32 PASS** plus the read-only built-in deck inspection.
- All UX-22 temporary QA accounts were removed from Preview by exact ID and username, cascading owned test data.

## Known limits
- UI needs to remain open during the loop; a closed tab stops further chunks, but completed chunks are idempotently resumable on next login/confirmation.
- This is not an asynchronous background job, does not imply offline sync, and does not migrate different localStorage keys such as wordsky_server_learned_v1.
- Conflict/ambiguity counts remain informational; user must resolve changed content manually.
- For very large legacy decks, 5,000-card existing maximum and per-account card cap remain. The current feature is primarily for the built-in 260 and small user customizations.

## Release controls
- Preview only. No Production migrations, data writes or main merge in this task.
- Keep PR Draft pending user acceptance of UX-22 Preview and reviewed branch changes. Do NOT auto-merge.
- Before Production release: verify existing users' data, 365 shared words, RLS, per-account progress, and multi-device consistency. No schema update required.
- Subsequent work: standardize Learning Service and history, then plan SRS and game-derived evidence separately.
