# UX61.9 — Blind review handoff for the six pending shared vocabulary cards

**Status: PREPARATION ONLY — 0 human-reviewed/approved cards.** This is not an SRS grading release.

WordSky currently keeps six shared words off auto-graded typed recall because three Vietnamese cues are shared by more than one English headword: `năm` (`five/year`), `đánh giá` (`assess/evaluate`), and `đáng kể` (`significant/substantial`). Their original meanings, source examples and production UUIDs remain unchanged.

## Generate two forms

Run from the repository root (Node.js 24):

```sh
node scripts/ux61-8-review-production.mjs --live
node scripts/ux61-9-blind-review.mjs --generate ./review-local
```

The generator first rechecks the *public production catalog using GET only* to prevent stale packet handoff. It writes two distinct JSON files with restricted local permissions and refuses to overwrite existing files:

- `review-local/ux61-9-REVIEWER_A.json`
- `review-local/ux61-9-REVIEWER_B.json`

Send one file separately to each **real, independent, qualified bilingual reviewer**. Do not send the other reviewer's form, discuss their answers, or share peer outcomes before both independent reviews are submitted. No account password, session token, SRS data, or customer history belongs in either file.

The `REVIEWER_A/B` strings are only labels. **They do not authenticate a person.** A second WordSky user, LLM session, or JSON file is not proof of a second independent human. Verify actual reviewers' identities, independence and timestamps through an external trusted identity / roster process and the separate UX43E2 evidence requirements before adjudication.

## Fields to complete per card

Each card already includes the immutable WordSky UUID, English word, topic, Vietnamese cue, English/translated example and a Cambridge URL. Complete:

- `decision`: `suitable_for_adjudication` or `needs_revision` (neither grants approval).
- `reasoning`: explain why the question is fair or why it should be revised, including legitimate synonyms.
- `reviewed_source_url`: the exact original Cambridge URL in the form (confirm you consulted it).
- For `suitable_for_adjudication` only: `proposed_prompt_vi` — Vietnamese context question that **does not reveal the English answer**; `accepted_english` — a set of 1–8 genuinely correct English responses, including the target word.
- For `needs_revision`: leave `proposed_prompt_vi` and `accepted_english` as `null`.

The source examples contain English answer words; they are provided **to the reviewer only**, never as prompts for a graded spelling question. `assess/evaluate` and `significant/substantial` overlap in meaning. Do not invent false exclusivity to force a unique answer.

## Compare the completed files (offline)

```sh
node scripts/ux61-9-blind-review.mjs --compare \
  ./review-local/ux61-9-REVIEWER_A.json \
  ./review-local/ux61-9-REVIEWER_B.json
```

The comparator checks the immutable source snapshot and exact fields, detects incomplete forms, decision disagreements, different Vietnamese prompts, different accepted-answer sets, exact same prompt across a confusing pair, and overlapping accepted English answers.

An agreement of two forms is **not** proof that two different humans independently reviewed, that the meaning is linguistically correct, or that the prompts may be activated. The result always contains:

```json
{
  "independent_people_verified": false,
  "semantic_accuracy_verified": false,
  "signed_immutable_receipts_verified": false,
  "requires_human_adjudication": true,
  "authorized_to_approve": false,
  "authorized_to_activate_prompts": false,
  "authorized_to_grade_srs": false,
  "authorized_to_modify_production": false
}
```

The comparator writes no database records and never toggles the six `isPendingEditorialRecall` holds.

## Remaining gate before a future *separate* scored-recall PR

1. Confirm the independent humans through a trusted external identity / roster and collect immutable review receipts; neither form can claim this itself.
2. Resolve reviewer disagreements and synonym overlaps manually with bilingual evidence; version the accepted prompts and answer sets.
3. Complete UX43E2 independent blind review requirements, trusted approval implementation and explicit authorization, which are not available in this offline tool.
4. Recheck production catalog identifiers, back up data, plan rollback, test Preview + SRS idempotency, then use a separate reviewed release to lift specific holds.

**No approval, data migration, SRS write, CEFR update or production content change occurs in UX61.9.** Keep the six cards available as read-only examples until these requirements are met.
