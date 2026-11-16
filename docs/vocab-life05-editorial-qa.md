# LIFE-05 — Everyday shopping, payments and refunds: 100 editorial candidates

**State: DRAFT. All 100 entries are PROVISIONAL.** A passed CI confirms schema and exact-collision checks, not the correctness of IPA, a CEFR sense, translations, or an authorized content release.

## Dependencies and scope

LIFE-05 follows the separate LIFE-04 content PR (#91), which remains unmerged at authoring. This is a **stacked branch** based on #91 and targets main only to run the normal GitHub CI; **merge #91 before merging LIFE-05**. Until then its PR-to-main diff will also include LIFE-04. Production import and deployment remain separate user-controlled actions.

| Group | Count | Sample English vocabulary and phrases |
|---|---:|---|
| Hỏi hàng, thử và so sánh sản phẩm | 25 | I'm just browsing, Do you have this in blue, I'm looking for a jacket, Where is the changing room, Can I try this on |
| Giá, ưu đãi và ngân sách | 25 | price tag, original price, sale price, bargain, special offer |
| Phương thức và xác nhận thanh toán | 25 | cash payment, card payment, contactless payment, bank transfer, mobile wallet |
| Đổi trả hàng và khiếu nại | 25 | return an item, request a refund, exchange for another size, faulty product, damaged packaging |

Destination topics: `Shopping - Mua sắm` (25, existing), `Money & Payments - Thanh toán` (75, **new proposed only**). The latter requires a distinct later disabled/isolated Preview topic registration and explicit approval; this JSON file does NOT create, enable or provision a database topic.

All 100 records have UK-oriented **draft** IPA, specific Vietnamese cue, original usage example and translation, grammatical function, proposed CEFR, reference URL and explanation. Multword phrases intentionally have no automatically accepted synonyms or reviewer identity.

## Evidence-checking methodology (2026-11-16)

Do not conflate a lesson's A1/A2/B2 level with an individual word's certified CEFR grade.

- **1 direct Cambridge same-sense label:** [Cambridge bargain — noun, LOW PRICE, B1](https://dictionary.cambridge.org/dictionary/english/bargain). The label is on the purchase/cheap-price sense, **not every verb sense**.
- **1 collocation in a labeled Cambridge sense:** [Cambridge offer — noun, PRICE REDUCTION, B1](https://dictionary.cambridge.org/dictionary/english/offer) includes `special offer`. The level is supported by the noun sense; it is **not an independently certified phrase-level CEFR entry**.
- **98 contextual estimates:** British Council [A1 shopping for clothes](https://learnenglish.britishcouncil.org/free-resources/listening/a1/shopping-clothes), [A2 shopping vocabulary](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/shopping), [B2 letter of complaint](https://learnenglish.britishcouncil.org/free-resources/writing/b2/letter-complaint). These authenticate teaching **functions and genres** only. An A1 lesson describing credit cards **does not make every payment phrase A1**, and a B2 complaint-writing lesson **does not make all return phrases B2**. For these 98 entries, `cefr_source_label=null`, `cefr_evidence_kind=contextual_inference` and independent item review is explicitly required.

| Proposed A1 | A2 | B1 | B2 | Total |
|---:|---:|---:|---:|---:|
| 4 | 37 | 49 | 10 | 100 |

Some B2 financial expressions are useful for adults but should be checked for necessity and context. CEFR distribution is descriptive, not a target that can justify fabricated labels.

## Duplicate and usability audits

- Checked against the public GitHub baseline of **280 seed words**, **117 pre-existing provisional words**, LIFE-01 through LIFE-04 (**400 proposals**) and within this file. No normalized exact English entry duplicates and no identical normalized Vietnamese cue strings were found.
- This **does not compare against the Production PostgreSQL catalog** (which is separately managed), account-owned vocabulary or all semantic paraphrases. Reconcile before any future import.
- Retail questions and help requests have contractions, punctuation, UK/US variants and alternative answers. `I'm just browsing`, `Can I try this on`, `I will think about it` and the refund/complaint phrases **must not become strict single-answer SRS prompts** unless reviewers approve context-sensitive alternatives.
- Verify original examples (idiomatic usage and natural Vietnamese), connected-speech IPA, and spelling conventions: `instalments` is UK spelling, `installments` is US; `colours` vs `colors`; `receipt` pronunciation; payment jargon may differ across countries.
- New topic name `Money & Payments - Thanh toán` should be reviewed against existing Shopping and Restaurant topics, with inactive-Preview DB registration following separate manual approval and rollback plan.

## Non-release guarantees

- All rows remain `review_status=PROVISIONAL` and batch `status=DRAFT`. Neither reference links nor CI can mark a candidate APPROVED. A trusted bilingual reviewer and evidence record are mandatory.
- No mutation of game words, Admin/API, login, passwords, SRS, grading, topic seed, DB schema, target database, Vercel Preview/Production or other users' content.
- `npm run vocab:plan` automatically audits five saved batches, quotas, source-grade consistency and exact collisions; new tests enforce LIFE-05's 25×4 distribution, approved-vs-contextual distinction, no forged reviewer identity and immutable imported data separation.
- After content approval: isolated Preview QA of an idempotent importer that preserves existing WordSky UUID/SRS references, explicit topic publication decision, backup and tested rollback before a separately authorized Production release.

## Full 100-item bilingual review inventory

| # | Group | Expression | Proposed CEFR | Evidence | Vietnamese teaching cue |
|---:|---|---|---|---|---|
| 1 | shopping | I'm just browsing | A2 | Contextual inference | Tôi chỉ đang xem hàng chứ chưa định mua |
| 2 | shopping | Do you have this in blue | A1 | Contextual inference | Cửa hàng có món này màu xanh dương không |
| 3 | shopping | I'm looking for a jacket | A1 | Contextual inference | Tôi đang tìm mua một chiếc áo khoác |
| 4 | shopping | Where is the changing room | A1 | Contextual inference | Phòng thử quần áo nằm ở chỗ nào |
| 5 | shopping | Can I try this on | A2 | Contextual inference | Tôi thử mặc món này được không |
| 6 | shopping | Do you have a larger size | A2 | Contextual inference | Cửa hàng có kích cỡ lớn hơn không |
| 7 | shopping | Do you have a smaller size | A2 | Contextual inference | Cửa hàng có kích cỡ nhỏ hơn không |
| 8 | shopping | It fits me well | A2 | Contextual inference | Món đồ này vừa vặn với cơ thể tôi |
| 9 | shopping | It is too tight | A2 | Contextual inference | Món đồ này bó quá chật |
| 10 | shopping | It is too loose | A2 | Contextual inference | Món đồ này rộng và lỏng quá mức |
| 11 | shopping | What material is it made of | B1 | Contextual inference | Món đồ này được làm từ chất liệu gì |
| 12 | shopping | Is it machine washable | B1 | Contextual inference | Món này có thể giặt bằng máy không |
| 13 | shopping | Does this come in other colours | A2 | Contextual inference | Mẫu này có những màu khác không |
| 14 | shopping | Is this item in stock | B1 | Contextual inference | Cửa hàng hiện còn sẵn món hàng này không |
| 15 | shopping | When will it be back in stock | B1 | Contextual inference | Bao giờ mặt hàng này sẽ có lại |
| 16 | shopping | May I compare these two models | B1 | Contextual inference | Tôi có thể so sánh hai mẫu này không |
| 17 | shopping | Which one lasts longer | A2 | Contextual inference | Mẫu nào có độ bền lâu hơn |
| 18 | shopping | I prefer the lighter one | A2 | Contextual inference | Tôi thích mẫu nhẹ hơn trong hai mẫu |
| 19 | shopping | Can you show me another option | A2 | Contextual inference | Bạn có thể giới thiệu lựa chọn khác cho tôi không |
| 20 | shopping | Does this have a warranty | B1 | Contextual inference | Món hàng này có chế độ bảo hành không |
| 21 | shopping | Is there a size chart | A2 | Contextual inference | Cửa hàng có bảng hướng dẫn kích cỡ không |
| 22 | shopping | I'm shopping for a gift | A2 | Contextual inference | Tôi đang đi chọn mua quà tặng |
| 23 | shopping | Could you wrap it as a gift | B1 | Contextual inference | Bạn gói món này thành quà giúp tôi được không |
| 24 | shopping | Where can I find the shoes | A1 | Contextual inference | Tôi có thể tìm khu bán giày ở đâu |
| 25 | shopping | I will think about it | A2 | Contextual inference | Tôi sẽ cân nhắc thêm trước khi mua |
| 26 | prices | price tag | A2 | Contextual inference | Nhãn ghi giá gắn trên món hàng |
| 27 | prices | original price | A2 | Contextual inference | Mức giá ban đầu trước khi giảm |
| 28 | prices | sale price | A2 | Contextual inference | Giá bán đã được giảm trong đợt khuyến mãi |
| 29 | prices | bargain | B1 | Cambridge matching sense | Món mua được với giá hời so với giá trị |
| 30 | prices | special offer | B1 | Collocation in labeled Cambridge sense | Chương trình giảm giá đặc biệt trong thời gian ngắn |
| 31 | prices | discount code | A2 | Contextual inference | Mã nhập để được giảm giá khi mua |
| 32 | prices | student discount | A2 | Contextual inference | Khoản ưu đãi giá dành riêng cho học sinh sinh viên |
| 33 | prices | loyalty points | B1 | Contextual inference | Điểm tích lũy dành cho khách hàng thân thiết |
| 34 | prices | membership price | B1 | Contextual inference | Mức giá riêng dành cho thành viên đăng ký |
| 35 | prices | limited-time offer | B1 | Contextual inference | Ưu đãi chỉ kéo dài trong thời gian ngắn |
| 36 | prices | half price | A2 | Contextual inference | Bằng một nửa mức giá bán thông thường |
| 37 | prices | buy one get one free | A2 | Contextual inference | Mua một sản phẩm được tặng thêm một sản phẩm |
| 38 | prices | compare prices | A2 | Contextual inference | Đối chiếu giá giữa những nơi bán khác nhau |
| 39 | prices | stay within budget | B1 | Contextual inference | Chi tiêu không vượt quá ngân sách đã định |
| 40 | prices | set a spending limit | B1 | Contextual inference | Đặt giới hạn số tiền được phép chi tiêu |
| 41 | prices | save up for something | B1 | Contextual inference | Dành dụm tiền dần để mua thứ gì |
| 42 | prices | worth the money | B1 | Contextual inference | Đáng với số tiền phải bỏ ra |
| 43 | prices | good value for money | B1 | Contextual inference | Có chất lượng tương xứng hoặc vượt trội so với giá |
| 44 | prices | overpriced | B2 | Contextual inference | Bị định giá quá cao so với giá trị |
| 45 | prices | affordable | B1 | Contextual inference | Có mức giá phù hợp khả năng chi trả |
| 46 | prices | price increase | B1 | Contextual inference | Sự tăng lên của giá bán |
| 47 | prices | price reduction | B1 | Contextual inference | Sự hạ giá bán xuống thấp hơn |
| 48 | prices | extra charge | B1 | Contextual inference | Khoản phí phải trả thêm ngoài giá cơ bản |
| 49 | prices | delivery fee | A2 | Contextual inference | Phí giao hàng đến địa chỉ người mua |
| 50 | prices | total cost | A2 | Contextual inference | Tổng số tiền phải chi trả cho đơn hàng |
| 51 | payments | cash payment | A2 | Contextual inference | Việc thanh toán bằng tiền mặt |
| 52 | payments | card payment | A2 | Contextual inference | Việc thanh toán bằng thẻ ngân hàng |
| 53 | payments | contactless payment | B1 | Contextual inference | Thanh toán không tiếp xúc qua thẻ hoặc thiết bị |
| 54 | payments | bank transfer | B1 | Contextual inference | Giao dịch chuyển tiền giữa các tài khoản ngân hàng |
| 55 | payments | mobile wallet | B1 | Contextual inference | Ví điện tử dùng trên điện thoại |
| 56 | payments | payment terminal | B1 | Contextual inference | Máy nhận thanh toán bằng thẻ tại quầy |
| 57 | payments | checkout counter | A2 | Contextual inference | Quầy nơi khách tính tiền mua hàng |
| 58 | payments | self-checkout | B1 | Contextual inference | Máy hoặc quầy để khách tự quét hàng và tính tiền |
| 59 | payments | cashier | A2 | Contextual inference | Nhân viên phụ trách thu tiền ở quầy |
| 60 | payments | payment method | A2 | Contextual inference | Hình thức trả tiền mà người mua lựa chọn |
| 61 | payments | pay in instalments | B2 | Contextual inference | Trả góp bằng nhiều kỳ thay vì một lần |
| 62 | payments | pay upfront | B2 | Contextual inference | Trả toàn bộ tiền ngay từ đầu |
| 63 | payments | confirm the payment | B1 | Contextual inference | Xác nhận khoản thanh toán đã thực hiện |
| 64 | payments | enter your PIN | A2 | Contextual inference | Nhập mã PIN để xác thực giao dịch |
| 65 | payments | tap your card | A2 | Contextual inference | Chạm thẻ lên máy để trả tiền |
| 66 | payments | insert your card | A2 | Contextual inference | Đưa thẻ vào khe máy thanh toán |
| 67 | payments | scan the QR code | A2 | Contextual inference | Quét mã QR để thực hiện thanh toán |
| 68 | payments | payment declined | B1 | Contextual inference | Giao dịch thanh toán đã bị từ chối |
| 69 | payments | payment successful | A2 | Contextual inference | Giao dịch thanh toán đã hoàn tất thành công |
| 70 | payments | transaction fee | B2 | Contextual inference | Phí phát sinh cho một giao dịch tài chính |
| 71 | payments | payment confirmation | B1 | Contextual inference | Thông báo xác nhận đã ghi nhận khoản tiền |
| 72 | payments | electronic receipt | B1 | Contextual inference | Biên lai mua hàng dạng điện tử |
| 73 | payments | proof of payment | B1 | Contextual inference | Chứng từ chứng minh đã thanh toán |
| 74 | payments | billing address | B1 | Contextual inference | Địa chỉ được khai báo để lập hóa đơn thanh toán |
| 75 | payments | currency conversion | B2 | Contextual inference | Việc đổi giá trị tiền tệ sang loại tiền khác |
| 76 | returns | return an item | A2 | Contextual inference | Mang món hàng đã mua trở lại nơi bán |
| 77 | returns | request a refund | B1 | Contextual inference | Đề nghị được hoàn lại tiền đã trả |
| 78 | returns | exchange for another size | B1 | Contextual inference | Đổi món đồ lấy một cỡ khác |
| 79 | returns | faulty product | B1 | Contextual inference | Món hàng bị lỗi kỹ thuật hoặc chất lượng |
| 80 | returns | damaged packaging | B1 | Contextual inference | Bao bì đã bị rách hoặc móp hỏng |
| 81 | returns | wrong item delivered | B1 | Contextual inference | Người bán giao nhầm món hàng đã đặt |
| 82 | returns | missing parts | B1 | Contextual inference | Những bộ phận bị thiếu trong hộp sản phẩm |
| 83 | returns | return policy | B1 | Contextual inference | Quy định của cửa hàng về việc trả hàng |
| 84 | returns | refund policy | B1 | Contextual inference | Quy định của người bán về việc hoàn tiền |
| 85 | returns | return window | B1 | Contextual inference | Khoảng thời gian được phép gửi trả hàng |
| 86 | returns | warranty claim | B2 | Contextual inference | Yêu cầu sửa hoặc đổi hàng theo bảo hành |
| 87 | returns | proof of purchase | B1 | Contextual inference | Chứng từ cho thấy món hàng đã được mua |
| 88 | returns | original packaging | B1 | Contextual inference | Hộp và bao bì ban đầu đi kèm sản phẩm |
| 89 | returns | keep the receipt | A2 | Contextual inference | Giữ lại biên lai để làm bằng chứng mua hàng |
| 90 | returns | cancel an order | A2 | Contextual inference | Hủy đơn mua hàng trước khi hoàn tất |
| 91 | returns | track a return | B1 | Contextual inference | Theo dõi tiến trình xử lý món hàng gửi trả |
| 92 | returns | print a return label | B1 | Contextual inference | In nhãn vận chuyển dành cho hàng gửi trả |
| 93 | returns | drop off a parcel | B1 | Contextual inference | Mang bưu kiện đến điểm nhận để gửi đi |
| 94 | returns | contact customer service | B1 | Contextual inference | Liên hệ bộ phận hỗ trợ khách mua hàng |
| 95 | returns | speak to the manager | B1 | Contextual inference | Xin gặp người quản lý để trao đổi vấn đề |
| 96 | returns | file a complaint | B2 | Contextual inference | Gửi đơn khiếu nại chính thức |
| 97 | returns | report a defect | B2 | Contextual inference | Thông báo cho người bán về một lỗi sản phẩm |
| 98 | returns | get a replacement | B1 | Contextual inference | Nhận sản phẩm mới thay cho món bị lỗi |
| 99 | returns | refund to the original payment method | B2 | Contextual inference | Hoàn tiền về phương thức đã dùng để thanh toán |
| 100 | returns | store credit | B2 | Contextual inference | Khoản tiền hoàn ở dạng số dư chỉ dùng tại cửa hàng |
