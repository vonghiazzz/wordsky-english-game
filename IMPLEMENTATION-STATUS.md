# WordSky Arena V4 — Handoff / Trạng thái kỹ thuật

## Current State

- V3: static website đang có người sử dụng tại `https://wordsky-english-game.vercel.app`, lưu localStorage.
- V4: dự án mới trong gói ZIP, chưa push GitHub, chưa cấu hình DB + auth secrets, chưa deploy.
- 26 chủ đề / 260 thẻ mẫu đã được trích từ V3 vào `db/seed-vocabulary.json`.
- 3 engine scoring + frontend admin/player/event/attendance/rank đã được viết.
- `node --check` và `node --test` chạy thành công; smoke trình duyệt giao diện giả lập qua Playwright thành công.

## Blocker

- Vercel project chưa có `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`.
- Cần người sở hữu tạo cơ sở dữ liệu managed và cung cấp các secret **trực tiếp trên Vercel** (không gửi vào chat), xác nhận billing.
- GitHub connector từ phiên trước trả 403 khi cố ghi file vào `vonghiazzz/wordsky-english-game`; cần push qua quyền người sở hữu trên Mac/GitHub.
- PostgreSQL integration tests chưa chạy vì không có internet/npm/DB trong runtime tạo artifact.

## Research / Product Goal

- Thi đấu nhiều người trong cùng phòng, có mật khẩu, admin chọn chủ đề/độ khó/thời gian/điểm/số lượng tham gia, leaderboard chung từ server.
- Điểm danh ổn định và rank XP để tăng động lực học tập.

## Engineering Goal

- Production deployment có bảo mật: admin login bằng scrypt + session HMAC HttpOnly, user accounts, điểm do server chấm, dữ liệu DB, giới hạn người chơi transaction row lock, một run/round.
- Check game fairness/time windows; rollback an toàn nếu deploy sai.

## Next Actions

1. Người sở hữu review gói V4 và chọn DB/provider trên Vercel.
2. Provision DB + set server-side secrets.
3. Apply schema + seed + test API + 2 browsers.
4. Upload code lên feature branch, deploy Preview và kiểm tra end-to-end.
5. Chỉ khi đã pass mới nâng production URL hiện tại.
