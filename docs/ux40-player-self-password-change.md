# UX40 — Người chơi tự đổi mật khẩu

## Tính năng

Người chơi đã đăng nhập mở **Tài khoản** bằng cách bấm tên ở góc trên
trang Arena, hoặc từ **My Learning → Bảo mật tài khoản**. Không thêm
nút đổi mật khẩu hoặc liên kết trùng lặp bên dưới MATCH/BOMB/CAR,
MATRIX/MEMORY hay trang thi đấu.

Trang `/account.html` hiển thị tên tài khoản do server xác minh và
biểu mẫu gồm: mật khẩu hiện tại, mật khẩu mới, xác nhận mật khẩu mới.
Có nút ẩn/hiện riêng cho mỗi trường, nút đăng xuất, trạng thái lỗi và
hướng dẫn đăng nhập lại. Admin không thể dùng API này để đổi mật khẩu
owner; Admin reset vẫn ở UX30, tách biệt.

## API, xác thực và dữ liệu

**POST** `/api/auth/change-password`

Body:
- `current_password`: chuỗi hiện tại, 1–1024 ký tự
- `new_password` và `confirm_password`: phải trùng khớp
- `expected_actor_id`: UUID tài khoản đã xác minh từ `auth/me` (optional
  actor pin cho trường hợp đổi account giữa hai tab)

Không chấp nhận `user_id` từ URL/body để chọn mục tiêu: đối tượng luôn
là `mustPlayer(req).id`, kiểm tra bằng signed, versioned, HttpOnly cookie.
Request phải có Origin rõ ràng, khớp APP_ORIGIN của Production hoặc
VERCEL_URL của Preview cô lập. Không suy ra trusted Origin từ Host do
client kiểm soát. Mọi API khác giữ cơ chế same-origin cũ.

Chính sách mới **12–128 ký tự**, phải có chữ và số, không chứa username
và phải khác mật khẩu đang dùng. Dùng lại `hashPassword` (scrypt với
salt ngẫu nhiên), `verifyPassword` timing-safe và validation UX30.
Mật khẩu cũ sai bị ghi một lượt thất bại vào bộ giới hạn đăng nhập
(`ws_login_failures`, tối đa 10 lần trong 15 phút/IP).

Giao dịch PostgreSQL của **chính người chơi**:
1. Đọc `ws_users` bằng primary key của actor và `FOR UPDATE`.
2. Kiểm tra session_version *lần nữa dưới row lock* để chống tranh chấp
   khi Admin reset hoặc tab khác đổi mật khẩu đồng thời.
3. Kiểm tra mật khẩu hiện tại, độ mạnh và mật khẩu mới khác mật khẩu cũ.
4. Ghi scrypt hash, tăng `session_version`, cập nhật
   `password_changed_at` trong **cùng một transaction**.
5. Commit và xóa cookie auth hiện tại (`Max-Age=0`). Toàn bộ cookies
   cũ trên máy khác không còn hợp lệ khi truy cập API. Người chơi đăng
   nhập lại bằng mật khẩu mới.

Response thành công chỉ gồm `ok:true`, `sessions_revoked:true`,
`reauth_required:true`, không trả mật khẩu, hash, salt, token, username
nhạy cảm hoặc bảng điểm. Không lưu password trong localStorage,
sessionStorage hay log. Nếu mất phản hồi sau khi POST, giao diện
không tự gửi lại mà hướng dẫn kiểm tra đăng nhập bằng mật khẩu mới.

**Không cần migration:** `ws_users.session_version` và
`password_changed_at` đã có từ UX30. Không đụng đến SRS, cá nhân,
Flashcard, điểm số, streak, room participation hoặc lịch sử game.
Không thay đổi tài khoản người dùng thực trong QA.

## Gate CI / Preview / Production

1. Unit test: player/guest/admin, Origin, actor pin, sai mật khẩu hiện
   tại, xác nhận/độ mạnh, unchanged, 10-attempt throttling,
   row-lock/session-version race, no learning writes.
2. Local-first PostgreSQL17, Chromium và Firefox: hai user QA tạm,
   hai phiên cùng user trên hai thiết bị, đổi qua UI 360/390px,
   bảo toàn XP và reviewed word, vô hiệu hóa phiên cũ, đăng nhập mới,
   không ảnh hưởng user khác; dọn user QA và kết quả.
3. Chạy cả hai job WordSky Learning CI trên exact PR commit.
4. Chỉ tạo một manual Vercel Preview sau khi CI xanh; xác minh health,
   static account page, không thực hiện đổi mật khẩu bằng tài khoản thật.
   Nếu cần browser write QA phải dùng isolated Preview database.
5. User nghiệm thu Preview, review/merge, sau đó *một* manual Production
   deployment theo đúng commit main. Không sửa password user Production
   trong smoke test; kiểm tra health, login không ghi và UI.
6. Nếu cần rollback, quay về deployment Production trước UX40. Không
   đụng schema/tiến độ vì tính năng additive không có migration.

## UX phân biệt

Đây là **đổi mật khẩu khi biết mật khẩu hiện tại**. Người quên mật khẩu
phải liên hệ Admin, nơi đã có reset UX30 với step-up authentication.
Không thêm quy trình gửi email OTP/khôi phục nếu chưa có hệ thống
email xác minh danh tính.
