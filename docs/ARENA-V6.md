# WordSky Arena V6 — CEFR lane challenge & Bomb mobile

## Trạng thái và nguyên tắc an toàn

- **Đây là patch gia tăng cho V5 chưa commit**, không phải bản thay thế toàn bộ source V4/V5.
- **KHÔNG triển khai Production** khi chưa duyệt từ và test Preview đa thiết bị.
- `vocab/cefr-provisional.csv/json` chứa **90 từ do AI biên soạn, trình độ CEFR CHỈ LÀ ƯỚC LƯỢNG**. IPA và cách dùng cũng cần người rà soát. Chưa có từ được phê duyệt (`review_status=PROVISIONAL`).
- API chỉ sử dụng từ có `cefr_review_status='APPROVED'`, và chặn mở phòng Car nếu không đủ từ theo từng nhóm.
- Preview cần dùng **database riêng**, không dùng chung Supabase Production.
- Không sửa `.gitignore`, không gọi `git add`, `git commit`, `git push`, không ghi DB trong script áp dụng V6.

## Luật Lane Escape V6

Mỗi chặng tạo **5 làn**, mỗi làn an toàn có **một từ tiếng Anh KHÁC NHAU**:

| Làn | Từ cần giải | Điểm mặc định (nếu điểm đúng = 100) |
| --- | --- | --- |
| `🧱` vật cản | Không có từ; lao vào mất 1 tim, trừ 25 điểm | -25 |
| `·` làn thường | A2, dịch đúng từ mới được qua | +100 |
| `⭐` thưởng | B1–B2, dịch đúng từ mới được qua | +150 |
| `×2` nhân đôi | C1–C2, dịch đúng từ mới được qua | +200 |

**EASY**: 1 vật cản + 2 làn A2 + ⭐ + ×2.
**NORMAL/HARD**: 2 vật cản + 1 làn A2 + ⭐ + ×2 (HARD đổi từ 3 vật cản về 2 để luôn giữ một làn A2). Khác biệt NORMAL/HARD còn ở thời gian và số lượt Admin cấu hình.

Mỗi chặng dùng câu hỏi riêng trên mỗi làn, không chia sẻ đáp án. Với làn an toàn, sai từ bị trừ điểm nhưng chưa vượt chặng; đúng từ mới qua. Làn vật cản không cần từ, nhưng mất 1 tim. Backend quyết định kết quả; đáp án tiếng Anh không được gửi trong payload `publicState`.

Mỗi câu hỏi cần một mục từ **duy nhất trong vòng**. Nhu cầu cho `N` chặng:

- Easy: `2N` từ A2, `N` B1–B2, `N` C1–C2.
- Normal/Hard: `N` từ A2, `N` B1–B2, `N` C1–C2.

Với 90 từ bản nháp (30 A2, 30 B1/B2, 30 C1/C2), sau khi **toàn bộ được duyệt và import**, tối đa 15 chặng Easy hoặc 30 chặng Normal/Hard khi dùng chủ đề `WordSky CEFR - Reviewed` (giới hạn nghiệp vụ 30). Lúc chưa duyệt, các mức này **không có sẵn**.

## Bomb Defuser V6

V5 đã có bom rơi và bàn phím. V6 tăng độ rõ: mỗi bom là thẻ rơi độc lập, **hiển thị toàn bộ nghĩa tiếng Việt**, tự xuống dòng, không tràn qua bên phải, chiều ngang cố định theo 3 cột. Người chơi chọn bom, nhập **nguyên từ tiếng Anh** rồi Enter. Chấm điểm và số tim như luật V5; không thay đổi database hay cách chấm Bomb.

## Review bộ từ (chưa ghi database)

1. Mở `vocab/cefr-provisional.csv` bằng Excel/Google Sheets để đối chiếu CEFR, IPA, nghĩa và ví dụ.
2. File JSON tương ứng là `vocab/cefr-provisional.json`. Từ nào đạt yêu cầu, **trong bản sao riêng** đổi `review_status` từ `PROVISIONAL` thành `APPROVED`. Từ chưa duyệt giữ PROVISIONAL. Chú ý không coi nhãn AI là chứng nhận CEFR.
3. Xem số lượng đã duyệt bằng lệnh (không chạm DB):

```bash
node scripts/import-cefr-approved.js --file=/path/to/reviewed-cefr.json
```

## DB Preview riêng (sau khi bạn duyệt dữ liệu)

**Không thực hiện các lệnh này với `DATABASE_URL` Production.** Tạo một Supabase project/DB Preview riêng, xác nhận host và project ID trước khi chạy. Migration có tính cộng thêm, không cập nhật hay xóa từ cũ.

Do môi trường build không có Supabase CLI, `db/migrations/20261021_150000_wordsky_cefr_review.sql` là file SQL sẵn để review. Trên máy Mac nếu dùng Supabase CLI, chạy `supabase migration new wordsky_cefr_review`, rồi **copy nội dung SQL vào file do CLI tạo** để giữ lịch sử đúng chuẩn. Hoặc chỉ trong DB Preview riêng có thể kiểm tra và chạy SQL thủ công với `psql`:

```bash
# Đây phải là URL của DB Preview RIÊNG, không dán URL/password vào chat
psql "$WORDSKY_PREVIEW_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f db/migrations/20261021_150000_wordsky_cefr_review.sql
```

Bộ nhập dành cho Preview có chế độ DRY RUN mặc định, và chỉ thêm từ đã duyệt vào **chủ đề mới** `WordSky CEFR - Reviewed` (không đổi các từ cũ):

```bash
# Kiểm tra, KHÔNG GHI:
node scripts/import-cefr-approved.js --file=/path/to/reviewed-cefr.json

# Chỉ sau khi xác nhận URL DB Preview RIÊNG, có >=1 APPROVED:
WORDSKY_TARGET_ENV=preview node scripts/import-cefr-approved.js \
  --file=/path/to/reviewed-cefr.json --write-preview
```

Trước lệnh thứ hai, đặt `WORDSKY_PREVIEW_DATABASE_URL` qua shell hoặc `.env` riêng **không commit**. Script từ chối ghi nếu biến này trống hoặc trùng `DATABASE_URL` đang đặt, và từ chối file không có mục APPROVED. **Bạn vẫn phải tự kiểm tra URL đó thực sự không phải Production**; kiểm tra bằng tên biến không thay thế được kiểm tra DB vật lý.

Sau import, test `GET /api/topics` trên Preview, kiểm tra từ đã duyệt rồi tạo phòng riêng; chọn chủ đề `WordSky CEFR - Reviewed`. Match/Bomb tiếp tục dùng chủ đề cũ bình thường. **Không thử thao tác dữ liệu Preview trên DB Production.**

## Test và phát hành

```bash
npm run check
npm test
python3 scripts/qa_v6_ui.py  # tùy chọn: cần playwright + chromium local
```

Không coi unit/mock test là DB integration hoặc real Messenger UAT. Sau khi có Preview DB đã migrate + import từ được duyệt, tạo phòng test trên Preview và kiểm tra Admin + 2 người chơi trên thiết bị thật, tốc độ chuyển trạng thái, câu hỏi trên từng lane, kết quả và Bomb rơi. Chỉ merge vào `main` nếu tất cả đều PASS.
