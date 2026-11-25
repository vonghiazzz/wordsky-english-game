# UX59.13 — Production rollback preflight (dry-run only)

**No production rollback is authorized by this file or its tests.** The tool never changes a Vercel alias, Git branch, user accounts, or PostgreSQL.

## Decision gates

1. Verify current production alias with Vercel and compare its runtime `/api/release` SHA to the active reviewed deployment.
2. Select a strictly older **READY production deployment from main**. A Preview or branch deployment cannot be promoted as a substitute without a separate review.
3. Retrieve a successful `wordsky-production-receipt-<sha>` artifact from the GitHub Actions release audit for the *candidate* commit. Receipt JSON alone does not authenticate Vercel records; match deployment ID/SHA/target using the Vercel API.
4. Independently inspect migrations, data shape compatibility and user-progress effects. Set `databaseCompatibilityConfirmed` true only with documented evidence; never infer it from a successful older receipt.
5. Create an offline JSON object containing `current`, `candidate`, `receipt`, `databaseCompatibilityConfirmed`; each deployment needs `id`, full `sha`, `state`, `target`, `ref`, and numeric `created` timestamp.
6. Run `node scripts/ux59-rollback-preflight.mjs path/to/offline-evidence.json`. BLOCKED exits nonzero. ELIGIBLE_FOR_HUMAN_REVIEW does **not** perform rollback or automatically authorize traffic movement.
7. Obtain separate human approval for the verified candidate and review Vercel rollback/promote implications (including auto-assignment behavior). After any separately authorized change, verify the public alias, runtime commit, GET-only smoke, errors, and production SRS health. Record a new release receipt.

Existing production release configuration retains `git.deploymentEnabled: false` and therefore requires deliberate deployment and alias assignment after CI gates.

**Important:** Receipt retention is 30 days. Without a surviving candidate receipt, the preflight blocks and a fresh manual review is required; do not forge an old receipt.
