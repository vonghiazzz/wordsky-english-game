# UX61.10 — Biên bản đối chiếu đánh giá A/B (chưa phê duyệt)

**Trạng thái:** Chưa nhận được kết quả đánh giá độc lập từ người thật. Cả 6 thẻ vẫn bị tạm giữ khỏi chấm điểm SRS và vẫn có thể xem ví dụ ở My Learning.

UX61.9 cung cấp 2 phiếu trống: [REVIEWER_A](./ux61-9-review-templates/ux61-9-REVIEWER_A.json), [REVIEWER_B](./ux61-9-review-templates/ux61-9-REVIEWER_B.json). UX61.10 chỉ thêm báo cáo đối chiếu dễ đọc **sau khi** người kiểm duyệt trả lời. Phiếu tự khai và việc khớp kết quả không chứng minh danh tính hay tính độc lập.

## Tạo báo cáo từ 2 phiếu nhận về

Lưu riêng các tệp trả lời ở máy an toàn, không commit phản hồi có dữ liệu cá nhân lên repo. Với Node.js 24 tại thư mục gốc:

```sh
node scripts/ux61-10-adjudication.mjs \
  ./review-local/ux61-9-REVIEWER_A.json \
  ./review-local/ux61-9-REVIEWER_B.json \
  --output ./review-local/ux61-10-report.md
```

Lệnh sẽ xác minh **GET-only** kho từ public production trước, từ chối nếu 6 thẻ nguồn hoặc trạng thái đang giữ chấm điểm thay đổi không phù hợp. Sau đó đối chiếu hai phiếu theo UUID, phiên bản ảnh chụp, quyết định, câu hỏi tiếng Việt, đáp án được chấp nhận, và xung đột giữa các cặp nghĩa dễ nhầm. Báo cáo tiếng Việt phân loại:

- Thiếu A/B, hai người cùng yêu cầu chỉnh sửa;
- Hai phiếu có quyết định, câu hỏi hoặc danh sách đáp án khác nhau;
- Hai câu hỏi trùng ngữ cảnh hoặc đáp án đồng nghĩa chồng lấn;
- Hai bản nháp giống nhau **nhưng chưa xác minh phê duyệt**.

Tệp đầu ra được tạo mới với quyền truy cập giới hạn, không ghi đè báo cáo cũ hoặc tệp đầu vào. Muốn in ra terminal mà không tạo tệp, bỏ tùy chọn `--output`.

## Giới hạn của quy trình

Đây là **báo cáo tiền kiểm duyệt**, không phải một hệ thống quản lý danh tính/chữ ký số. Ngay cả khi hai phiếu cùng đề xuất giống nhau, kết quả vẫn có:

- `human_identities_verified: false`
- `semantic_approval_verified: false`
- `signed_receipts_verified: false`
- `authorized_to_grade_srs: false`
- `ready_for_released_scored_recall: false`

Hai người đánh giá có thẩm quyền phải được xác minh qua quy trình đáng tin cậy bên ngoài, sau đó có người phân xử chênh lệch ngữ nghĩa và ghi nhận bằng chứng phê duyệt. Các từ `assess/evaluate` và `significant/substantial` có nghĩa chồng lấn, không được ép lựa chọn 1 đáp án độc quyền khi ngữ cảnh chưa đủ phân biệt.

**Không thay đổi** bảng từ, CEFR, trạng thái SRS, lịch học người dùng hoặc API production ở UX61.10. Việc phát hành đáp án mới sẽ yêu cầu một PR riêng, kiểm thử idempotency SRS và nghiệm thu Preview trước khi deploy.
