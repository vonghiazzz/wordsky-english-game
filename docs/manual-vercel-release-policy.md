# WordSky release policy — GitHub-first, Vercel on demand

**Effective when this policy is merged into main.** The repository's Vercel configuration sets git.deploymentEnabled to false. Vercel documents this as disabling **automatic Git-triggered deployments for every branch**. It does NOT disable GitHub pushes, GitHub Actions, the website currently live, or explicit Vercel CLI/API deployments.

## Environments and source of truth

| System | Purpose | Trigger |
| --- | --- | --- |
| GitHub feature branch | Work in progress | Push as often as needed |
| GitHub Actions | Unit, PostgreSQL17, Chromium and Firefox CI | Pull request to main |
| Vercel Preview | Final candidate, isolated-DB browser QA | **One manual deployment** after feature complete and CI green |
| GitHub main | Reviewed source code | Merge only after Preview acceptance |
| Vercel Production | Customer-facing website | **One manual release** after QA and approved merge |

## Gate A — Develop and verify on GitHub (zero Vercel deployments)

1. Develop on a feature or fix branch and push commits to GitHub freely. No automatic Preview should be built.
2. Run npm run check and npm test; open a PR into main. WordSky Learning CI must pass its isolated PostgreSQL and Chromium/Firefox jobs.
3. Select the **exact immutable commit SHA** of the candidate. Any later code change requires retesting before release. Do not merge yet.

## Gate B — Manually deploy one QA Preview

1. Verify the project and team: wordsky-english-game / nghias-projects-6f5417e1. Check remaining Hobby deployment quota before creating a deployment.
2. Verify that the Vercel Preview environment has an **isolated PostgreSQL DB**. WordSky's preview guard must remain effective. Never use Production DB credentials for Preview or bypass the preview database guard.
3. Make one **explicit** Vercel Preview deployment through the Vercel connector/API using the approved PR SHA, or from a local checkout pinned to that SHA using the authenticated Vercel CLI command: vercel deploy.
4. Require READY, confirm deployed commit SHA and Preview URL, test API/auth, critical gameplay/SRS/account isolation, desktop and mobile interfaces.
5. If the Preview fails, fix the code and rerun CI; create a new Preview only after new candidate approval. If Vercel returns 402/rate limit, stop. Do not retry in a loop.

## Gate C — Merge and manually stage Production

1. After successful Preview and human verification, merge the reviewed PR into main. Merge is **not** a deployment.
2. Verify main HEAD actually contains the tested changes. A squash merge changes SHA; review the diff and never release unrelated untested code.
3. Create exactly one **manual Production deployment** for the approved main commit. Preferred CLI workflow (from the approved local main checkout, project-linked):
   - vercel deploy --prod --skip-domain
   - Inspect and smoke-test the staged Production deployment (with Production environment variables, no modification of real learning data).
   - vercel promote [staged-production-deployment-url]
   Preview and Production are different builds/environment configurations. Never claim the Preview build itself was promoted unchanged.
4. Verify the production domain alias is READY and points to the intended main commit. Check runtime errors, authentication, and SRS/account features.
5. On failure, roll back to last known-good version without deleting account records.

## Release budget and safety

- Work-in-progress commits: **0** Vercel deployments.
- Finished candidate: **1** manually authorized Preview.
- After QA and merge: **1** manually authorized Production build.
- Do not add Vercel deploy hooks, auto-deploy GitHub Actions or change git.deploymentEnabled without review.
- No Production SQL/migration, reset, or copied database credentials unless the release explicitly requires them and they are separately reviewed.
- Automatic Git deployments remain disabled for main, feature, fix, and all other branches. The old live Production version continues to serve traffic until an approved manual release.
- Existing UX29 was merged into GitHub main but was not live due to Hobby quota when this policy was adopted. It awaits manual Preview QA and a deliberate Production release.

## Verification

- Vercel JSON has git.deploymentEnabled equal to false.
- Pull-request CI remains enabled and passes.
- No Vercel deployment is created solely from pushes/PR merges after policy merge.
- For the next feature, the QA Preview is manually created from an exact SHA; the Production deployment is only created after successful QA.

## Pinned Node.js 24 release gate (UX32)

- Vercel supports Node 26 and automatically selects it when an open-ended
  `engines.node` range such as `>=22` allows the latest major version.
- Set `package.json` and `package-lock.json` root engines to `24.x`;
  `.nvmrc` to `24`; and both PR CI jobs plus the read-only smoke
  workflow to `node-version: '24'`.
- Keep the Vercel project setting `nodeVersion=24.x`; `package.json`
  overrides that setting, so an open-ended range is insufficient.
- Confirm GitHub unit/PostgreSQL and Chromium/Firefox browser jobs PASS
  on the exact candidate SHA before spending **one** manual Preview build.
- Verify the Preview build logs and function runtime show Node.js 24; a
  successful deployment is not proof of runtime or account behavior.
- This change is runtime-only; it introduces no schema migration and
  must not change Production data, customer passwords or access tokens.
- The existing UX30 Production database migration is separately required
  before the new Admin/player session API can be released.
