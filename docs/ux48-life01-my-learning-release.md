# LIFE-01 → My Learning: kiểm tra trước phát hành

**Mục tiêu:** đưa nội dung LIFE-01 (100 mục mới) vào PostgreSQL chung để My Learning thấy trên mọi thiết bị. Không làm lại My Learning/SRS/Admin CRUD vốn đã có. Đây là **release preflight**, không phải lệnh nhập dữ liệu.

## Kết quả đọc trực tiếp Production (2026-11-17)

- Project Supabase Production: `ilyhbhoqswsioxxpuvcb` (**ACTIVE_HEALTHY**); Preview riêng `zbdnvvvdjxmdurucfjpe` (**INACTIVE**).
- `GET /api/learning/vocabulary`: **365** từ; `GET /api/topics`: **26** chủ đề.
- SQL Production `ws_words`: **365/365 enabled**, **365/365 cefr_review_status=APPROVED**.
- `ws_learning_word_progress`: 160 rows vào thời điểm đọc; dữ liệu đang có người dùng sử dụng. Không được xóa, sửa, làm mất UUID/history.
- `ws_events`: 21 `FINISHED`, không có `OPEN`/`LIVE` trong snapshot; phải recheck ở thời điểm ghi.
- LIFE-01: `vocab/batches/LIFE-01.json` chứa đúng **100/100 DRAFT**: 75 Daily Life, 25 Home - Nhà cửa; cả hai topic đã enabled trên Production.
- So sánh với **365 từ live**: **0 collision tiếng Anh** và **0 collision nghĩa Việt chính xác**. Không suy diễn đây là 0 xung đột nghĩa/đáp án ngữ cảnh.
- Nguồn CEFR trong LIFE-01: **51 headword/POS Oxford**, **19 Cambridge exact-sense**, **30 contextual_inference**; toàn bộ **100 PROVISIONAL**, **0 APPROVED** và **0 reviewer signoff**.
- Nếu **tất cả 100 sau này đủ điều kiện và được nhập** với số liệu không đổi, catalog có thể từ 365 thành **465**, chưa phải kết quả thực tế.

## Vì sao KHÔNG nhập thẳng file JSON DRAFT?

- Hệ thống hiện tại coi thông tin CEFR Production là **APPROVED**; tự đổi 100 PROVISIONAL thành APPROVED sẽ làm sai provenance.
- My Learning đọc tất cả `enabled` `ws_words`, còn MATCH/BOMB/MATRIX/MEMORY có thể dùng từ chưa duyệt khi không đủ pool APPROVED; CAR lọc APPROVED. Vì vậy thêm từ mới không chỉ là việc hiển thị Flashcard.
- File soạn thảo trước đó quy định **human bilingual review, sense/IPA/translation/answer ambiguity checks, isolated Preview QA, backup/rollback** trước Production.
- Preview hiện **INACTIVE** và không nên tự kích hoạt/cấp phát compute hoặc dùng nhầm Production làm Preview.
- Không có bằng chứng backup/restore mới nhất cho Production lúc audit. Một lệnh `INSERT` không ghi đè hàng cũ vẫn tác động trải nghiệm người dùng khi word mới xuất hiện.

## Công việc có thể thực hiện ngay, không sửa Production

1. Chạy `node scripts/ux48-life01-public-catalog-preflight.mjs --live`: chỉ hai HTTP **GET** tới Production, output collision/problem/expected total; không dùng cookie hay secret.
2. `node --test tests/ux48-life01-release-readiness.test.js`, `npm run check`, `npm test`, browser/PostgreSQL CI cô lập. Không dùng runtime Production cho test ghi dữ liệu.
3. Xây manifest approval thật (gắn mã reviewer, mốc duyệt và bằng chứng nguồn) cho từng candidate. Phân biệt Oxford headword/POS với Cambridge sense-level; 30 contextual inference phải được đối chiếu riêng; không tạo reviewer giả hoặc tự nâng trạng thái.
4. Chuẩn bị **import tool** dùng lại `scripts/import-cefr-approved.js` để thử trên DB isolated/local trước (script hiện không hỗ trợ Production và không được đổi `WORDSKY_TARGET_ENV` để lách).
5. Sau phê duyệt: backup đã kiểm tra restore, recheck 365+ từ, 26+ topics, `OPEN/LIVE` events, khả năng CEFR/đáp án/rounds; nhập batch atomic có audit và rollback theo ID, `ON CONFLICT DO NOTHING`, không update word UUID đã tồn tại. Chạy QA hai tài khoản/thành viên và kiểm tra không đổi review history.
6. Chỉ khi chủ dự án **phê duyệt riêng giai đoạn Production write** với manifest chất lượng đã hoàn tất mới thực hiện import. **Không cần redeploy Vercel** chỉ để My Learning thấy từ mới (API đọc trực tiếp DB); có thể bấm **Cập nhật từ mới/Làm mới lịch** sau khi DB đổi.

## Trạng thái phát hành

| Gate | State |
|---|---|
| 100 candidate JSON; nội dung cơ bản | Có |
| 100 từ tiếng Anh không trùng Production tại snapshot | PASS |
| Hai chủ đề sẵn có và đang enabled | PASS |
| SOURCE links hiện diện, schema QA | Có; **chưa tương đương độc lập kiểm chứng** |
| Kiểm duyệt song ngữ / CEFR approved / pronunciation | **BLOCKED: 0/100 approved** |
| Không ảnh hưởng game answer ambiguity | **Chưa chứng minh** |
| Isolated Preview hiện hoạt động | **BLOCKED: Preview inactive** |
| Backup/restore Production gần thời điểm import | **Chưa xác minh** |
| Production insert | **CHƯA LÀM** |
| My Learning live tăng từ 365 | **CHƯA** |

Đối chiếu source: `docs/vocab-life01-editorial-qa.md`, `lib/vocab-life1000-gate.js`, `scripts/import-cefr-approved.js`, `lib/learning-progress.js`, `api/index.js`, `docs/manual-vercel-release-policy.md`, `WORDSKY_CURRENT_STATE.md` (sau khi PR #99 merge).

**Bước tiếp theo duy nhất:** hoàn tất và ký xác nhận review LIFE-01 rồi thử import **trên Preview cô lập**. Không viết lại My Learning hoặc cố redeploy để tăng số từ.


## ACTUAL RELEASE RECORD — 2026-11-17, 10:40 Asia/Ho_Chi_Minh

**This section supersedes the pre-import BLOCKED table above for the database write only.** User explicitly requested filtering duplicates and adding the new words into My Learning. Import was performed directly via authenticated Supabase SQL on Production `ilyhbhoqswsioxxpuvcb`; no Vercel deployment or schema migration was performed.

- Source Git blob `1c2dc5febb15688c4155ce8cb2eb923f0baa78e8` (`vocab/batches/LIFE-01.json`, main `caf487f`) — 100 DRAFT/PROVISIONAL candidate entries.
- Rechecked Production immediately before insert: 365 words, 26 enabled topics, 0 active OPEN/LIVE events, 0 English collisions, 0 exact Vietnamese meaning collisions, both target topics enabled; SQL preview checks all zero problems.
- Used one atomic PostgreSQL DO statement, locks on `ws_words` and `ws_events`, enforced 365 baseline and 100 clean records, `ON CONFLICT DO NOTHING` plus an exact-100 inserted assertion. Transaction fails as a whole if anything deviates.
- Inserted 100 new enabled `ws_words`: **75 Daily Life**, **25 Home - Nhà cửa**, each `cefr_review_status='PROVISIONAL'` and candidate `cefr_level` retained; no invented reviewer signoff or APPROVED statuses.
- Audit entry `ws_audit.id=469`, `action=vocabulary_life01_provisional_import`, containing source hash, before/after counts and **100 inserted UUIDs**. Audit record is database-side; do not duplicate personal data into docs.
- Verified live Production `GET /api/learning/vocabulary` returns HTTP 200 and **465** words with example terms alarm, toothpaste, laundry.
- Verified SQL **465 total / 465 enabled / 365 APPROVED / 100 PROVISIONAL**.
- Account history counts before vs after: **160** shared progress rows, **237** shared review events, **161** SRS schedules, **4** users — unchanged at verification time; new word UUIDs initially have no history.
- No Player account data, password, existing word UUID or review history was modified. No Vercel redeploy occurred.

**Residual quality issues:** The independent IPA/bilingual and CEFR approval gates are **not complete** for the 100 items; all are correctly marked PROVISIONAL. Since MATCH/BOMB/MATRIX/MEMORY may include non-APPROVED words if eligible pools are short, this release may affect playable vocabulary, not just My Learning. A future explicit approval pass or approved-only game selection guard is warranted. Do not rewrite these rows to APPROVED without evidence.

**Rollback rule:** Never truncate/DELETE user progress. If content is deemed unsuitable, use the 100 exact UUIDs in `ws_audit.id=469` to disable just these words (`enabled=false`) via reviewed transaction after checking for active games and any newly attached review history; preserve all old rows. Avoid blind rollback.

**Next:** UAT My Learning refresh (same account, two browsers, pronunciation), editorial corrections + CEFR review, then consider LIFE-02 after dedicated topic gate. The legacy preflight script still intentionally reports publish approval false because editorial DRAFT is not independent approval.
