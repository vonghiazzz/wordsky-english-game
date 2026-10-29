# UX28.1 — One "Luyện từ" button in My Learning

## User decision / UI source of truth
The learner does **not** need separate shortcuts for "Sổ từ cần ôn",
"Luyện từ sai", or duplicate mistake counters. The existing **My Learning
SRS group** already shows all study cards and their due/new/upcoming status.

**Only one practice CTA is visible on My Learning**:
\`↻ Làm mới lịch\` | \`✦ Luyện từ\` (adjacent in the SRS filter toolbar).

The advanced \`Kiểm tra đồng bộ\` control remains under a collapsed
\`<details>\` section, not alongside the learning CTA.

The My Learning hero retains Flashcard and personal-vocabulary management,
but no extra mistake/practice shortcuts. The shared Progress dropdown exposes
only My Learning (plus Attendance and Ranking). Solo results point to
My Learning, rather than creating another route to practice. The legacy
\`/mistakes.html\` still works when opened by saved links; its data and API
are not deleted, but its practice shortcut has been retired.

## Product behavior
1. User signs in, opens \`/progress.html\`, chooses **Nhóm ôn**
   (Đến hạn/Từ mới/Sắp đến hạn) and optional **Chủ đề**.
2. **Luyện từ** passes the exact selected status/topic in encoded URL params
   to \`/practice.html\`. There is no redundant card-count dashboard, setup
   form, filter or second Start button.
3. \`/practice.html\` reads the **same account SRS queue** as the My Learning
   list (\`GET /api/learning/srs/queue\`, status/topic/page=0/size=100), then
   starts an active-recall session with up to **10 words** from that group.
   Items missing a Vietnamese meaning are skipped.
4. The learner sees Vietnamese meaning, types English, receives
   exact-normalized correctness feedback, and writes exactly one
   account review only after the server acknowledges it.
5. Both \`shared\` and \`personal\` card sources are handled by the existing
   idempotent UX23 \`postUnifiedAccountReview\` and SRS schedule.
6. If the selected group has no study words, show a helpful empty state
   and send the learner back to My Learning to choose another group.

## Safety and semantics
- SRS and account review history remain the *single source of truth*.
  No DB migration, bulk mutation, or new storage is added.
- Choosing "Sắp đến hạn" permits explicit **early practice**; when the
  learner answers correctly, the backend existing SRS policy preserves
  the original due date.
- Server-authorized \`actor_id\`, account switch checks and expected
  review_count protect against wrong-account data and 409 concurrent edits.
- On uncertain HTTP response, retry the same idempotent request ID.
  Never treat a pending network write as a committed review.
- Don't rely on visible card totals to choose another user's data.
- The SRS endpoint is already feature-gated by WordSky. If unavailable,
  no action is offered and a legacy direct link shows an error.
- UX27 automatic Solo mistake tracking remains intact. Those items join
  the normal My Learning SRS queue, rather than a separate practice bank.

## Release QA
- Unit tests: URL parsing, SRS queue actor/policy/source validation, single CTA
  and no duplicate links, word-level typed grading.
- Isolated PostgreSQL17 + Chromium/Firefox E2E: CTA next to Refresh on
  360px mobile, same actor queue on two browsers, other actor isolation,
  accepted/retried review, due/upcoming separation, personal card
  source, SRS materialization and 409 conflict handling.
- Production schema and user progress are untouched by CI.
- Release via reviewed PR and verified Vercel Production; observe runtime logs
  before concluding success. Manual mobile keyboard QA remains recommended.
