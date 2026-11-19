# UX58 M2 — My Learning daily plan card (read-only)

The card is placed **inside the existing `#ws24Srs` panel**, so it respects the same Preview/Production SRS release gate. No SRS enabled → no daily card. No new duplicate primary **Luyện từ** button.

## Data contract
- Uses **only** `GET /api/learning/srs/queue` response's **global** `summary.{due,new,upcoming,total}`, never `words.length` or `total` from the currently selected topic/page.
- Checks `scope === account-srs`, actor identity and counts nonnegative integers; checks aggregate sum equals total. On actor mismatch, pending refresh, invalid data or 404 feature gate, **hide the card**. No stale account data shown in this card.
- Displays **suggested amounts only**, up to 10 due + 10 new words, plus upcoming. The lone existing `#ws24Practice` button still launches the currently selected SRS group. The suggestion explicitly states it covers all topics.
- Does **not** claim completion, streak, mastery or synced daily activity. No new storage, history write or POST is introduced by rendering.
- The source UX58 M1 pure helper remains reusable.

## QA
- Unit tests cover page/topic filtered response with global totals, actor isolation, invalid/missing summary, zero queues and markup guarding the existing single practice button.
- GitHub isolated PostgreSQL + browser/SRS acceptance must pass before merge.
- Preview/mobile signed-in visual QA still required before promoting any new UI to Production; merge is **not** a Vercel deploy in this repository.
- Next M3 must source streak/completion from server-confirmed event timestamps in Asia/Ho_Chi_Minh and protect idempotent replay/cross-device sync.
