# WordSky — English Flashcards & Falling Letters Game

Website học từ vựng tiếng Anh cơ bản bằng tiếng Việt, dùng được trên điện thoại và máy tính.

**Website:** https://wordsky-english-game.vercel.app

## Tính năng

- 26 chủ đề mẫu, 260 thẻ từ vựng (gồm nghĩa, phiên âm, ví dụ và bản dịch).
- Flashcard lật thẻ, đánh dấu từ đã thuộc, ôn tập theo chủ đề.
- Game chữ cái rơi: chọn chữ để hoàn thành từ, điểm số và các cấp độ tốc độ.
- Quản lý từ vựng: thêm, sửa, xóa thẻ và chủ đề.
- Xuất/nhập dữ liệu JSON để chia sẻ bộ thẻ với người khác.
- Khôi phục riêng chủ đề Daily Life và các chủ đề mẫu khác.

## Chạy trên máy

Mở `index.html` trong trình duyệt. Không cần cài Node.js, server hay database.

## Deploy trên Vercel

Import repository GitHub này vào Vercel, chọn framework **Other** (hoặc để nhận diện website tĩnh); không cần Build Command. Vercel phục vụ trực tiếp `index.html`.

Nếu bạn đã có dự án WordSky trên Vercel, hãy liên kết repository với **dự án đó**, không tạo dự án thứ hai.

## Dữ liệu và lưu ý

Từ vựng tự thêm, tiến độ học và điểm số đang lưu **trong `localStorage` của từng trình duyệt**. Chúng **không được đồng bộ** giữa hai máy hoặc tự động đưa lên GitHub. Để chia sẻ dữ liệu, dùng nút **Xuất JSON / Nhập JSON** trong mục quản lý.

GitHub Public có nghĩa là bất kỳ ai cũng có thể đọc mã nguồn và 260 thẻ mặc định. **Không** commit tệp `.env`, thông tin đăng nhập, token hoặc JSON xuất ra chứa dữ liệu bạn muốn giữ riêng tư.

## License

Chưa chọn giấy phép mã nguồn mở. Việc repository hiển thị công khai không tự động cấp phép sử dụng lại mã nguồn.
