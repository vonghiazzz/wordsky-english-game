# UX43B — Data contract for objectively graded typed recall (research only)

**Status:** An offline, opt-in evidence-quality prototype. No UI, API,
migration, feature flag, SRS schedule update, new Production account
data, or deploy. This slice is not a shipping study mode.

## Why UX43B exists

UX43A proved deterministic reconstruction and reconciliation of current
fixed SRS v1, but its historical remembered=true/false labels include
self-reports and automatic Solo "need review" marks. They do **not**
identify whether a learner retrieved an answer without seeing it.
Training FSRS or comparing algorithms as if these labels represented
measured recall would introduce invalid evidence.

The first eligible evidence mode is **Vietnamese meaning → learner types
English**. A curated meaning prompt is shown with the English answer
hidden. The *server-owned* exact accepted-answer set is graded after
the first response. Equivalent case, whitespace, and curly apostrophes
are normalized; there is **no fuzzy spelling, stem matching, implicit
translation expansion, scoring from past game totals, or confidence
guesswork**. A wrong spelling is recorded as an incorrect typed answer,
not automatically a permanently unlearned card.

## Implemented offline contract

`lib/ux43b-recall-evidence.js` has four public functions:

- `prepareTypedRecallTrial`: create a short-lived (up to 5 minutes),
  answer-hidden, curated question. Reject unsupported sources, duplicate
  accepted answers, malformed UUIDs, ambiguous/unapproved prompts,
  answer text visible verbatim in prompt, excessive TTL and timezone-less
  timestamps. The caller is presumed to be trusted catalog/server code,
  **never client JSON**.
- `normalizeTypedEnglish`: NFKC, apostrophe, case and whitespace
  normalization. No permissive approximation or AI judgement.
- `gradeTypedRecallTrial`: evaluate first attempt using **server
  observed** timing and provenance. Repeat, hint-assisted, answer-revealed,
  expired, blank and no-consent attempts have **null evidence** and
  explicitly named exclusion reasons. Feedback may still be displayed
  for learning, but excluded responses never become research labels.
- `aggregateTypedRecallEvidence`: reject duplicate challenge IDs,
  legacy remembered flags, untrusted grades, invalid timestamps and
  records without explicit consent. Report **aggregate counts only**.
  No per-user IDs, word identities or typed answers in output.

The prepared challenge is serializable with only trial ID, prompt kind,
Vietnamese text and expiry. Expected answers, account ID, card ID and
catalog answer-set revision stay in an in-process WeakMap, and are not
serialized or logged. **This is for proving the evidence contract, not
for real serverless deployment.** A WeakMap is not durable across
processes or tabs and is not an idempotency mechanism.

Graded events contain:
- version, trial UUID, account UUID, source (shared/personal), word UUID;
- curated answer revision and prompt-kind identifier;
- Boolean first-attempt/unassisted attestations;
- `correct` or `incorrect` for the typed answer (NOT the UX24
  `remembered` decision), an elapsed-time bucket and server timestamp;
- consent version.

They do **not** contain typed response text, accepted answers, review
count, due date, game score, IP address or flashcard history.

## Security and future storage contract — NOT implemented

Before adding an API or collecting real-user evidence, obtain product
approval for an explicit opt-in and withdrawal path, privacy notice,
retention/deletion period and account consent version. Design two
**separate** server-owned tables in isolated Preview first:

1. An account-scoped challenge ledger with unique UUID, hidden
   answer-set reference/revision, issued/expiry times, first-attempt
   consumption state, hint/reveal state and retry/idempotency key.
   The catalog must *really* curate ambiguous Vietnamese meanings;
   code cannot prove a translation is unambiguous by itself.
2. An append-only minimal evidence ledger with unique
   `(user_id, challenge_id)`, result, kind/revision, latency bucket,
   source/word, server timestamp and consent reference. Avoid stored
   raw learner responses; erase per-user evidence on consent withdrawal
   according to the approved retention policy.

Use WordSky signed HttpOnly account cookies and server-derived actor
ID. Client-provided user IDs, "correct" flags, prompt approval,
answer lists, consumed state, timing and opt-in claims are untrusted.
Recheck identity/consent on submit; validate strict Origin/CSRF and rate
limits. Lock the challenge/actor row; consume the first attempt and
insert grade *atomically*. Replay of the same request returns the
original outcome, never a second event. Intervening browser actions
or revoked cookies must not write under another account.

Any proposed Supabase tables need owner FK constraints, least privilege,
RLS, no anon/authenticated direct Data API permissions, purpose-limited
queries and a verified delete/withdrawal path. Never connect a research
script to real Production accounts or retroactively synthesize old
evidence from self-marked reviews.

## Interpretation and algorithm comparison

Typed correctness is a reproducible **response-level retrieval proxy**
under the specified conditions, not a proof of long-term retention.
Manual prompt review, synonym coverage, prior exposure and accessibility
can all affect grades. A prompt is not eligible merely because the
Vietnamese meaning string happens to be non-empty.

When genuine, consented data exist, start with *held-out time-forward*
descriptive/calibration evaluation (coverage, number of attempts, label
balance, interval stratification, calibration error/log-loss if a model
predicts recall probability). Split by time before training and avoid
word/learner leakage. Neither offline accuracy nor synthetic results
establish that **a changed scheduling policy causes better retention**;
that requires a properly consented prospective randomized study (or a
defensible logged-policy off-policy design) controlling review budget,
censoring and exposure. No automatic v1-to-v2 migrations.

## Gates

1. `npm run check`, `npm test`, and
   `node scripts/ux43b-offline-recall-qa.mjs` pass with zero DB access.
2. Existing GitHub CI PostgreSQL, SRS, account and browser tests stay
   green on exact branch SHA.
3. Provenance, prompt ambiguity, consent, answer exposure, duplicate
   and privacy tests all PASS. Synthetic data are labeled as synthetic.
4. Human review approves the data and security boundary.
5. **No Vercel Preview or Production deployment for this offline PR.**

Next: UX43C, if approved, is to design and verify the opt-in exercise UI
and persistent challenge/evidence ledger on isolated Preview only.
That requires a separate DB migration review and secure multi-device E2E
before any user-facing rollout. Current Production scheduling remains
`ux24-fixed-v1` under its existing release gates.
