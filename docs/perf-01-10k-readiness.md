# PERF-01 / PERF-02 — WordSky load baseline và kế hoạch 10.000 người dùng

**Status (2026-11-23):** Audit code + read-only database metrics + bộ kiểm thử tải an toàn. **CHƯA kiểm chứng sức chịu tải 10.000 người dùng đồng thời.** Không chạy 10k VU hoặc high-rate load trên Production.

## 1. Khảo sát kiến trúc hiện có

| Thành phần | Bằng chứng hiện tại | Hệ quả với 10k người |
| --- | --- | --- |
| Vercel Node Function | `api/index.js`, `vercel.json`; một serverless function cho các `/api/*`, vùng `icn1`, `maxDuration=30s` | Scale function không đồng nghĩa tự scale database |
| PostgreSQL | Supabase production `ap-northeast-2` (Seoul), Postgres 17.11, `max_connections=60`; tại thời điểm audit có 13 session, 1 active | Giới hạn 60 là server connection config, KHÔNG phải số request/giây được hỗ trợ |
| Pool Node | `lib/db.js`: `max=1` trên **mỗi instance** production/preview; connect timeout 8s; idle timeout 1s | 100+ instances vẫn có thể tạo nhiều kết nối; phải kiểm tra transaction pooler và giới hạn từ ngoài app |
| Catalog GET | `/api/learning/vocabulary`: tải toàn bộ danh mục 2.099 từ, `Cache-Control: no-store` từ API | Nhiều người tải lại đồng thời gây tăng query/load truyền dữ liệu |
| Topics GET | `/api/topics`: GROUP BY và count DISTINCT qua `ws_words` | Cần benchmark và cân nhắc cache/ETag sau khi có chính sách invalidation |
| SRS | `lib/srs-queue.js`: giao dịch repeatable-read, đọc toàn bộ shared/personal cards và lịch sử per-user (giới hạn 5.000 cards + 50.000 history mỗi nguồn), sau đó tính JS | Có nguy cơ tốn CPU/DB cao khi dữ liệu người học tăng |
| Multiplayer | `GET /api/rooms/:code` gọi `eventInfo()`, `membership()`, `standings()` | Polling 1 lần/giây * 500 người = **500 lần gọi endpoint/giây** cho một phòng, chưa kể số SQL truy vấn |
| Room limit | `adminInputEvent` đặt `max_players` 2–500 cho mỗi cuộc thi | 10k cùng thi cần từ 20 phòng trở lên, và rất khác 10k người đang mở website |

Supabase Performance Advisor: 8 cảnh báo foreign keys thiếu covering index (INFO); cần đối chiếu query plan trước khi thêm index. Chưa đổi schema, pooler, RLS hoặc dữ liệu production. Không ghi dữ liệu người dùng trong audit.

## 2. Phân biệt 10k người và 10k RPS

- 10.000 người mỗi 30 giây gửi 1 yêu cầu: ~333 RPS trung bình.
- 10.000 người mỗi 5 giây gửi 1 yêu cầu: ~2.000 RPS.
- 10.000 người mở một HTML đã cache có thể ít API hơn nhiều, trong khi multiplayer polling có thể cao hơn.

**Hãy thống nhất workload trước khi kết luận đạt 10k:**
- 50% mở trang học và danh sách từ; 25% đọc topic/search; 15% luyện SRS; 10% multiplayer (đây chỉ là *giả định để thiết kế thử nghiệm*, không phải dữ liệu analytics).
- Kiểm tra độc lập traffic static (CDN), GET public (DB), GET authenticated (DB per-user), POST review/idempotency (isolated fixtures only), lobby/room polling.
- Đặt yêu cầu đo: p95/p99, RPS, error rate, 429/500/503/504, concurrent function invocations, CPU/connection pressure, locks, DB query latency, egress và chi phí. Mức thử nghiệm ban đầu: lỗi <1%, p95 <1s, p99 <2.5s; **đây là budget đề xuất, không phải SLA hiện tại**.

## 3. Chạy PERF-01 bằng k6 — chỉ trên LOCAL DB CÔ LẬP

1. Cài k6: macOS `brew install k6` (hoặc dùng gói chính thức của Grafana k6). Cài Node 24 và Postgres 17 local qua Docker hoặc công cụ bạn quen dùng.
2. Thiết lập một database test local **riêng**, áp dụng schema/migration + fixtures từ dự án WordSky. Không import dữ liệu thật hoặc credentials production. Sao chép cấu hình cần thiết sang `.env.perf-local`, trong đó `DATABASE_URL` phải có host `localhost`, `127.0.0.1` hoặc `[::1]`. Không sử dụng `npm run dev` mặc định nếu `.env` có nguy cơ kết nối production.
3. Trong `.env.perf-local`, đặt `PERF_LOCAL_DB_ACK=I_VERIFIED_ISOLATED_LOCAL_POSTGRES`, `PERF_PROFILE=smoke`, `PERF_TARGET=http://127.0.0.1:3000`. Không commit hoặc gửi file này.
4. Terminal A — kiểm tra cổng an toàn và khởi động WordSky dùng **đúng** cấu hình test:

```sh
node --env-file=.env.perf-local scripts/perf-01/preflight.mjs
node --env-file=.env.perf-local scripts/local-server.js
```

5. Terminal B — chạy smoke 1 VU; chỉ 3 GET công khai `/`, `/api/topics`, `/api/learning/vocabulary`. **Không** gửi POST, tạo user, ghi SRS hay tham gia game:

```sh
mkdir -p .perf-results
k6 run -e PERF_PROFILE=smoke \
  -e PERF_LOCAL_DB_ACK=I_VERIFIED_ISOLATED_LOCAL_POSTGRES \
  --summary-export=.perf-results/smoke.json scripts/perf-01/k6-readonly.js
node scripts/perf-01/report.mjs .perf-results/smoke.json
```

6. Nếu smoke PASS, lặp lại với `PERF_PROFILE=baseline` (tối đa 10 VU, cap 10 RPS), rồi `step50` (tối đa 50 VU, cap 25 RPS). Phải có quan sát database và dừng nếu lỗi tăng, pg connections cao, hoặc p95 vượt ngưỡng:

```sh
k6 run -e PERF_PROFILE=baseline \
  -e PERF_LOCAL_DB_ACK=I_VERIFIED_ISOLATED_LOCAL_POSTGRES \
  --summary-export=.perf-results/baseline.json scripts/perf-01/k6-readonly.js
node scripts/perf-01/report.mjs .perf-results/baseline.json
```

`step50` chỉ được chạy sau khi xác nhận dữ liệu local và môi trường đủ tài nguyên. k6 chỉ kiểm soát **tải sinh ra trong lần chạy này**; cap RPS không bao gồm traffic của người khác/runner khác. Luôn theo dõi tài nguyên thật.

**Bảo vệ bắt buộc:** Script từ chối mọi URL remote, preview, production và không thể cấu hình 10.000 VUs. Preflight cũng từ chối Supabase và mọi database host không phải loopback. Không sử dụng credential hoặc URL private của production.

## 4. Đọc kết quả

- `http_reqs`: tổng request và requests/giây đã phát sinh — không phải lượng user thật.
- `http_req_duration p(95)`: 95% request có latency không vượt mức này.
- `http_req_duration p(99)`: tail latency, giúp phát hiện các request chậm gây tắc pool.
- `http_req_failed`: tỷ lệ request lỗi; cần kiểm tra riêng 429 (giới hạn), 500/503 (dịch vụ/DB), 504 (timeout).
- `checks`: tỷ lệ trả HTTP 200 như mong đợi.
- `node scripts/perf-01/report.mjs <file.json>` hiển thị PASS/FAIL theo budget. PASS tại 10 VUs **không** chứng minh 10.000 VUs được hỗ trợ.

Dừng/rollback ở môi trường test nếu lỗi >=1%, p95 vượt 1s, có HTTP 503/504 lặp lại, connection pool cạn, hoặc DB CPU tăng mất kiểm soát. Không chỉ nhìn thời gian trung bình.

## 5. PERF-03 đến PERF-05 — kế hoạch để đạt 10k

1. **PERF-03: cô lập staging:** Dùng một deployment và Supabase project test **tách biệt**; xác nhận Vercel Preview DB fail-closed đang dùng đúng test ref. Không sử dụng production stage URL có kết nối DB production. Bổ sung tài nguyên/chi phí riêng. Chỉ sau khi kiểm chứng cô lập mới cho phép remote load trong PR kế tiếp.
2. **PERF-04: load staircase:** Tăng 100 → 500 → 1.000 → 3.000 → 5.000 → 10.000 virtual users, mỗi bậc ramp-up, ổn định 2–5 phút và ramp-down. Mỗi bước phải pass budget + giám sát DB/functions mới lên bước tiếp theo. Có thể cần distributed k6 generators cho 10k VU.
3. **PERF-04: sửa nghẽn:** Kiểm tra transaction pooler cho serverless, đặt rate limiting theo endpoint/actor/IP một cách công bằng, giới hạn bất thường, cache danh mục/topic có invalidation, giảm SRS full-history scan (precomputed state/index/rebuild có semantics), tách polling room khỏi query scoreboard nặng, xem xét pub/sub hoặc realtime thích hợp. Không thêm cache/SRS changes trước khi có correctness tests.
4. **PERF-05: acceptance:** Báo cáo theo user scenarios và peak/steady-state, p95/p99, DB connections, throughput, lỗi, bill estimate, rollback playbook và QA authenticated/cross-device. Chỉ tuyên bố đạt 10k khi có test thật tại môi trường cấu hình tương đương production.

## Tài liệu tham khảo

- https://grafana.com/docs/k6/latest/get-started/running-k6/
- https://grafana.com/docs/k6/latest/using-k6/thresholds/
- https://vercel.com/docs/functions
- https://supabase.com/docs/guides/database/connecting-to-postgres

**Giới hạn release:** PERF-01 bổ sung *chỉ* scripts/tests/docs và gitignore. Không triển khai schema, không đổi Vercel runtime, không load-test public production.
