# UX61.11 — Điền phiếu kiểm duyệt WordSky trực tiếp trên máy (không cần sửa JSON)

Đây là **công cụ chỉ xử lý phiếu trong trình duyệt**, không phải API xét duyệt hay hệ thống xác thực người đánh giá. Bản offline vẫn hoạt động độc lập.

**UX61.12 đã thêm đường dẫn trên WordSky:** https://wordsky-english-game.vercel.app/editorial-reviewer.html

Biểu mẫu này được tải dưới dạng HTML tĩnh, không có nút gửi lên server. Phản hồi có `Cache-Control: no-store`, `noindex`, CSP chặn kết nối mạng (`connect-src 'none'`) và chặn gửi form (`form-action 'none'`). Dữ liệu được nhập/xuất tại thiết bị người đánh giá. Người điều phối vẫn gửi **riêng** một mẫu A hoặc B. Việc mở Cambridge bằng liên kết chủ động sẽ đi đến website bên ngoài, nhưng không kèm nội dung phiếu.

Để bảo mật hơn khi người đánh giá sử dụng thiết bị không tin cậy hoặc không muốn tải HTML trực tiếp từ website, dùng file `tools/ux61-11-reviewer-form.html` offline như trước. File nằm tại `tools/ux61-11-reviewer-form.html` trong repository. Mở file HTML bằng Chrome hoặc Firefox trên máy tính, không cần chạy server.

## Cách dùng cho hai người đánh giá độc lập

1. Người điều phối kiểm tra kho từ production trước: `node scripts/ux61-8-review-production.mjs --live`, sau đó gửi **riêng** file `docs/ux61-9-review-templates/ux61-9-REVIEWER_A.json` hoặc `REVIEWER_B.json` cho từng người. Gửi cùng file HTML này, nhưng không gửi kết quả của người còn lại.
2. Người đánh giá mở file HTML ở máy của mình, chọn mẫu JSON được cấp; lần lượt xác định “có thể đề xuất phân xử”, “cần chỉnh sửa”, hoặc để trống.
3. Với trường hợp có thể đề xuất: nhập câu hỏi ngữ cảnh tiếng Việt không chứa từ tiếng Anh cần đoán; nhập mỗi đáp án tiếng Anh có thể chấp nhận vào **một dòng**, bao gồm từ đích. Nhập giải thích rõ ràng. Với trường hợp cần sửa: chỉ nhập giải thích, không nhập đáp án để chấm.
4. Đọc từ điển bằng liên kết Cambridge sau khi chủ động nhấn. Sau khi kiểm tra nguồn, tick xác nhận cho từng thẻ đã điền.
5. Nhấn **Kiểm tra & xuất JSON**. Gửi file `ux61-9-REVIEWER_A-filled.json` hoặc `ux61-9-REVIEWER_B-filled.json` qua kênh riêng. Không gửi mật khẩu hoặc mã đăng nhập WordSky.
6. Người điều phối chạy công cụ kiểm tra chặt tại repository:

```sh
node scripts/ux61-9-blind-review.mjs --compare \
  ./review-local/ux61-9-REVIEWER_A-filled.json \
  ./review-local/ux61-9-REVIEWER_B-filled.json

node scripts/ux61-10-adjudication.mjs \
  ./review-local/ux61-9-REVIEWER_A-filled.json \
  ./review-local/ux61-9-REVIEWER_B-filled.json \
  --output ./review-local/ux61-10-report.md
```

Mẫu có thể được điền một phần và xuất thành JSON; công cụ đối chiếu sẽ hiển thị phần nào còn thiếu. File được **tải xuống thiết bị**, không gửi lên WordSky. Mở liên kết từ điển sẽ tự chủ động truy cập trang web bên ngoài, nhưng nội dung phiếu không được gửi kèm.

## UX61.13 — Kiểm tra tính toàn vẹn mẫu nguồn ngay tại biểu mẫu

Biểu mẫu trực tuyến và HTML offline hiện kiểm tra **đúng mã phiên bản nguồn**, hướng dẫn mẫu và toàn bộ thông tin bất biến của 6 thẻ (UUID, từ, chủ đề, nghĩa, ví dụ, bản dịch, liên kết từ điển). Nếu người đánh giá chọn mẫu A/B cũ, sửa tay hoặc chứa dữ liệu nguồn bị thay đổi, biểu mẫu từ chối tải và hướng dẫn xin mẫu mới.

Nếu WordSky sau này thay đổi kho từ nguồn một cách hợp lệ, đội phát triển phải đối chiếu lại nguồn production và phát hành lại **cả** hai mẫu A/B, bản HTML offline và trang public trong một PR được kiểm thử. Không nới lỏng cổng vì lý do tiện lợi.

Đây là đối chiếu mã phiên bản và dữ liệu tham chiếu được nhúng trong HTML tĩnh, **không phải chữ ký số, không chứng minh tệp được gửi bởi ai, và không thay thế** lệnh kiểm tra server-side ở UX61.9/61.10. Không phải nguồn phê duyệt nghĩa hay chấm điểm.

## Chốt bảo mật và phát hành

- File HTML không dùng thư viện từ CDN, không có endpoint upload, không có `fetch` hoặc `XMLHttpRequest` và giới hạn `connect-src 'none'` để chặn kết nối mạng tự động.
- Mọi dữ liệu từ JSON người đánh giá cung cấp đều hiển thị bằng `textContent`, không dùng `innerHTML`. Ký tự đặc biệt hoặc HTML trong ví dụ sẽ chỉ là văn bản.
- Giao diện kiểm tra sơ bộ, còn `lib/ux61-9-blind-review.js` là lớp kiểm tra chặt; không được bỏ qua CLI cuối để tạo báo cáo.
- Định danh `REVIEWER_A` và `REVIEWER_B` không chứng minh danh tính thật hoặc sự độc lập của hai con người. Người điều phối cần xác nhận bằng quy trình riêng.
- **Không thể bật chấm điểm SRS bằng bất kỳ file phản hồi nào.** Tất cả 6 thẻ vẫn ở trạng thái chưa duyệt cho đến khi có bản đánh giá ngữ nghĩa và phê duyệt được xác thực, sau đó lập PR riêng có QA/rollback.
- Không tự động ghi CEFR, dữ liệu người dùng hoặc từ điển production.

**Phạm vi UX61.12:** thêm `public/editorial-reviewer.html` từ bản offline đã được kiểm thử và header bảo vệ trong `vercel.json`. Không sửa `api/`, `lib/game.js`, dữ liệu từ điển, CEFR hay SRS. Khác UX61.11, thay đổi này cần Preview QA và staged production smoke trước khi promote.
