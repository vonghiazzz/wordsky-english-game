# UX43C — Isolated opt-in typed recall (Preview-only pilot)

**Status:** Candidate implementation. Not Production-ready. Do not deploy
or migrate the Production Supabase database, and do not collect real users'
research data until opt-in/privacy and adult/guardian eligibility are reviewed.

## Scope and user flow

Users can directly open `/recall.html` on an approved QA/Preview deployment.
This is separate from all existing game and SRS navigation; do not add a
second "Luyện từ" button under My Learning or duplicate anchors in game
results. The shared header and bottom dock remain unchanged.

1. Logged-in, valid WordSky player session required; guests and Admins do not
   receive account data. Server checks signed/versioned session on every
   request, then **locks the actor row and rechecks session_version** before
   any write.
2. Player explicitly opts in to the QA trial. The consent screen explains
   minimal recorded data, the independence from "Đã nhớ" and SRS, and
   withdrawal. No auto-enrollment on login or from a finished Solo run.
3. Server selects ONLY an active and manually approved shared card from
   `ws_recall_curated_prompts`. An Admin must curate each Vietnamese prompt
   and English variant list; a CEFR flag alone is not evidence of adequate
   prompt/answer curation. No automatic curation from 365-word catalog.
4. Show Vietnamese meaning only; learner types English, without hints.
   Server checks a pinned snapshot of the approved answer keys using the
   UX43B exact-match grading contract. Incorrect English is a single typed
   attempt outcome, **never an automatic "Cần ôn" SRS review**.
5. Each trial may be submitted exactly once. A duplicate network request
   with the same `request_id` returns the **same** result without a second
   evidence row. A second request ID receives HTTP 409. One account is
   limited to 25 issued trials in 24h, each with 4-minute expiry.
6. The player can withdraw via an explicit checkbox and DELETE action;
   all this account's trials and evidence disappear together through
   `ON DELETE CASCADE`. Consent remains optional and isolated.

The current app's public vocabulary catalogue is still visible on
separate pages. **Therefore, hiding the answer in this one panel is NOT
proof that the participant did not consult another tab.** For research,
this is a controlled prompt-format prototype, not a cheat-proof
standardized retrieval experiment or a retention measurement.

## API contract (never enabled in Production)

All routes under `/api/learning/recall/` are gated with
`WORDSKY_RECALL_PREVIEW_ENABLED=true` AND
`VERCEL_ENV !== production`. In Production they return 404 regardless
of flag value.

```
GET    status  -> pilot, consent_active, curated_prompts, schedule_unchanged
POST   consent -> expected_actor_id, agree:true, consent_version
DELETE consent -> expected_actor_id, confirm_withdraw:true
POST   trials  -> expected_actor_id; returns trial_id, Vietnamese prompt, expiry
POST   submit  -> expected_actor_id, trial_id, request_id, response
```

For every POST/DELETE, the Origin header must exactly match either
the configured local `APP_ORIGIN` or the Preview deployment URL.
The existing global same-origin check remains unchanged for all
other APIs. The client **cannot send correctness, consent metadata,
answer keys, hint flags, timing or owner IDs for grading**.
`expected_actor_id` is only an additional anti-account-switch pin;
the session cookie is the source of identity.

The server derives `server_submitted_at` from PostgreSQL
`clock_timestamp()`; issues a private UUID per trial; uses the
UX43B `prepareTypedRecallTrial` / `gradeTypedRecallTrial` in
server-side memory **rehydrated from database-owned snapshots** at
submission. It does not depend on a WeakMap surviving a serverless
cold start. It returns only `correct`, `trial_id` and replay flags.

## Data model and authorization

Additive isolated migration:
`db/migrations/20261031_ux43c_typed_recall_pilot.sql`

- `ws_recall_curated_prompts`: manually approved, versioned word
  meanings and accepted answer variants; **inactive by default**.
- `ws_recall_consents`: one opt-in row per WordSky account. Withdrawal
  deletes it and cascades to all this person's records.
- `ws_recall_trials`: private answer-key snapshot, issue/expiry and
  single-submission outcome/idempotency receipt. A private snapshot is
  necessary because curation can change after a prompt is served.
- `ws_recall_evidence`: first-attempt, opted-in, unassisted graded
  outcome; unique by account/request and by trial, no typed response text,
  no game score or password, no SRS fields.

All four tables have RLS ENABLED and **explicit REVOKE from PUBLIC,
anon and authenticated**; no Data API policies are granted. WordSky
still uses its own signed HttpOnly account cookie and privileged,
server-only PostgreSQL connection. The new tables use foreign keys
to `ws_users`, `ws_words` and each other for deletion and owner
isolation. No Supabase Auth JWT is used to authorize WordSky users.

Future Admin curation UI, consent revocation history, pseudonymization
or retention policies require separate governance work. The QA pilot
does not expose the private evidence table via a public account API.

## QA and release gates

- `npm run check` and `npm test` cover Feature Gate fail-closed,
  Owner/session/Origin checks, replay constraints and RLS/no-grants
  migration contract.
- GitHub CI applies the additive migration **only** inside its
  PostgreSQL17 disposable service on 127.0.0.1:5547, then sets
  `WORDSKY_RECALL_PREVIEW_ENABLED=true` for isolated browser QA.
  The E2E test creates two QA accounts and a **synthetic curated
  vocabulary prompt**, tests Chrome 360px and Firefox 390px, retries,
  cross-account isolation, nonconsent, wrong attempts, withdrawal and
  no SRS/XP changes. It cleans all QA records afterwards.
- Existing UX40/41 auth and UX24 SRS smoke tests remain green.
- No new Vercel build until the complete GitHub CI is green.
- A live Preview would require **separate approval of the migration
  target and privacy wording** and verification that its database is
  isolated from Production. Do NOT apply migration through a
  Production Supabase project.
- No Production code release until the owner separately approves
  releasing and disabling the experimental route. Even merged code
  has a hard Production fail-closed guard.

## Research interpretation

This proves the *engineering* of a typed retrieval attempt, not a
valid long-term retention estimate. Without sufficient real consented,
independent assessment, no offline claim of "SRS v2 is better" is valid.
UX43D would define standardized prompt curation, eligible participants,
withdrawal/privacy retention controls and a time-forward held-out
evaluation before any algorithm comparison or randomized scheduling.
