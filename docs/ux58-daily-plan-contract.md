# UX58 M1 — Daily plan calculation contract

The first UX58 milestone is intentionally a small **read-only pure helper** and unit tests. It does not add a second vocabulary/progress database or change the existing My Learning `Luyện từ` entry point.

## Current integration intent
- At M2, a signed-in account's **existing SRS queue** and totals will be the only authoritative source for counts of due/new/upcoming. Validate actor identity and source scope on every read. Do not sum paginated row counts as if they were global totals.
- `createDailyLearningPlan({due,new,upcoming},{dueGoal,newGoal})` defaults to reviewing up to 10 due words and up to 10 new words. Upcoming words are informational, never silently promoted to due. Output exposes the existing practice filters and a total plan suggestion.
- The returned plan deliberately sets `completed: null`, `streak: null` because availability alone **cannot** establish actions completed during the current calendar day. M3 must derive them from acknowledged server-side review events and define Asia/Ho_Chi_Minh day boundaries, idempotent retries, cross-device replay behavior and account identity gating.
- No word review or new-word assignment occurs when the plan is calculated or opened. No localStorage is the source of truth.

## M2 interface proposal
1. One compact card in My Learning displaying the available due/new, suggested counts and one primary **Luyện từ** action linking to the existing practice route. Avoid adding competing review buttons in multiple areas.
2. Fetch authenticated `auth/me` first, then actor-scoped SRS aggregate for the exact same account. Render guest and network-error states explicitly, cancel stale requests on logout/switch-account.
3. At least Chromium and Firefox 360px plus desktop, test empty queues, due > goal, new > goal, counts not equal page size, cross-device parity, and no review write on read.

## Gate
Do not deploy UX58 UI or claim daily streak/completion until server-side event provenance exists and the SRS/UX57 production smoke and protected Preview review gates have passed. Test-only/pure helper PR can merge without redeploying production.
