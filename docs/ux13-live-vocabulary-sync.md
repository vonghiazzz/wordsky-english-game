# UX-13 — Live Vocabulary Sync (Preview implementation)

## Goal

WordSky's server vocabulary (`public.ws_words` / `public.ws_topics`) is the source of truth for the **shared** learning library. The prior `learn.html` sample deck (260 cards) and edited/imported personal cards remain browser-owned data and **must not** be replaced by a fetched catalog.

### Implemented architecture

- `GET /api/learning/vocabulary` — new **read-only, public** endpoint reusing the same enabled, 5,000-word-limited query as the authenticated account catalog. Returns `{scope:"catalog",words:[{word_id,topic,english,ipa,meaning,example,translation}]}`. No user progress, credentials or CEFR review metadata.
- `public/ux13-vocab-sync.js` — validates UUIDs, complete strings and duplicate topic/English keys; fetches with `cache:'no-store'` on page open, manual refresh, and window-focus checks (at most once/minute). Server changes need **no website redeployment**.
- `learn.html` — new source selection: **Kho từ máy chủ** (default when available) vs **Bộ từ cá nhân**. Flashcard topic selector/card renderer read the chosen source. The **Manager** and **Falling Words** game remain bound to their original `DATA` personal deck.
- Independent `localStorage.wordsky_public_vocab_cache_v1` snapshot for offline fallback (validated, expires after seven days). On an outage, status explicitly says it may be stale. Guest users can still browse online server vocabulary without logging in.
- Existing keys `wordsky_vocab_v2` and `wordsky_learned` are unchanged by any automatic fetch/refresh; an ordinary browser-level known mark still uses the legacy topic+English key. Only explicit Flashcard actions mark remembered.
- When signed in **and** the account database is operational, existing `ux10-learn-sync.js` may write an exact matching server UUID to account progress. The code is **not** evidence that Production account history works until the UX-10 migration is separately approved/applied.

### What the feature intentionally does not do

- No automatic merging or editing of personal vocabulary.
- No deletion/replacement of user-edited cards or progress.
- No automatic conversion of `localStorage` to account history.
- No game scoring/CEFR selection changes, no multiplayer modifications, no SRS table changes.
- No migration, Production write, or Production merge.
- The guest/local **My Learning** main counters still describe the personal browser deck. The public-server catalog count is shown separately; account-first My Learning requires the UX-10 Production schema to work.

### Changes and risks

- Admin creates/edits/disables a server word: new Flashcard fetch sees it. The current server card content replaces the prior *server snapshot*, never the personal deck.
- New server words have no remembered state by default. Existing browser topic+English remembered keys remain intact; when a new/renamed word collides on that legacy key, local flags should not be assumed to prove meaning-equivalent mastery. The account path uses immutable `word_id` when an exact match can be established.
- Multiple rows sharing the same case-insensitive `topic:english` are rejected rather than conflating browser-level progress identities; the personal deck is the safe fallback.
- Offline snapshot is separated, bounded and expires. A disabled/deleted server word may remain visible while offline in a *labelled stale snapshot*.
- API currently returns a whole catalog capped at 5,000 entries. For greater scale, introduce paginated/snapshot version APIs before relaxing limits.
- Account-specific Flashcard learning and guest/local progress are separate; UX-13 is a vocabulary-source feature, **not** a substitute for account-progress migration.

## Preview acceptance criteria

1. Fresh browser: load 365 enabled server words/26 topics, when Preview backend has current data.
2. Switch to personal source: retain 260 sample cards (or user's edited/imported deck).
3. Mark 10 words on personal source: those browser marks remain after refresh, selecting server, selecting personal, and visiting My Learning.
4. Simulate admin adding a new server word: next fetch shows new word/topic without changing personal cards.
5. Simulate server outage: use validated cache and show stale/offline status; never wipe local cards.
6. Confirm falling-words game and personal manager topic options remain local.
7. Run backend/unit regression and desktop/mobile browser tests.

## Release gates

- Branch `feature/ux13-vocabulary-sync`; review PR before merging.
- Preview tests must pass, including no data loss for `wordsky_vocab_v2` or `wordsky_learned`.
- A code-only Production release can be considered after approval, independently of account-progress migration; it must not be represented as fixing cross-browser progress.
- Separately review/apply the UX-10 account-progress Production migration when authorized, with RLS verification and real authenticated cross-browser testing.
