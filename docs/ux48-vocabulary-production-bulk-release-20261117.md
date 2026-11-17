# WordSky — Live vocabulary import record (LIFE-02..07 + legacy draft), 2026-11-17

> **This is a POST-RELEASE evidence record, not an approval policy.** User requested continuing vocabulary import to the full LIFE-1000 target. Production was updated directly using authenticated Supabase SQL, **without code deployment or schema migration**. The displayed My Learning list reads from live `ws_words` via `GET /api/learning/vocabulary`.

## Baseline and actual database changes

| Stage | Published enabled words | Active topics | Action |
|---|---:|---:|---|
| Original Production baseline | 365 | 26 | All 365 CEFR APPROVED |
| LIFE-01, `ws_audit.id=469` | 465 | 26 | +100; 75 Daily Life / 25 Home; all PROVISIONAL |
| LIFE-02..07, `ws_audit.id=470` | **1,064** | **30** | +599; skipped duplicate `itinerary`; +4 topics |
| Legacy CEFR provisional 117, `ws_audit.id=471` | **1,099** | **30** | +35; skipped same-Vietnamese-cue `holiday` (meaning overlaps `vacation`); 81 words already existed |

**Verified latest state**: 1,099 total/enabled words, **365 APPROVED + 734 PROVISIONAL**, 30 enabled topics, and HTTP 200 from public catalog API.

### LIFE-02..07 breakdown

| Batch | Source Git blob | Inserted | State |
|---|---|---:|---|
| LIFE-02 | `32079414551a733ea8af7104f06f79d6ee67d96f` | 100 | PROVISIONAL |
| LIFE-03 | `ea4786fa91ee47a241b4bd4b45adc6a33bac8118` | 100 | PROVISIONAL |
| LIFE-04 | `f650d8a2d02b68f6101c91e5da053c3d068b132d` | 100 | PROVISIONAL |
| LIFE-05 | `a20594c8f7afeb67a66fdc6b60cf87968df9d98a` | 100 | PROVISIONAL |
| LIFE-06 | `dcce483c4ae9a68be96758bb123447547199572c` | 99 | PROVISIONAL; `itinerary` already existed in Travel as APPROVED |
| LIFE-07 | `7cc16fe73dc64740d52a032910c03acb7c56c90a` | 100 | PROVISIONAL |
| Extra legacy provisional | `4a1b5b9f81110d016776e48bfb8e2ca5c8aa0bce` | 35 | PROVISIONAL; 36 previously missing, 1 skipped for colliding Vietnamese cue |

**Four new topics created in one atomic LIFE02..07 transaction (all enabled):**
- Everyday Conversation - Giao tiếp hằng ngày (100 words)
- Social Relationships - Quan hệ xã hội (50 words)
- Cooking & Kitchen - Nấu ăn (50 words)
- Money & Payments - Thanh toán (75 words)

All other rows use existing enabled topics. The new topics are **live** now; old Preview-only disabled-topic registration PRs #93/#94 must be revisited and **not blindly run on Production**.

## Safety and verification

- Checked 600 candidate records, six batches of exactly 100; zero duplicate English or Vietnamese cues **within** the 600, zero raw Vietnamese collisions against the existing 465, and exactly one existing English duplicate `itinerary`.
- Checked field lengths, required strings, source status `PROVISIONAL`, topic allowlist, zero `OPEN/LIVE` events, and exact initial database/topic counts.
- Atomic guarded PostgreSQL transaction created four topics and inserted precisely **599** words, with automatic rollback on mismatched counts, conflicts or active events.
- Second guarded transaction inserted 35 legacy drafts after rechecking 117 source entries and excluding one conflicting translation. Neither transaction updates existing word UUIDs.
- Audits **470/471** store immutable source blob IDs, before/after counts and **all 599/35 inserted UUIDs**. LIFE-01 audit **469** stores the first 100 IDs.
- At postflight snapshot: **4 users, 160 shared-progress rows, 237 flashcard review events, 161 SRS schedule rows** — counts unchanged from before; this snapshot does not prove what future reviews will do.
- Verified public API `GET /api/learning/vocabulary`: **1,064** words / `GET /api/topics`: 30 topics immediately after LIFE02..07, and SQL **1,099** after the subsequent legacy import. The last **1,099** API response should be rechecked before claiming UI accepted the newest addition.
- **No Vercel redeploy**, migration or deletion of existing player data.

**Quality caveat (important):** 734 newly inserted rows are PROVISIONAL, not independently reviewed. The candidate CEFR levels are editorial hypotheses. A clean exact collision scan does not establish idiomaticity, synonym uniqueness, IPA correctness or academic CEFR certification. MATCH/BOMB/MATRIX/MEMORY can still draw non-APPROVED words in some situations, so imported content may affect gameplay. Conduct follow-up editorial review and real learner QA.

**Backup caveat:** No independent recent Production restore drill was demonstrated before these additive imports. Audits record exact UUIDs to permit selective soft-disable in a reviewed transaction; this is not equivalent to a full backup or disaster recovery restore.

## What's left to reach the numeric LIFE-1000 expansion goal?

- Planned **1,000 net-new** words beyond the initial 365 → target **1,365 enabled words**.
- Currently **734 net-new** words (100 LIFE-01 + 599 LIFE-02..07 + 35 legacy), so **266 additional distinct, reviewed entries** are needed for the numeric target.
- LIFE-08 / LIFE-09 / LIFE-10: the roadmap has planned group topics, but their **300-record authored JSON files do not exist** in current GitHub main. Do not fabricate counts, source links, IPA or CEFR approvals. Prepare original drafts, evaluate collisions against 1,099 live terms, verify sense/POS/IPA/translation and release through staged QA.
- The distinct LIFE-1000-content-specific count is **699**, because one of the 700 LIFE-01..07 candidates was already live. The legacy +35 count is **outside** the formal LIFE-1000 batch list.
- A planned batch file being present and a review source URL existing are **not** evidence of approval.
- Do not automatically reuse old `scripts/register-life0X-topic.mjs` Preview-only procedures to create topics that now exist on Production.

## Reconciliation and future rollbacks

Audit query (read-only):
```sql
SELECT id,action,entity_id,payload->>'inserted_count' AS inserted_count,
  jsonb_array_length(payload->'inserted_words') AS tracked_uuid_count,created_at
FROM public.ws_audit
WHERE id IN (469,470,471)
ORDER BY id;
```

**Do not rerun these imports.** Prior to any correction/disable, check for `OPEN/LIVE` game events and newly attached learning history. For removal of an unsuitable candidate, use a **reviewed `enabled=false` soft-disable filtered by audit-stored exact UUID**, do not delete old words, do not reset users' SRS/review history, and do not conflate a data rollback with a Vercel rollback.

**Next verified action:** recheck 1,099 words in production public API, run read-only smoke tests on the new topics and newly imported card fields, then prepare LIFE-08..10 editorial batches. Keep releases GitHub-first when code changes; no further Production SQL until complete QA.
