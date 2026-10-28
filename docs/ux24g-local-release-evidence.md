# WordSky UX-24G — Local Release Evidence

Date: 2026-10-28

Status: LOCAL VALIDATION COMPLETE.
Preview/Production release is NOT authorized.

## Source

- Branch: dev/local-first-srs
- Last confirmed HEAD: 7b96055
- Production backup: wordsky-public-20261028T072810Z.dump
- Backup SHA-256: b9d47f1c653657c91ae3baf837f3c6088fefc825f02a2ebc873fb1655ef4092d
- Backup scope: PostgreSQL public schema, not entire Supabase.
- Do not commit or distribute the database dump.

## Verified local results

- UX24G.1: Synthetic migration and SRS backfill PASS.
- UX24G.2: Failure injection and rollback PASS.
- UX24G.3: Release safety audit 7/7 PASS.
- UX24G.4: Synthetic backup/restore PASS.
- UX24G.5: 373 tests plus isolated UX23C test PASS.
- UX24G.6: Production public backup and local restore PASS.
- UX24G.7.1: UX23/UX24 migrations on restored snapshot PASS.
- UX24G.7.2: 33 SRS schedules backfilled, 33 matched, zero mismatches, reapply inserts zero.

## Production backup snapshot

- Users: 4
- Shared vocabulary: 365
- Personal cards: 3
- Shared review events: 55
- Personal review events: 1
- Shared progress records: 32
- Personal progress records: 1

Original review histories and progress remained unchanged after
the local migration/backfill rehearsal.

## Migration tracking

| Migration | Production | Preview |
| --- | --- | --- |
| UX10 | Objects exist, no dedicated history entry identified | Objects exist, no dedicated history entry identified |
| UX17 | Objects exist, history entry absent | Objects exist, history recorded |
| UX23 | Ledger absent | Ledger exists, history entry absent |
| UX24 | Schedule table absent | Schedule table exists, history recorded |

Repository db/migrations filenames must not be assumed to map
directly onto Supabase migration versions.

Do not run migration repair with invented version numbers.

## Release blockers

- Review both untracked local QA scripts before execution or commit.
- Branch pushes to dev/local-first-srs do not currently trigger learning-ci.
- Complete authenticated Preview browser testing.
- Confirm migration provenance and tracking strategy.
- Recheck live Production data immediately before release.
- Obtain explicit approval for Production migrations and backfill.
- Do not activate Production SRS flags during Local validation.

## Safety

Never reset Production data, overwrite learning history,
delete review events or use DROP TABLE as routine rollback.

Do not merge main or deploy Production from this document alone.

## Final QA — 28 October 2026

- API smoke test: 7/7 PASS.
- Browser E2E: 12/12 PASS (Chromium and Firefox).
- Mobile Upcoming layout: 360px and 390px PASS.
- Cross-browser account synchronization: PASS.
- Cross-account personal-data isolation: PASS.
- Final npm test: 374 total, 373 pass, 0 fail, 1 skip.
- UX23C PostgreSQL test skipped in this run by design;
  it passed separately on isolated PostgreSQL.
- Remaining temporary Local QA accounts: 0.
- Playwright devDependency pinned to 1.64.1.
- Local-only QA scripts use SSL disabled for local PostgreSQL.

This is a LOCAL release candidate only.
The isolated Preview acceptance and Production rollout
remain separately approval-gated.
