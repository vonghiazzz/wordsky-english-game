# UX-17 — Personal vocabulary per account (Preview only)

## Architecture and ownership
- Shared WordSky vocabulary stays in `ws_words` / `ws_topics`; its IDs are not reused for user-authored cards.
- New `public.ws_user_vocabulary` belongs to `ws_users.id`, contains full topic/card fields, remembered state and optimistic `version`.
- Only the WordSky Node API can access this table. Every SQL query scopes by the server-verified session user ID. Public schema RLS is enabled; Supabase Data API roles and PUBLIC grants are revoked. No Supabase Auth JWT is assumed.
- Legacy browser `wordsky_vocab_v2` and `wordsky_learned` remain independent. **No automatic transfer, deletion or overwrite.**

## First vertical slice
1. `GET /api/learning/personal-vocabulary`: authenticated player-only, returns at most 5,000 of their cards.
2. `POST /api/learning/personal-vocabulary/import`: explicit user-confirmed batches (UI sends 10; API max 20), `expected_actor_id` bound to the cookie. Deterministic import keys `lower(topic):lower(english)`. `ON CONFLICT DO NOTHING`: never overwrite existing edits or remembered:false. A repeated import can safely complete after a partial network failure.
3. `PATCH /api/learning/personal-vocabulary/{id}`: player-only, full fields + boolean remembered + `expected_version`. Fails HTTP 409 on a concurrent edit. Does not permit changing the row's owner or import key.
4. `/personal.html`: cloud list, remote edit/remember actions, explicit browser import, login status and status messages, linked from Flashcard manager and My Learning.

## Explicit limitations
- The original **Bộ từ cá nhân** manager/editor continues browser-local and is never silently overwritten. Authenticated learners can separately select **Bộ từ tài khoản** directly in Flashcards, mark remembered with optimistic PostgreSQL updates, and use **Bộ từ cá nhân · tài khoản** as a fourth source in My Learning. The standalone /personal.html editor remains available to modify cloud cards. No automatic bidirectional sync of existing browser-manager edits and no offline conflict merge; legacy cards require explicit import.
- Personal remembered state is stored in each private card row for this slice; separate immutable history/SRS remains a later phase.
- Editing topic/English does not alter the original import identity, deliberately preventing a subsequent import from silently overwriting an edited cloud card. Manual duplicate reconciliation remains a later improvement.
- This migration is independent of UX-10's two `ws_learning_*` account-progress tables. Those are still required for cross-browser **shared server vocabulary** review history.
- Source files in this PR do not authorize Production DDL or a merge to main.

## Release gates
- Isolated Preview: apply additive migration; check RLS and direct role grants.
- Test guest forbidden, two separate authenticated users cannot read/edit each other's records, same-user cross-browser cloud read/write, duplicate import idempotency and optimistic 409, localStorage preservation, desktop/mobile.
- Require **separate explicit approval** for Production migration and code merge.

## Additional acceptance evidence
- Flashcard account source: Chromium first-browser PATCH + reload 9/9 checked, second-browser Cloud source 6/6 checked; legacy local progress preserved. One initial test timed out at `networkidle`; targeted `domcontentloaded`/UI-wait rerun passed.
- My Learning account-personal scope: final Chromium 9/9 checks PASS, including authenticated PATCH, second browser showing same cloud remembered count, no localStorage copy and mobile width 390px.
- Repository regression at application commit `27b9ec1f1c38a1c80989a3fd0faaec07170f22ad`: 291/291 PASS. No Production DDL or main merge.
