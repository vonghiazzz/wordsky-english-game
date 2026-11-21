# UX61.8 — Quy trình kiểm duyệt nghĩa và đáp án (chưa kích hoạt SRS)

**Trạng thái hiện tại: PENDING_HUMAN_REVIEW.** Đây là một quy trình xác minh *nguồn và trạng thái*, không phải sự phê duyệt nội dung của bất kỳ ai.

## Tệp nguồn có thể đối chiếu

- `docs/ux61-8-editorial-evidence.json`: 6 thẻ, UUID production, chủ đề, nghĩa gốc, ví dụ tiếng Anh/Việt, từ loại, link Cambridge và ghi chú ngữ cảnh. Mọi trường quyết định vẫn chờ người duyệt.
- `lib/ux61-8-editorial-preflight.js`: kiểm tra schema nghiêm ngặt, ảnh chụp nghĩa/ví dụ theo UUID, đúng 3 nhóm gợi ý trùng nhau, các thẻ vẫn bị giữ khỏi chấm SRS, trạng thái không thể tự duyệt.
- `scripts/ux61-8-review-production.mjs --live`: GET công khai trên production, không cần đăng nhập, không ghi DB/SRS. CI sẽ FAIL nếu các bản ghi mục tiêu thay đổi không tương thích.
- `public/ux61-editorial-sources.js`: chỉ lưu URL tham khảo Cambridge cố định cho 6 thẻ. Đây là liên kết đọc thêm, **không** phải kết luận ngữ nghĩa hoặc quyền thay đổi câu hỏi.

## Các bước kiểm duyệt độc lập

1. Người biên tập kiểm tra lại 6 bản ghi WordSky, câu ví dụ, từ loại và nghĩa ở nguồn từ điển có uy tín. Với `five/year`, xác minh rõ “số đếm” và “đơn vị thời gian”. Với `assess/evaluate` và `significant/substantial`, ghi nhận vùng đồng nghĩa và quyết định liệu một câu hỏi tiếng Việt có thể có **nhiều đáp án đúng** hay không.
2. Soạn phiên bản **câu gợi ý theo ngữ cảnh mới** và danh sách đáp án có thể chấp nhận cho từng từ. Câu gợi ý không được chứa nguyên đáp án tiếng Anh và phải kiểm tra xem từ trong cùng nhóm có thể trả lời hợp lệ hay không. Không được gán nghĩa riêng biệt giả tạo chỉ để “đúng 1 đáp án”.
3. Hai người kiểm duyệt độc lập có năng lực tiếng Anh/tiếng Việt đánh giá cùng phiên bản mà không nhìn kết quả nhau. Tên đăng nhập WordSky thứ hai không phải bằng chứng hai con người khác nhau.
4. Chỉ sau khi có xác minh danh tính người duyệt, dấu thời gian, phiên bản câu hỏi, bằng chứng ngữ nghĩa và phê duyệt đủ điều kiện mới lập *gói triển khai riêng*. Dùng các hợp đồng `UX43E2` để thẩm định biên nhận đã ký; các công cụ hiện tại là preflight offline và **không có API phê duyệt/kích hoạt**.
5. Kiểm tra bản ghi production lần nữa và sao lưu, thiết kế rollback giữ nguyên UUID/SRS. Chạy E2E được cô lập, Preview có xác thực, staged production rồi mới xem xét cho phép chấm điểm.
6. Nếu thiếu bất kỳ bằng chứng nào, giữ nguyên **6 thẻ đang chờ kiểm duyệt**, tiếp tục cho xem ví dụ và link từ điển mà không tạo lượt review.

## Những điều không thực hiện trong UX61.8

- Không sửa bản dịch, CEFR, từ cá nhân hoặc bảng từ production.
- Không tạo hay xóa tài khoản, không ghi PostgreSQL production.
- Không kích hoạt `approved`, `active` hoặc `authorized_to_grade_srs`.
- Không dùng Cambridge, LLM hay một JSON tự khai làm người kiểm duyệt độc lập.
- Không mở chấm điểm với `assess/evaluate` hoặc `significant/substantial` chỉ bằng ví dụ gốc đang trùng ngữ cảnh.

**Lệnh kiểm tra có thể chạy tại repo:** `node --test tests/ux61-editorial-evidence.test.js` và `node scripts/ux61-8-review-production.mjs --live`.

**Tiếp theo:** tạo quy trình nhận xét thực sự từ hai người kiểm duyệt có xác minh và phiên bản câu hỏi rõ ràng. Chỉ mở khóa SRS trong một PR mới sau khi đáp ứng các cổng phê duyệt đó.
