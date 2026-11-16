# LIFE-07 — cumulative inventory preflight evidence (2026-11-16)

**Scope:** Offline editorial inventory only. The 100 proposed expressions in `docs/vocab-life07-editorial-inventory.md` are **not** a finished `LIFE-07.json` and no learner-visible data has changed.

## Connector-based audit (executed)

| Input | Compared items |
|---|---:|
| Original public seed | 280 |
| Legacy CEFR draft records | 117 |
| LIFE-01..06 draft content | 600 |
| **Total prior records** | **997** |
| LIFE-07 new expressions | 100 |

- LIFE-07: symptoms=25, pharmacy=25, habits=25, wellbeing=25.
- Normalized English exact collisions versus 997 previous records: **0**.
- Normalized Vietnamese cue exact collisions versus 997 previous records: **0**.
- Duplicate Vietnamese cues among LIFE-07 rows: **0**.
- Row numbering across each 25-item group: valid.
- Comparisons use Unicode NFKC, whitespace collapse, trim and locale lowercasing.
- The collision audit was independently reproduced by reading GitHub files through the connected GitHub API.

## Executable QA script

Added `scripts/qa-life07-inventory.mjs` to run the equivalent cumulative offline checks from a local checkout:

```sh
node scripts/qa-life07-inventory.mjs
```

**Execution limitation:** This session's container could not clone GitHub (`Could not resolve host: github.com`). The Node CLI script was therefore **not run locally or in CI in this session**. No test-passed claim is made for that command; exact-head CI still required.

## Release blockers

- 100 entries have no reviewed 15-field JSON, UK IPA, POS, new examples/translations or per-sense CEFR evidence. All editorial approvals pending.
- Exact-string checks do **not** detect semantic overlap, synonym ambiguity or transliteration differences.
- Live Production PostgreSQL, users' private vocabulary and game answer handling not examined.
- LIFE-07 is stacked on #95, #92 and #91. GitHub merges do not import content; no Production write, deployment or activation authorized.

**Next work:** independently draft/check a full 100-entry JSON; source-specific CEFR and pronunciation review; offline seven-batch validator; isolated PostgreSQL and Chromium/Firefox QA; only then review for a separate controlled vocabulary import.
