# Phase 2.1 — MATCH Solo

## Phạm vi đã triển khai

- Người chơi mở `/#solo` từ trang chủ hoặc thanh điều hướng, không cần phòng thi hay đăng nhập.
- Cấu hình chủ đề (một chủ đề hoặc toàn bộ), Easy/Normal/Hard, 3–20 cặp và 20–600 giây.
- Mặc định theo Phase 2.1: Easy, 6 cặp, 90 giây và 3 tim.
- Luật dùng chung engine MATCH: +100 điểm đúng, -25 điểm và -1 tim khi sai; hết 3 tim, hết giờ hoặc ghép hết cặp sẽ kết thúc.
- Easy không có nghĩa nhiễu, Normal thêm 2, Hard thêm 4. Máy chủ ưu tiên từ APPROVED theo CEFR tương ứng và dùng kho hiện có làm fallback như MATCH multiplayer.
- Lượt chơi được lưu trong `ws_solo_runs`. Học viên đăng nhập được gắn `user_id`; khách dùng một danh tính trình duyệt ổn định trong cookie HttpOnly ký HMAC, thời hạn 30 ngày. Tạo run mới không làm mất quyền truy cập run cũ của cùng guest.
- Reload cùng tab có thể tiếp tục lượt gần nhất qua `sessionStorage` + cookie. `sessionStorage` chỉ giữ run ID và pending action ID, không chứa token sở hữu. Lượt Solo không cộng XP và không đi vào bảng xếp hạng Phase 2.1.

## API

| Method | Path | Mục đích |
| --- | --- | --- |
| `POST` | `/api/solo/match/start` | Tạo lượt MATCH Solo và cấp cookie sở hữu |
| `GET` | `/api/solo/runs/:runId` | Đọc/đồng bộ trạng thái công khai, bao gồm timeout |
| `GET` | `/api/solo/runs/:runId/attempts/:attemptId` | Kiểm tra một thao tác đã được server áp dụng hay chưa |
| `POST` | `/api/solo/runs/:runId/answer` | Chấm một cặp trên máy chủ; idempotent theo `attemptId` |
| `GET` | `/api/topics` | Metadata chủ đề và số lượng tổng hợp; không trả các cặp từ |
| `GET` | `/api/admin/topics` | Kho từ đầy đủ, chỉ dành cho Admin đã xác thực |

Payload tạo lượt: `topic_id` (UUID hoặc `null`), `difficulty`, `question_count`, `duration_seconds`. Payload trả lời: UUID `attemptId`, `leftId`, `rightId`. Điểm, tim, thời gian và penalty do máy chủ quyết định. Public state không ghép English và meaning trong cùng record và không trả mapping bí mật.

Chọn lưu trạng thái trong PostgreSQL thay vì token stateless mã hóa vì lượt chơi cần cập nhật nguyên tử, chống double-submit trên nhiều Vercel instance và có thể tiếp tục sau reload. API khóa bản ghi bằng `FOR UPDATE`; receipt ràng buộc `attemptId` với đúng `leftId/rightId`, nên retry cùng thao tác là idempotent còn tái dùng ID cho thao tác khác bị từ chối. Khi response POST không rõ, frontend khóa thao tác mới, hỏi trạng thái attempt rồi mới retry cùng ID. Tạo lượt được giới hạn 30 lần/15 phút theo fingerprint IP đã băm; advisory transaction lock làm cho bước đếm/ghi được tuần tự giữa các instance, không phụ thuộc bộ nhớ tiến trình.

## Database và rollout

Migration additive: `db/migrations/20261023_220000_match_solo.sql`.

Bảng `public.ws_solo_runs` bật RLS và thu hồi quyền trực tiếp của `anon`/`authenticated` nếu các role Supabase này tồn tại; ứng dụng chỉ truy cập bảng qua backend PostgreSQL. Bộ local DB chạy migration này sau base schema để kiểm tra tính idempotent.

Không chạy file này trên Production trong quá trình triển khai code. Trước khi phát hành:

1. Backup và xác nhận đúng Preview database.
2. Đối chiếu host, database name và project ref của `WORDSKY_PREVIEW_DATABASE_URL`, bảo đảm khác Production; sau đó chạy riêng trên Preview:

   ```sh
   psql "$WORDSKY_PREVIEW_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20261023_220000_match_solo.sql
   ```

3. Chạy test API/UI và thử guest + học viên trên hai trình duyệt.
4. Xác nhận feature `MATCH` đang bật, cookie Secure hoạt động trên HTTPS và reload tiếp tục đúng lượt.
5. Chỉ lập kế hoạch migration Production sau khi Preview/UAT đạt.

## Giới hạn còn lại

- Chưa có trang lịch sử Solo hoặc Solo leaderboard.
- Chưa có job dọn các bản ghi `ws_solo_runs` cũ; cần chính sách retention trước khi lưu lượng lớn.
- Rate limit theo fingerprint IP là lớp bảo vệ cơ bản; lưu lượng lớn vẫn nên bổ sung WAF/rate limiting ở biên và chính sách dọn dữ liệu cũ.
- MATCH Solo là chế độ luyện tập, không phải hệ thống thi có giám sát; người dùng vẫn có thể biết nghĩa từ qua nội dung học công khai, nhưng API game và topic metadata không trả mapping bí mật của lượt đang chơi.
