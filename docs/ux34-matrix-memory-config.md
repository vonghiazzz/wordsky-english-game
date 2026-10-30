# UX34 — MATRIX mở thẻ + MEMORY úp thẻ

## Product scope
Two independent card-grid games share vocabulary and server-scored Solo/competition logic.
MATRIX is face-up, MEMORY is face-down. Both offer 6×6 = 18 pairs,
10×10 = 50 pairs, 12×12 = 72 pairs.

| Size | MATRIX default | MEMORY default |
|---|---:|---:|
| 6×6 | 360s | 180s |
| 10×10 | 720s | 360s |
| 12×12 | 1200s | 600s |

Users can change difficulty (EASY/NORMAL/HARD), topic, duration (20–1800s),
correct points (10–1000), wrong penalty (0–1000). Only unique
English/Vietnamese labels qualify. Insufficient topic data must fail
rather than mix unrelated words. CEFR is a soft vocabulary priority,
not a strict filter when the bucket is too small.

### Rules
- MATRIX: all faces visible. EN ↔ VI correct pair gains points and locks;
  wrong pair deducts points and one of three hearts. Third mistake fails.
- MEMORY: all faces start hidden. Flip one, then another. Correct locks
  the pair as a checkmark and awards points. Wrong deducts configurable points,
  stays visible ~1.1 seconds, then automatically hides again. No heart loss;
  timer or all completed pairs ends the run. Score has zero floor.
- Audio is original Web Audio synthesis, never autoplay. Existing user volume,
  music and effects preferences remain shared.
- Mobile boards scroll horizontally/vertically with readable tile sizes and keyboard focus.
- Solo games use separate sessionStorage run pointers. Server owns hidden
  matching, score, timers, wrong words and idempotent attempt receipts.
  MEMORY public cards hide labels, languages and secret IDs until flipped.
- Player-owned Solo wrong words sync at game end through the existing idempotent
  My Learning path; correct answers never auto-mark remembered.

### Competition
Admin can add MATRIX and MEMORY rounds to an event, with size, topic,
difficulty, duration, points, penalty and round weight. Event runs use
server-owned participant identity and scoring. Existing five-second
fast-forward and leaderboard system continues. Feature flags must be
explicitly on for new rounds.

### DB and staged release
Migration db/migrations/20261030_ux34_matrix_memory_config.sql expands
Solo/event CHECK constraints and adds MEMORY disabled by default.
It requires UX33 migration. Existing users, words, runs and learning
progress must be preserved. PR does not authorize Production migration.

1. Run Node unit/API checks, isolated PostgreSQL 17 and Playwright desktop/mobile.
2. Inspect competition entry, score, MEMORY reveal privacy and idempotent retry.
3. Create one isolated Vercel Preview after CI green, verify authenticated
   MATRIX and MEMORY manually.
4. Fresh Production backup + encrypted checksum + isolated restore rehearsal.
5. Explicit Production approval; apply UX33 then UX34 schema before code.
6. Stage new Production build without alias, smoke, promote if green,
   then explicitly enable selected flags. No automatic Vercel deployment.
