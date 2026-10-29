# UX29 release-candidate preflight — GitHub first, one Preview, one Production

This is an **operator checklist**, not a deployment workflow.
No part of this file creates, schedules or auto-retries a Vercel deployment.

## Current starting point (29 October 2026)

- UX29 feature implementation was tested in GitHub Actions against
  \`feature/ux29-learning-insights\` at SHA
  \`1d3baa11f160fe833c484b5c36a0e298208c3b52\`. Full CI passed.
- UX29 was merged to \`main\` at \`8c0713b89d83d6221c95b2c94b83e1559fc7f7dc\`.
- The GitHub-first release policy was merged at
  \`96717833eeeb3bd41eacd3016a6908bd72346060\`.
- Current Production was still \`f26808d1dcbb82940b67885405fcd4869295fa31\`
  (UX28.1), READY on 29 Oct. **UX29 was not live at that time.**
- The most recent UX29 Preview available at that time used
  \`4c42af926138b5bb139e6adb35e28c61dd770067\`, not the final UX29 candidate.
  **Never count an older Preview as evidence for a newer commit.**
- Vercel Hobby had reached its rolling daily build/deployment limit; do not
  probe it by creating trial deployments while the quota is exhausted.
- Preview environment variable **names/targets** include
  WORDSKY_PREVIEW_DATABASE_URL and WORDSKY_PREVIEW_DB_REF. Their presence
  does **not prove** the referenced database is independent: verify with
  the existing fail-closed guard and runtime checks. Never print secret values.

## Gate 0 — No automatic deployments

Inspect \`vercel.json\`: git.deploymentEnabled must equal false.
There is **no push-to-Vercel GitHub Action**. Push and PR merges are source
control operations only; the Production domain remains on the last READY
release until an operator explicitly deploys/promotes.

## Gate 1 — Exact main SHA tested in GitHub (0 Vercel deployments)

1. Open GitHub → Actions → **WordSky Learning CI** → **Run workflow**.
2. Choose branch **main**. Copy the full current 40-character SHA of main
   into the required \`expected_sha\` input.
3. Run once. The workflow fails immediately if the requested SHA differs
   from checked-out main, if the branch is not main, or if Git-triggered
   Vercel deployments have been re-enabled.
4. Require both jobs to pass: unit-and-postgres and browser-srs-e2e.
   This includes UX29's isolated PostgreSQL and Chromium/Firefox analytics QA.
5. Record the workflow URL, complete SHA and pass count. If main changed
   during review, start over with a new exact SHA.
6. Do **not** grant this workflow Vercel tokens or Production database secrets.
   It is intentionally test-only and runs against disposable CI PostgreSQL.

### Evidence required to approve UX29

- Review history (shared + personal) and finished Solo runs are counted
  separately without inflating objective quiz accuracy.
- Vietnam calendar 7/30-day chart, empty-history state, active-day and
  word-focus definitions are covered by automated tests.
- Cross-account isolation survives account switching and cross-browser use.
- Analytics requests are read-only, never creating review events.
- UI has no extra top-level navigation and preserves one "Luyện từ" action.
- All temporary QA accounts are removed from isolated CI PostgreSQL.

## Gate 2 — One manually requested Vercel Preview (1 deployment)

**Start only when the Hobby quota is available and Gate 1 passed.**

1. Confirm team \`nghias-projects-6f5417e1\` and project
   \`wordsky-english-game\`.
2. Confirm \`main\` still points to Gate 1's exact SHA; if not, rerun Gate 1.
3. Request **one** manual Vercel Preview build from that full SHA via the
   authorized Vercel API/MCP or CLI, **without** a production target.
   Do not re-enable auto-deploy just to get a preview.
4. Verify that the Preview's DB reference is distinct from Production and
   that \`lib/db-target.js\` rejects an unisolated Preview (HTTP 503).
   This check must not print credentials or mutate Production.
   Preview must not reuse Production's database. SRS preview flags must
   not override the account/database isolation guard.
5. Require deployment state READY, matching full SHA and correct team/project.
6. Read-only smoke of the exact Preview:
   - GET \`/\`, \`/progress.html\`, \`/ux29-insights.js\`,
     \`/ux29-insights.css\` and \`/api/topics\` return healthy responses.
   - Unauthorized GET \`/api/learning/insights?days=7\` denies access.
   - Authenticated test account: 7/30 days, shared/personal review data,
     focus words, responsive 360px and no duplicate "Luyện từ" button.
   - No anonymous/other-account data leaks; no Production mutations.
7. Ask for human visual acceptance of UX29 before releasing Production.
   If Preview is ERROR/503, fix root cause and repeat Gate 1 before
   spending another deployment.

## Gate 3 — One manually authorized Production build

UX29 was **already merged** before this manual process was adopted.
For the next features, wait to merge until Gate 2 is accepted.

1. Verify that current \`main\` is exactly the SHA tested in Gate 1
   and Preview in Gate 2. No unreviewed feature merges.
2. From the checked-out approved SHA and linked WordSky Vercel project,
   deploy a staged production build:
   \`vercel deploy --prod --skip-domain\`.
3. Smoke-test that **staged Production build** and its Production environment.
   Do not submit learning reviews or edit user accounts during smoke tests.
4. Only after staging passes, explicitly promote:
   \`vercel promote <staged-production-deployment-url>\`.
5. Confirm the custom domain is READY and points to the approved main SHA.
   Inspect runtime error counts and confirm login, My Learning, SRS and UX29.
   Document new Production deployment ID and SHA.
6. If errors appear, roll back to the last known-good deployment; never
   delete or reset Production learning history to make a release green.

## Budget and failure handling

| Step | Automatic deployments | Manually requested deployments |
| --- | ---: | ---: |
| GitHub pushes / PR / manual full CI | 0 | 0 |
| One reviewed Preview | 0 | 1 |
| One staged Production build, then promotion | 0 | 1 |

Daily Vercel Hobby limits also apply to manual API/CLI deployments. Check quota
before requesting either build. If the API reports 402 or build-rate limit,
**stop**, preserve the CI evidence, and release only when quota is available.
No blind polling, redeploy loops, or background promises.

### Completion record (fill only after evidence is available)

- [ ] Exact main SHA: …
- [ ] GitHub full CI URL and both jobs PASS: …
- [ ] Verified distinct Preview database: …
- [ ] Exact-head Preview READY URL: …
- [ ] Human Preview acceptance: …
- [ ] Staged Production READY ID and SHA: …
- [ ] Production promotion and domain verification: …
- [ ] Runtime error/rollback check: …
