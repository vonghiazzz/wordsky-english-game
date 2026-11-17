# WORDSKY — CURRENT STATE & NEXT ACTIONS

> **One-page handoff / nguồn tham chiếu để tiếp tục phát triển WordSky**
>
> Cập nhật: **2026-11-17**. Đối chiếu trực tiếp code, test, GitHub PR và Vercel.
> GitHub main lúc audit: **caf487f635e877c4f38296fb198cf3bdb947c8cb** (đã merge PR #98).
> Production được xác minh: **cf870c0604220784339507ab43ddcc97d08e033c**, READY, tại https://wordsky-english-game.vercel.app.
> **Production chậm hơn main phần UX45 QA/docs; không suy diễn merge = deploy.**
> Khi main/Production đổi SHA, cần xác minh lại trước khi coi thông tin dưới đây là hiện hành.

## Latest Production vocabulary release — 2026-11-17

**This newer live snapshot supersedes the earlier 365-word/26-topic baseline in sections 3 and 4.**
User-authorized additive SQL has now been executed against WordSky Production, without any Vercel redeploy:

- **1,099 active shared words / 30 active topics**, verified in live `GET /api/learning/vocabulary` and `GET /api/topics` (both HTTP 200).
- **365 APPROVED / 734 PROVISIONAL**. The 734 newly added items are **not** CEFR certified or independently reviewer-approved.
- Import history: LIFE-01 +100 (`ws_audit.id=469`); LIFE-02..07 +599 and four new topic records (`id=470`, skip duplicate `itinerary`); legacy CEFR drafts +35 (`id=471`, skip duplicate Vietnamese cue `holiday`). All imported UUIDs are in the audit rows.
- Original target: 365 baseline + 1,000 distinct new = **1,365**. Current numeric delta is **+734**, leaving **266 more distinct words** for the numeric target. Formal LIFE-1000 batches LIFE-08..10 (300 candidate rows) are **NOT yet authored** in the repository.
- Learning history unchanged at verification snapshot: 4 users, 160 shared progress rows, 237 flashcard reviews, 161 SRS schedules. Do not treat those as stable counts if new activity occurs.
- The four topic groups now actually exist in Production: Everyday Conversation, Social Relationships, Cooking & Kitchen, and Money & Payments. Their older Preview-only registration PRs (#93/#94) must not be blindly applied to Production.
- Content **risk**: MATCH/BOMB/MATRIX/MEMORY may select PROVISIONAL terms; CEFR/IPA/translation/ambiguity review remains. No new independent backup restore drill was evidenced.
- Detailed post-release report: [docs/ux48-vocabulary-production-bulk-release-20261117.md](docs/ux48-vocabulary-production-bulk-release-20261117.md) (**in PR #100, not merged to main at this snapshot**). Existing LIFE-01 release audit also in that PR.

**Next action:** curate LIFE-08..10 candidates and the remaining distinct vocabulary, verify academic sense/CEFR/IPA evidence, run isolated QA, and only then add any further Production content. Do not redo My Learning or assume the earlier 365 baseline is current.

## 1. Cách đọc trạng thái — không làm lại tính năng đã có

- **CODED**: đã có implementation trong main; không tự đồng nghĩa Production đang bật.
- **TESTED**: có unit/E2E trên PostgreSQL cô lập hoặc kiểm tra HTTP đọc-only; nêu rõ môi trường.
- **DEPLOYED**: commit chứa implementation có trên deployment Production; không chứng minh tính năng đã bật hoặc có schema.
- **ENABLED**: server flag/schema/actor/permissions đáp ứng trên môi trường cần dùng; không suy đoán từ UI hoặc README.
- **CONTENT RELEASED**: dữ liệu đã được phê duyệt, nhập và kiểm tra trong Production; không đồng nhất với file DRAFT trên GitHub.
- Thứ tự kiểm chứng: **CODE > TEST > CONFIG > live API/deployment > tài liệu lịch sử > giả định**. Nếu tài liệu cũ xung đột với code hoặc quan sát live, ghi rõ mốc thời gian.

## 2. Tính năng đã có — TUYỆT ĐỐI không lên kế hoạch xây lại từ đầu

| Nhóm | Hiện trạng có bằng chứng | File/code kiểm chứng |
|---|---|---|
| 5 game Solo | MATCH, BOMB, CAR, MATRIX, MEMORY có API start/play, UI, test; còn game chữ rơi ở trang học | api/index.js; public/app.js; public/matrix.js; public/memory.js; tests/solo-*.test.js; scripts/ux33-local-matrix-e2e.mjs |
| Tài khoản | Đăng nhập, tài khoản học viên, đổi mật khẩu, thu hồi session, tái kiểm tra khi trở lại tab; Admin reset password và audit | api/index.js; public/account.js; public/admin-users.html; docs/ux30-admin-user-management.md; docs/ux40-player-self-password-change.md; docs/ux41-revoke-all-player-sessions.md; docs/ux42-account-session-focus-revalidation.md |
| My Learning theo tài khoản | Một tổng hợp từ PostgreSQL theo authenticated player; shared + personal; không lấy localStorage làm nguồn chính cho tài khoản đăng nhập | GET /api/learning/me/summary; public/progress.html; public/ux10-progress.js; docs/ux19-unified-account-learning.md |
| Từ cá nhân & đồng bộ | CRUD thẻ cá nhân, đồng bộ giữa phiên/trình duyệt, nhập dữ liệu cũ có xác nhận và xử lý trùng, idempotent review | GET/POST/PATCH/DELETE /api/learning/personal; public/personal.html; docs/ux21-three-way-legacy-reconciliation.md; docs/ux23-unified-idempotent-review.md |
| SRS / lịch ôn | Queue, review, shadow schedule, cơ chế chống replay/concurrency và giao diện nhóm ôn; **Production có cổng bật riêng** | lib/srs-queue.js; lib/srs-release-gates.js; public/ux24-srs-panel.js; docs/ux24e-production-release-runbook.md |
| Từ sai & luyện lại | Sổ từ sai từ game, tự đưa từ sai vào review/SRS, nút Luyện từ duy nhất cạnh Làm mới lịch, thực hành có chấm đáp án | lib/game-mistakes.js; public/mistakes.html; public/practice.html; docs/ux27-game-mistakes-notebook.md; docs/ux28-focused-mistake-practice.md; docs/ux38-five-game-mistake-notebook.md |
| Learning Insights | **Đã có** 7/30 ngày, tổng review, số trận Solo, từ hay cần ôn, activity days; không phải tính năng mới cần xây từ đầu | GET /api/learning/insights; lib/learning-insights.js; public/ux29-insights.js; docs/ux29-learning-insights.md |
| Admin Vocabulary | **Đã có** tạo/sửa/ẩn chủ đề, tạo/sửa/ẩn từ, kiểm duyệt CEFR và lưu audit; không cần dựng lại CRUD | api/index.js: GET/POST/PATCH/DELETE /api/admin/topics, /api/admin/words, PATCH /api/admin/words/:id/cefr, GET /api/admin/cefr/reviews; public/app.js; public/ux06-admin.js; tests/cefr-admin.test.js |
| Admin người dùng | Danh sách/tìm kiếm, reset mật khẩu có step-up, thu hồi session cũ, lịch sử audit | public/admin-users.html; lib/admin-users-service.js; docs/ux30-admin-user-management.md; docs/ux31-admin-reset-history.md |
| Game audio | Nhạc và hiệu ứng game độc lập với phát âm từ | public/game-audio.js; docs/ux26-game-audio.md |
| UX44 nghe phát âm | **Đã lên Production**: Flashcard, danh sách My Learning, từ cá nhân, Luyện từ chỉ sau khi lộ đáp án. Web Speech API, ưu tiên en-GB, rate 0.88, không autoplay/ghi tiến độ | public/vocab-speech.js; public/vocab-speech.css; docs/ux44-vocabulary-pronunciation.md; tests/ux44-vocab-speech.test.js |
| UX45 QA | **Đã triển khai và merge PR #98**: anonymous Production GET+Chromium/Firefox, CI cô lập; không phải task mới | docs/ux45-production-qa.md; scripts/ux45-production-readonly-qa.mjs; .github/workflows/learning-ci.yml |

**Chú ý SRS:** lib/srs-release-gates.js yêu cầu CẢ WORDSKY_SRS_PRODUCTION_ENABLED và WORDSKY_SRS_PRODUCTION_SHADOW_ENABLED là true khi VERCEL_ENV=production. Audit này **không đọc Production env/schema** và **không kết luận SRS live đang bật**. Có UI/API/test không chứng minh khả năng dùng ngay trên Production. Các chức năng UX43 typed recall/reviewer vẫn là Preview/test-only; xem phần 5.

## 3. Dữ liệu từ vựng — phân biệt source và đã phát hành

- **Historical UX45 baseline before vocabulary imports:** /api/topics = **26 chủ đề**, /api/learning/vocabulary = **365 từ**. **Current live snapshot is 30 topics / 1,099 words** (see latest release section above).
- **Repo db/seed-vocabulary.json** = **280 từ / 26 topic**. Đây là bộ seed của source, **không phải** snapshot Production.
- **Repo vocab/cefr-review-all-topics.json** = **397 record** lúc audit: **260 UNREVIEWED, 137 PROVISIONAL**. PR #84 đã merge cập nhật evidence 20 từ; không coi PROVISIONAL là CEFR được chứng nhận.
- **LIFE-1000**: roadmap mục tiêu 10 batch × 100 mục. **LIFE-01..LIFE-07 có đủ 700/700 candidate** (mỗi file 100, bốn nhóm ×25); tất cả file ở trạng thái DRAFT, toàn bộ record là PROVISIONAL. **LIFE-08/09/10 chưa có batch JSON trong main**.
- Trong 700 LIFE-01..07 DRAFT candidates, **699 distinct items have since been imported to Production as PROVISIONAL**; `itinerary` was already present and skipped. Đó là trạng thái nhập dữ liệu, **không phải độc lập phê duyệt CEFR**. Thêm 35 từ legacy ngoài LIFE-1000.
- Có script kiểm tra offline: scripts/qa-vocab-life1000.mjs, các tests/vocab-life0*-content.test.js. Có importer CEFR đã duyệt: scripts/import-cefr-approved.js, nhưng **không được dùng để nhập các batch PROVISIONAL**.
- Repo có cơ chế đăng ký topic **disabled, guarded Preview**. **Production đã có 4 topic mới được tạo bởi đợt import owner-authorized ngày 2026-11-17**; không tự chạy lại script đăng ký chủ đề Preview chỉ vì PR còn mở.
- Còn PR #93 (LIFE-04 Cooking & Kitchen) và #94 (LIFE-05 Money & Payments) về topic registration; code của chúng **chưa ở main** tại thời điểm audit, cần tái kiểm tra mergeability trước khi xử lý.

Nguồn tra cứu: vocab/life-1000-roadmap.json; vocab/batches/LIFE-01.json .. LIFE-07.json; docs/vocab-life1000-rollout.md; docs/vocab-life07-full-draft-checkpoint.md.

## 4. QA và môi trường — đã xác nhận, nhưng đừng thổi phồng

| Evidence | Kết quả được xác nhận | Giới hạn |
|---|---|---|
| GitHub Actions #170 (run 44003931699), PR #98 | **SUCCESS**: 644/644 unit/PostgreSQL; browser/SRS E2E Chromium+Firefox trên PostgreSQL localhost cô lập | Không phải ghi/đọc dữ liệu học tập Production |
| UX45 read-only live | **14/14 nhóm PASS**; trang/assets HTTP 200; 26 topics, 365 words; guest protected routes 401; Chromium/Firefox simulated speech và mobile | Không thử loa thật iOS/Android, không login thật/ghi SRS hoặc game |
| Live Vercel | Production READY, commit cf870c0; main caf487f chứa thêm QA/docs từ PR #98 | GitHub merge không tự redeploy |
| GET /api/health | HTTP 200, ok=true, database=true | database=true chỉ là trạng thái cấu hình, **không phải DB SELECT health** |
| Runtime errors UX45 | Không thấy error cluster trong thời gian truy vấn (~1 giờ) | Không đại diện mọi lỗi lịch sử |

**Không chạy** Production POST, signup, login, game start, SRS review, import/migration hoặc reset user chỉ để xác minh. Muốn signed-in end-to-end thì dùng tài khoản QA được cho phép và môi trường/database cô lập. Hiện đã có sẵn E2E hai trình duyệt đồng bộ, SRS, game trên **PostgreSQL cô lập**; **không làm lại một test suite giống hệt nếu không có coverage gap cụ thể**.

## 5. Các hạng mục có code nhưng CHƯA phải chức năng hoàn chỉnh cho người dùng

- **Production SRS activation**: source code và mô phỏng đầy đủ; phải xác nhận schema/flags/migration/backfill theo docs/ux24e-production-release-runbook.md rồi mới gọi là bật live. Không đụng Production DB khi chưa phê duyệt riêng.
- **UX43C typed-recall research**: lib/ux43c-recall-service.js có điều kiện VERCEL_ENV !== production. DB migration 20261031_ux43c_typed_recall_pilot.sql chỉ dành môi trường QA/Preview tách biệt.
- **UX43E1 Admin recall draft workbench**: nhập/quản lý *draft riêng tư*, không phải công cụ duyệt/activate câu hỏi được bảo đảm.
- **UX43E2 reviewer/OIDC**: adapter/contract và test fake; **chưa có kết nối IdP thật, reviewer onboarding hay route phê duyệt Production**. Xem docs/ux43e2b2-oidc-flow.md.
- **Bulk import / publish LIFE-1000 trong Admin**: API hiện chỉ CRUD từng từ/chủ đề; chưa xác minh một pipeline hàng loạt có đối chiếu collision, approval, dry-run, idempotent import, báo cáo và rollback dùng được cho LIFE-1000.
- **Phát âm giọng thật**: Web Speech hoạt động theo trình duyệt, chưa có UI tùy chọn UK/US/tốc độ hoặc QA âm thanh loa mobile thật. Đây là mở rộng UX, không phải thiếu tính năng nghe.

## 6. PR cần xử lý (snapshot 2026-11-17)

- **#98 MERGED** — UX45 QA: https://github.com/vonghiazzz/wordsky-english-game/pull/98. Không mở lại kế hoạch UX45 từ đầu.
- **#82 OPEN** — offline audit câu gợi ý tiếng Việt mơ hồ: https://github.com/vonghiazzz/wordsky-english-game/pull/82. Đánh giá logic còn hữu ích rồi port vào nhánh mới, tránh merge conflict cũ.
- **#93 OPEN** — LIFE-04 topic registration: https://github.com/vonghiazzz/wordsky-english-game/pull/93.
- **#94 OPEN** — LIFE-05 topic registration: https://github.com/vonghiazzz/wordsky-english-game/pull/94.
- PR #93/#94 từng báo conflict với main. Trạng thái GitHub API gần nhất là 'unknown' trong lúc tính lại; **không kết luận merge sạch hay dirty nếu chưa recheck**. Ưu tiên tích hợp phần còn thiếu trên main mới, giữ nguyên các bước CI hiện có.

## 7. Backlog được sửa lại dựa trên những gì thực sự còn thiếu

**P0 — Readiness và độ tin cậy**
1. **Chỉ-read-only audit Production SRS/schema/flags** để xác định đang bật đúng hay chưa; đối chiếu với user flow hiện có, không chạy migration/review trên tài khoản thật. Đây là xác nhận **deployment state**, không phải viết lại UX24.
2. **UAT âm thanh thật** 1 desktop + 1 Android/iPhone, giọng phát có nghe được không, dừng/phát lại, điều hướng, thao tác không chấm điểm. Xử lý chỉ khi thấy lỗi thực tế.
3. **Signed-in Production UAT chỉ khi có môi trường QA và sự cho phép rõ**; test coverage tương tự đã có trong CI. Không tạo user test tùy tiện trên Production.

**P1 — Vocab publishing gap (mục tiêu có ích nhất)**
4. Trên **Admin CRUD đang có**, bổ sung hoặc tích hợp **batch staging/import/publish** có nguồn, preview diff, duplicate/collision detection, approval, dry-run, audit, atomic/idempotent import và rollback; giữ UUID/progress của học viên. **Không dựng lại trang Admin mới nếu chưa cần**.
5. Kiểm duyệt song ngữ + CEFR theo nghĩa/POS cho LIFE-01..07, review độ mơ hồ đáp án (xem PR #82); *approval* phải là quyết định thật, không tự đổi PROVISIONAL.
6. Xử lý #93/#94 trên main mới; tạo/sửa topic ở trạng thái disabled trước, cần phê duyệt riêng để mở. Sau đó phát hành **một batch nhỏ đã duyệt** qua isolated Preview → backup → Production release có kiểm soát.
7. Soạn LIFE-08/09/10, mỗi 100 record / bốn nhóm ×25, qua cùng contract/QA, **không import tự động**.

**P2 — Chỉ sau khi giải quyết P0/P1**
8. UX46 bổ sung voice selector UK/US và speed setting nếu người học cần; không làm mới Web Speech API.
9. UX49 chỉ mở rộng **Insights hiện có** với dữ liệu đáng tin cậy (không giả mastery hoặc accuracy từ nhãn 'đã nhớ').
10. UX50 giám sát/backup/restore/performance: audit mức độ hiện có trước; chỉ phát triển phần thiếu đã được chứng minh.

**Next single action**: kiểm định nội dung 734 từ PROVISIONAL đã import, xử lý các PR topic cũ cho tương thích Production và biên soạn/kiểm duyệt LIFE-08..10. Thực hiện read-only SRS audit riêng nếu cần, không viết lại UX24 hoặc Admin CRUD.

## 8. Hướng dẫn cho phiên ChatGPT/Codex tiếp theo

1. Đọc file này trước; xác minh SHA GitHub main và Production hiện tại; kiểm tra code trước khi kết luận task chưa có.
2. Bắt đầu từ: **Current State → Verified Evidence → Missing Gap → Safety Gate → Next Action**.
3. Các đường dẫn trọng tâm:
   - API/auth/admin: api/index.js; lib/admin-users-service.js; public/ux06-admin.js
   - Account/progress/personal: lib/learning-progress.js; lib/personal-vocabulary.js; public/ux10-progress.js; public/ux18-personal.js
   - SRS/game-mistakes: lib/srs-release-gates.js; lib/srs-queue.js; lib/game-mistakes.js; public/ux24-srs-panel.js
   - Insights/pronunciation: lib/learning-insights.js; public/ux29-insights.js; public/vocab-speech.js
   - Vocabulary: vocab/life-1000-roadmap.json; vocab/batches/; scripts/qa-vocab-life1000.mjs
   - QA/release: .github/workflows/learning-ci.yml; scripts/ux45-production-readonly-qa.mjs; vercel.json; docs/manual-vercel-release-policy.md
4. QA cơ bản trên checkout **Node.js 24**: npm ci --ignore-scripts; npm run check; npm test. Full browser/PostgreSQL phải dùng isolated environment theo CI. Smoke Production chỉ GET/HEAD, tuyệt đối không truy cập trái phép tài khoản.
5. Release: **Git deploymentEnabled=false** trong vercel.json. PR → CI isolated → Preview được phê duyệt → merge → Production staged/manual promote theo docs/manual-vercel-release-policy.md. **Không tự deploy, nhập từ, áp dụng SQL/migrations, sửa account hoặc bật feature flags**.
6. Khi một feature hoàn tất: cập nhật mục trạng thái, bằng chứng (SHA/PR/CI/Production), còn thiếu, và next action ngay trong file này; **đừng viết thêm một bản roadmap trùng lặp**.
7. README.md ở root còn mô tả trạng thái V4 MVP lịch sử ("chưa production", "260 từ"), **không phải snapshot live**. Dùng file này làm lối vào trạng thái dự án hiện hành, nhưng luôn kiểm tra lại code và live evidence.

**Out of scope of this audit:** không đọc dữ liệu người dùng cá nhân; không sửa game code; không chạy migration/seed/import; không thực hiện Production deployment.
