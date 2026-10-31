# UX41 — Người chơi đăng xuất tất cả thiết bị

## Goal / scope

Sau UX40 tự đổi mật khẩu, WordSky cho phép học viên đã đăng nhập
**thu hồi mọi phiên đăng nhập** mà **không cần đổi mật khẩu**. Tác vụ ở
`/account.html`, cùng khu vực Bảo mật tài khoản, không tạo tab
điều hướng mới và không thêm nút vào màn chơi.

Phù hợp khi người chơi làm mất điện thoại hoặc muốn đăng xuất tài khoản
ở các trình duyệt cũ. Đây **không phải** giải pháp khắc phục mật khẩu
đã lộ: nếu nghi ngờ kẻ khác biết mật khẩu thì phải dùng UX40 **Đổi
mật khẩu** (vốn cũng thu hồi mọi phiên). Không tuyên bố WordSky
có danh sách thiết bị hay khả năng chọn một thiết bị để thu hồi,
vì ứng dụng hiện chỉ có versioned signed cookies, không có bảng
lưu phiên thiết bị.

## API và bảo mật

`POST /api/auth/revoke-sessions`

Required body:
- `current_password`: mật khẩu hiện tại, tối đa 1024 ký tự;
- `confirm_revoke_all: true`: người dùng phải xác nhận tất cả
  thiết bị, bao gồm thiết bị hiện tại, sẽ phải đăng nhập lại;
- `expected_actor_id`: UUID từ `GET /api/auth/me`, dùng làm
  actor-pin khi đổi tài khoản giữa các tab (nếu được cung cấp).

Quyền sở hữu: `mustPlayer(req)` xác thực **server-signed HttpOnly**
player cookie và kiểm tra session version. Actor luôn lấy từ
cookie đã xác thực, không tin ID/role do client gửi để chọn đối
tượng. Guest, Admin, người dùng khác và stale session bị từ chối.

Origin phải hiện diện và bằng server-configured `APP_ORIGIN` trên
Production hoặc `VERCEL_URL` của Preview. Không lấy trusted
Origin từ untrusted `Host`/Forwarded header. Bộ durable login-throttle
cũ dùng chung, 10 lần sai trong 15 phút theo IP.

PostgreSQL transaction của actor:
1. `BEGIN`, chọn đúng hàng `public.ws_users` theo `actor.id`
   bằng `FOR UPDATE`.
2. Kiểm tra `session_version` **lần hai trong lock**, để tránh
   race với UX30 Admin reset hoặc UX40 đổi mật khẩu.
3. Xác minh mật khẩu hiện tại bằng WordSky `verifyPassword`.
   Sai mật khẩu => rollback, ghi failure ngoài transaction.
4. `UPDATE public.ws_users SET session_version=session_version+1`
   đúng actor; kiểm tra version tăng chính xác một đơn vị.
5. `COMMIT`, xóa phiên cookie hiện tại bằng `Max-Age=0`.
   Mọi player cookie cũ, trên các trình duyệt khác, bị từ chối
   ở lần API tiếp theo. Không hỗ trợ thu hồi riêng từng thiết bị.

Response thành công:
`{ok:true,sessions_revoked:true,reauth_required:true,password_unchanged:true}`

Response không chứa password, hash, token hoặc thiết bị. Tuyệt đối
không thay đổi `password_hash`, `password_changed_at`, XP,
streak, review history, SRS queue, từ vựng cá nhân hay Solo run.
Guest/competition sessions độc lập không bị hủy bởi player action.
Không có schema migration; chỉ dùng `session_version` từ UX30.

## QA / gate

1. Unit: guest/admin/stale/version mismatch, Origin, actor pin,
   explicit confirmation, wrong password throttling, SQL row lock,
   response privacy, unchanged password and learning data.
2. PostgreSQL17 + Chromium/Firefox cô lập: dùng cùng hai user QA
   của UX40; một user có hai browser sessions, yêu cầu thu hồi
   qua giao diện; xác minh cả hai cookie hết hiệu lực, login
   lại bằng **mật khẩu cũ** vẫn thành công, user còn lại không
   ảnh hưởng. Kiểm tra mobile viewport 360/390px và dọn QA.
3. GitHub CI xanh trên exact PR SHA. Không bắt đầu Vercel Preview
   khi CI còn đỏ, không cho phép Production DB làm Preview QA.
4. Một manual Preview duy nhất sau khi CI xanh: HTTP health,
   static account page, guest state và isolated auth flow.
5. Review & nghiệm thu, merge PR, một manual Production build.
   Production smoke test chỉ đọc GET, **không tự thu hồi phiên thật**.
6. Rollback về UX40 khi cần; không đụng database data/schema.

## UX messaging

Hành động **Đăng xuất** bình thường chỉ xóa cookie thiết bị hiện tại.
Hành động **Đăng xuất tất cả thiết bị** trong khu vực riêng phải nhập
mật khẩu hiện tại + checkbox xác nhận, và buộc đăng nhập lại.
Hành động **Đổi mật khẩu** là quy trình riêng và cũng vô hiệu hóa
mọi session, nên không cần thực hiện cả hai.
