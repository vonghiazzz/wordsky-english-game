# WordSky Arena V4 — Thi đấu tiếng Anh trực tuyến

> **Trạng thái: mã nguồn MVP / chưa triển khai production.** Bộ backend có hợp đồng API và game logic, giao diện responsive; **cần kết nối PostgreSQL, chạy migrations và seed, cấu hình admin + session, kiểm thử tích hợp đa thiết bị trước khi mở giải thật**. WordSky V3 production không bị thay đổi.

## 1. Phạm vi đã được triển khai trong V4

- Giữ bản học từ vựng **WordSky V3** tại `/learn.html` (Flashcard, 26 chủ đề, 260 từ mẫu, chữ rơi).
- Trang chủ Arena responsive, 3 minigame riêng:
  - **Match Master**: chọn từ tiếng Anh và nghĩa Việt để nối cặp. Mức Normal/Hard thêm nghĩa nhiễu.
  - **Bomb Defuser**: đồng thời có nhiều bom chứa nghĩa Việt; gõ tiếng Anh trước hạn, bỏ lỡ 3 quả mất 3 tim và thua.
  - **Lane Escape**: xe 5 làn, né `🧱`, `⭐` cộng 50% điểm, `×2` nhân đôi điểm; phím ←/→, A/D, Enter/Space hoặc chạm màn hình.
- **Phase 2.1 — MATCH Solo** tại `/#solo`: tự chọn chủ đề, độ khó, 3–20 cặp và thời gian; không cần phòng thi. Lượt được backend chấm và lưu riêng, không cộng XP/leaderboard.
- Học viên: tự đăng ký / đăng nhập (username, mật khẩu >=8 ký tự), điểm danh tối đa 1 lần/ngày theo `Asia/Ho_Chi_Minh`, nhận XP, chuỗi ngày và rank theo XP.
- Admin riêng: đăng nhập qua credential phía server, quản lý chủ đề/thẻ, bật/tắt MATCH/BOMB/CAR/SIGNUP/ATTENDANCE; tạo/sửa/mở/bắt đầu/kết thúc cuộc thi.
- Giải đấu: mã phòng ngẫu nhiên, mật khẩu riêng được hash, tên hiển thị, giới hạn người chơi (2–500), 1–12 vòng; mỗi vòng cấu hình chế độ, topic, độ khó, thời lượng, số lượt, điểm đúng, điểm trừ, hệ số.
- Mọi lượt được backend chấm (không tin điểm do trình duyệt gửi). `ws_runs` khóa bản ghi khi cập nhật để chống trả lời đồng thời; 1 lượt chơi/participant/round.
- Bảng tổng sự kiện (sum `score × weight`) có tie-break số câu đúng, thời điểm vào; trình duyệt hỏi lại 2,5 giây/lần. Các vòng đồng bộ giờ bắt đầu/kết thúc theo server.
- Check-in, điểm và giải lưu trong **PostgreSQL** để nhiều thiết bị xem chung.

## 2. Chưa có / giới hạn cần biết

- **Chưa có DB production, SESSION_SECRET, ADMIN_PASSWORD_HASH trong Vercel WordSky hiện tại** → V4 chưa chạy được trên website public. Cần hoàn tất hạ tầng trước khi deploy.
- Chưa có tích hợp GitHub Auto Deploy được xác nhận; quyền ghi GitHub qua kết nối ChatGPT từng trả về 403. Gói ZIP này chưa được push.
- `GET /api/health` kiểm tra hàm và có biến `DATABASE_URL`, **không kiểm tra kết nối DB thật**. Chưa có E2E trên PostgreSQL thật trong môi trường này; chưa xác nhận tất cả API, nên **không dùng production ngay khi chỉ nhìn test unit đạt**.
- Realtime cập nhật bảng điểm qua **polling 2,5 giây**, không phải WebSocket liên tục. Phù hợp pilot khoảng 2–30 người; tải lớn cần load-test, cân nhắc SSE/WebSocket.
- Thí sinh có thể dùng DevTools, nguồn WordSky GitHub Public chứa dữ liệu từ vựng; đây không phải nền tảng chống gian lận cấp giám sát. Backend không nhận điểm từ client nhưng không chặn việc người chơi tham khảo đáp án có sẵn.
- Điểm V3 localStorage không phải điểm thi có xác thực; **không nhập điểm cũ vào bảng xếp hạng trực tuyến**. Có thể nhập bộ từ vựng V3 bằng script và giữ lại các thẻ tự tạo.
- Chưa tích hợp email quên mật khẩu, CAPTCHA, anti-bot quy mô lớn, phân quyền nhiều admin, lịch sử chỉnh sửa từ ngữ theo phiên bản, giám sát và backup DB tự động. Ban đầu là **một admin cấu hình qua biến môi trường**.
- Giải đấu dùng 1 mật khẩu chung và mã phòng; mật khẩu phòng không phải mật khẩu tài khoản học viên. Khi người chơi vào, cookie HttpOnly mang phiên tham gia, tránh gửi participant id tùy ý.
- Admin chỉ có thể chỉnh cuộc thi trước giờ LIVE. Không sửa số vòng/điểm giữa giải.

## 3. Kiến trúc

```text
Web client (Vercel static /public)
    ├── /learn.html: bộ Flashcard WordSky V3 (localStorage)
    └── /: Arena (học viên, admin, lobby, ba game)
           │ fetch /api/*
Vercel Node Function api/index.js
    ├── Cookie HttpOnly: admin, học viên, thí sinh
    ├── Service xác thực: scrypt, HMAC, login-throttle
    ├── Service check-in: ngày Việt Nam + XP + streak
    ├── Cuộc thi: room join, max-players, server round windows
    ├── Máy chấm điểm: MATCH / BOMB / CAR
    └── PostgreSQL (Neon/Supabase/managed Postgres)
           ├── ws_users, ws_checkins
           ├── ws_topics, ws_words, ws_features
           ├── ws_events, ws_rounds, ws_participants, ws_runs
           └── ws_login_failures, ws_join_failures, ws_audit
```

Tất cả private credentials chỉ đi vào Vercel **Environment Variables**, không lưu tại GitHub. Không có token hoặc mật khẩu trong source.

## 4. Cài đặt local (Node.js >=22, npm, PostgreSQL)

1. Tạo một PostgreSQL test database. Không dùng DB doanh nghiệp chứa dữ liệu thật.
2. Chạy trong thư mục dự án:

```bash
npm install
cp .env.example .env
```

3. Điền `.env` (không commit). Yêu cầu `DATABASE_URL`, `APP_ORIGIN=http://localhost:3000`, `SESSION_SECRET` tối thiểu 32 ký tự, `ADMIN_USERNAME` và `ADMIN_PASSWORD_HASH`. Tạo `SESSION_SECRET` bằng `openssl rand -hex 32` rồi dán trực tiếp trong `.env` của máy bạn; **không gửi lên chat**.
4. Tạo hash mật khẩu Admin do bạn tự chọn (tối thiểu 8 ký tự):

```bash
read -rs ADMIN_NEW_PASSWORD; echo
export ADMIN_NEW_PASSWORD
npm run hash-admin
unset ADMIN_NEW_PASSWORD
```

Dán kết quả vào `ADMIN_PASSWORD_HASH` trong `.env`. Tránh lưu mật khẩu plaintext trong source/shell history trên máy dùng chung.

5. Tạo bảng và nạp 26 chủ đề:

```bash
psql "$DATABASE_URL" -f db/schema.sql
npm run seed
```

6. Chạy server:

```bash
npm run dev
```

Mở `http://localhost:3000`. Kiểm tra `http://localhost:3000/api/health`. Node >=22 hỗ trợ `--env-file`; dự án khuyến nghị Node 22/24.

**Lưu ý:** `npm install` yêu cầu internet. Môi trường thực hiện trong ChatGPT không truy cập registry.npmjs.org, vì vậy các bài kiểm tra backend + PostgreSQL chưa thể chạy ở đây.

## 5. Chuyển thẻ tự tạo từ WordSky V3

Trên WordSky V3: Quản lý từ vựng → **Xuất JSON**. Trên máy đã cấu hình DB V4 chạy:

```bash
node --env-file=.env scripts/import-v3.js /path/to/wordsky-vocabulary.json
```

Script nhập **chỉ thêm thẻ còn thiếu**, không xóa các thẻ hiện có. Nên sao lưu dữ liệu trước khi nhập. **Bảng điểm localStorage V3 không đồng bộ tự động với điểm xếp hạng sự kiện V4.**

## 6. Đưa lên Vercel an toàn

1. Tạo branch mới từ GitHub Public `vonghiazzz/wordsky-english-game`, ví dụ `feature/arena-v4`; upload nội dung ZIP vào branch, **không ghi đè production `main` khi chưa test**.
2. Tạo một DB PostgreSQL managed trên Vercel Marketplace (ví dụ Neon) và liên kết vào **Preview**. Kiểm tra gói/billing trước khi xác nhận tạo dịch vụ.
3. Thiết lập các environment variables: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `APP_ORIGIN` cho Preview. `APP_ORIGIN` là đúng domain preview để bảo vệ request khác origin.
4. Chạy `db/schema.sql` và `scripts/seed.js` ở đúng database của V4. **Không chạy migration nhầm vào DB production dự án khác.**
5. Deploy branch Preview, kiểm tra `GET /api/health`, đăng nhập admin, tạo 2 account học viên, điểm danh 1 lần/ngày, tạo/mở phòng bằng mật khẩu, hai trình duyệt cùng tham gia, khởi động, chơi đủ MATCH → BOMB → CAR, xem bảng điểm, khóa kết quả.
6. Sau khi mọi bước qua kiểm tra, merge `feature/arena-v4` → `main` và chạy production migration; Vercel Git Integration sẽ tự deploy nếu đã liên kết.
7. Trước khi đưa production, thay `APP_ORIGIN` sang `https://wordsky-english-game.vercel.app`, chắc chắn có database và admin hash production; kiểm tra trang `/learn.html` vẫn còn bộ WordSky V3.

## 7. Quy tắc tính điểm / rank

| Mục | Mặc định / Điều kiện |
|---|---|
| Điểm danh | +20 XP, thưởng thêm +5 XP/ngày streak (tối đa +35 thưởng), 1 lần/ngày GMT+7 |
| Rank | Đồng: 0, Bạc: 200, Vàng: 600, Bạch kim: 1.400, Kim cương: 3.000 XP |
| Nối từ | +100 điểm đúng, -25 sai; Easy không có nghĩa nhiễu, Normal +2, Hard +4 |
| Bom | +100 đúng, -25 sai, bom quá hạn mất 1 tim; mất 3 tim kết thúc |
| Xe 5 lane | +100 làn an toàn, ⭐ +50%, `×2` nhân đôi, `🧱` -25 và mất 1 tim |
| Tổng giải | Tổng `(điểm mỗi vòng × hệ số vòng)`. Điểm/hệ số/time/câu hỏi/chủ đề tùy admin cấu hình |
| Giới hạn | 1 lượt chơi / 1 thí sinh / 1 vòng, người vào phòng tối đa 2–500, 1–12 vòng |
| Thời gian | Vòng có cửa sổ đồng bộ theo server. Trả lời hết hạn không được ghi điểm |

## 8. Chạy test hiện có

```bash
npm run check
npm test
```

Các test `node:test` kiểm tra mức rank, check-in, chuẩn hóa câu trả lời, cấu hình vòng, nối cặp, nghĩa nhiễu, tính điểm bom, xe 5 lane + nhân đôi điểm, chữ ký phiên và xử lý mật khẩu. Kiểm tra màn hình mock với Playwright (Python) tại `scripts/ui_mock_test.py` nếu môi trường có Playwright và Chromium.

**Cần bổ sung trước sản xuất:** integration tests với PostgreSQL thật, rate limiting/proxy tests, race-condition tests khi nhiều thí sinh nộp đồng thời, load tests 30–500 clients, Browser E2E trên Preview Vercel, bảo mật/backup/khôi phục DB và đo độ trễ truy cập.
