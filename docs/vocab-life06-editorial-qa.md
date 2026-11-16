# LIFE-06 — Everyday transport, directions and travel (100 editorial candidates)

**State:** `DRAFT`. Every record remains `PROVISIONAL` and has no editorial sign-off, gameplay/SRS activation, or real database import. No production WordSky data is touched.

## Scope

This content branch is **stacked on PR #92** (LIFE-05) and transitively **PR #91** (LIFE-04), both unmerged when created. It uses `base=main` to run full CI; merge those dependencies before LIFE-06 and recheck the narrowed diff and tests. PR #94 is a separate Money & Payments inactive-topic gate and does **not** need to be merged before this editorial content PR.

| Group | Topic | Count |
|---|---|---:|
| Đi lại đi làm, đi học | Transport - Di chuyển | 25 |
| Hỏi và chỉ đường | Directions - Chỉ đường | 25 |
| Đặt vé và đặt phòng | Travel - Du lịch | 25 |
| Trục trặc và yêu cầu hỗ trợ | Travel - Du lịch | 25 |

Unlike LIFE-02, LIFE-03, LIFE-04 or LIFE-05, **all three destination topics in LIFE-06 already exist in the original 26-topic seed**. No new topic, inactive-topic registration or SQL migration is required for these 100 proposed expressions. Nonetheless **no** candidate may be published or used for strict recall before independent bilingual review.

## CEFR provenance — independent source vs instructional estimates

Four **direct Cambridge English CEFR matching-sense labels** were checked on **2026-11-16**:
- [commute](https://dictionary.cambridge.org/dictionary/english/commute): **C1**, verb describing a regular home-to-work journey. The unrelated legal/financial senses do not justify this label.
- [fare](https://dictionary.cambridge.org/dictionary/english/fare): **B1**, noun for the money paid on public transport; not the old-fashioned food sense.
- [platform](https://dictionary.cambridge.org/dictionary/english/platform): **A2**, railway station boarding structure. The generic raised structure is B2, so the intended railway sense must be kept explicit.
- [itinerary](https://dictionary.cambridge.org/dictionary/english/itinerary): **C1**, noun for a detailed travel plan.

The remaining **96 contextual estimates** carry `cefr_evidence_kind=contextual_inference` and `cefr_source_label=null`. Relevant teaching resources are:
- [British Council A1–A2 Transport 1](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/transport-1)
- [British Council A1 Finding the library](https://learnenglish.britishcouncil.org/free-resources/listening/a1/finding-library) — asking directions
- [British Council A2 Hotels](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/hotels)
- [British Council A2 Holidays](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/holidays)

**A teaching page's A1/A2 level does NOT verify CEFR for each WordSky phrase.** The latter 96 values are editorial teaching placements, not certified source labels. Four Cambridge matching-sense labels still do not approve WordSky IPA, translation, example authenticity or learner accepted answers.

### Proposed levels — do not force a quota

| A1 | A2 | B1 | B2 | C1 | Total |
|---:|---:|---:|---:|---:|---:|
| 10 | 46 | 35 | 7 | 2 | 100 |

The C1 words `commute` and `itinerary` are intentionally not downgraded to the original A1–B2 editorial target.

## Deduplication, ambiguity and release boundaries

- Preflight compares exact normalized English and Vietnamese prompt strings against 280 seed items, 117 legacy provisional CEFR drafts, LIFE-01 through LIFE-05 (500 candidates) and within LIFE-06: **zero exact collisions**.
- This **does not** cover Production PostgreSQL, account-owned vocabulary, semantic paraphrases, or synonym equivalence. The original seed and several existing drafts can overlap semantically, so separate source-of-truth reconciliation is required before any import.
- The phrase list contains contractions, punctuation, transport-specific synonyms and regional distinctions. `one-way ticket` / `single ticket`, `return ticket` / `round-trip ticket`, `carry-on luggage` / `hand luggage`, `train platform` / `platform` must be reviewed for correct alternatives. Literal unique Vietnamese cues are not proof of unambiguous single-answer typing.
- All IPA is provisional UK-oriented text; check multi-word connected speech and Vietnamese glosses in a bilingual editorial workflow.
- LIFE-06 includes four group sections but only **three original topics**. No new `ws_topics` row, Admin action, branch migration, CEFR importer exception, SRS modification, game code, accepted answer list, deployment or Production data change.

## QA and eventual release

1. `npm run vocab:plan` checks all 6 DRAFT batches, 100 × 6 proposals, exact collisions, quotas 4 × 25, sources and 0 authorization.
2. `npm run check`, `npm test` on Node 24 / isolated PostgreSQL, plus Chromium/Firefox E2E of account sync and SRS must pass at the exact PR SHA.
3. Human bilingual reviewer must validate selected senses, target levels (especially 96 inferred cases), IPA, translations, original examples and learner answer ambiguity.
4. Only after approval, design a separate, restricted and idempotent importer preserving word IDs and existing SRS records; perform live catalog read-only reconciliation, independent Preview backup/release testing and rollback rehearsal.
5. Do not merge content merely to increase the Production vocabulary. Merging a `DRAFT` JSON does **not** publish it to WordSky.

## Complete 100-entry reviewer inventory

| # | Group | English | Proposed CEFR | Evidence category | Vietnamese teaching cue |
|---:|---|---|---|---|---|
| 1 | commute | commute | C1 | Cambridge sense | Đi lại đều đặn giữa nhà và nơi làm việc |
| 2 | commute | rush hour | B1 | Contextual inference | Giờ cao điểm khi đường đông người và xe |
| 3 | commute | bus stop | A1 | Contextual inference | Điểm dừng để đón hoặc xuống xe buýt |
| 4 | commute | bus route | A2 | Contextual inference | Tuyến đường xe buýt di chuyển |
| 5 | commute | fare | B1 | Cambridge sense | Tiền vé phải trả cho một chuyến xe hoặc tàu |
| 6 | commute | one-way ticket | A2 | Contextual inference | Vé chỉ đi một chiều không bao gồm lượt về |
| 7 | commute | monthly pass | B1 | Contextual inference | Vé tháng cho phép đi lại nhiều lần |
| 8 | commute | season ticket | B1 | Contextual inference | Vé dài hạn dùng nhiều lượt trong một thời kỳ |
| 9 | commute | catch the bus | A2 | Contextual inference | Kịp lên chuyến xe buýt mình muốn đi |
| 10 | commute | miss the bus | A2 | Contextual inference | Bị lỡ chuyến xe buýt dự định đi |
| 11 | commute | board the bus | B1 | Contextual inference | Bước lên xe buýt để bắt đầu chuyến đi |
| 12 | commute | get off at the next stop | A2 | Contextual inference | Xuống xe tại trạm kế tiếp |
| 13 | commute | change trains | A2 | Contextual inference | Chuyển từ tàu đang đi sang chuyến tàu khác |
| 14 | commute | transfer to another line | B1 | Contextual inference | Chuyển sang tuyến tàu hoặc xe khác |
| 15 | commute | platform | A2 | Cambridge sense | Sân ga để lên xuống tàu hỏa |
| 16 | commute | departure board | B1 | Contextual inference | Bảng thông báo giờ và chuyến sắp khởi hành |
| 17 | commute | arrival time | A2 | Contextual inference | Giờ chuyến xe hoặc tàu tới nơi |
| 18 | commute | departure time | A2 | Contextual inference | Giờ phương tiện bắt đầu xuất phát |
| 19 | commute | public transport | A2 | Contextual inference | Hệ thống phương tiện chở khách dùng chung |
| 20 | commute | traffic jam | B1 | Contextual inference | Tình trạng xe cộ ùn tắc trên đường |
| 21 | commute | heavy traffic | A2 | Contextual inference | Tình trạng đường có rất nhiều xe lưu thông |
| 22 | commute | ride to work | A2 | Contextual inference | Đi đến chỗ làm bằng xe hoặc nhờ xe |
| 23 | commute | walk to school | A1 | Contextual inference | Đi bộ từ nhà tới trường |
| 24 | commute | cycle to work | A2 | Contextual inference | Đi làm bằng xe đạp |
| 25 | commute | last train | A2 | Contextual inference | Chuyến tàu cuối cùng trong ngày |
| 26 | navigation | turn left at the lights | A2 | Contextual inference | Rẽ trái tại chỗ có đèn giao thông |
| 27 | navigation | turn right after the bridge | A2 | Contextual inference | Rẽ phải sau khi qua cầu |
| 28 | navigation | go straight ahead | A1 | Contextual inference | Tiếp tục đi thẳng theo hướng đang đi |
| 29 | navigation | cross the street | A1 | Contextual inference | Đi bộ sang bên kia đường |
| 30 | navigation | at the crossroads | B1 | Contextual inference | Ở vị trí giao nhau của nhiều con đường |
| 31 | navigation | at the roundabout | B1 | Contextual inference | Ở vòng xuyến giao thông |
| 32 | navigation | pedestrian crossing | B1 | Contextual inference | Vạch hoặc lối dành cho người đi bộ sang đường |
| 33 | navigation | traffic lights | A2 | Contextual inference | Bộ đèn điều khiển giao thông ở ngã đường |
| 34 | navigation | opposite the bank | A2 | Contextual inference | Ở phía đối diện ngân hàng |
| 35 | navigation | next to the station | A1 | Contextual inference | Nằm ngay bên cạnh nhà ga |
| 36 | navigation | around the corner | A2 | Contextual inference | Nằm ngay sau góc rẽ gần đây |
| 37 | navigation | walk past the park | A2 | Contextual inference | Đi bộ ngang qua công viên |
| 38 | navigation | follow the signs | A2 | Contextual inference | Đi theo những biển chỉ dẫn |
| 39 | navigation | take the second exit | B1 | Contextual inference | Chọn lối ra thứ hai ở vòng xuyến hoặc nút giao |
| 40 | navigation | on your left | A1 | Contextual inference | Nằm ở bên trái của bạn |
| 41 | navigation | on your right | A1 | Contextual inference | Nằm ở bên phải của bạn |
| 42 | navigation | nearest pharmacy | A2 | Contextual inference | Hiệu thuốc ở vị trí gần nhất |
| 43 | navigation | Could you show me on the map | A2 | Contextual inference | Bạn có thể chỉ vị trí ấy trên bản đồ không |
| 44 | navigation | How far is it from here | A2 | Contextual inference | Từ đây đến đó xa bao nhiêu |
| 45 | navigation | How long does it take to walk | A2 | Contextual inference | Đi bộ đến đó cần bao nhiêu thời gian |
| 46 | navigation | Is it within walking distance | B1 | Contextual inference | Có thể đi bộ tới nơi đó một cách thuận tiện không |
| 47 | navigation | I think we are lost | A2 | Contextual inference | Tôi nghĩ chúng ta đang bị lạc đường |
| 48 | navigation | Let's check the map | A1 | Contextual inference | Chúng ta hãy kiểm tra bản đồ |
| 49 | navigation | Is this the right way | A2 | Contextual inference | Đây có đúng đường để đến nơi cần tìm không |
| 50 | navigation | You cannot miss it | B1 | Contextual inference | Nơi đó rất dễ nhận ra nên bạn sẽ không đi lố |
| 51 | bookings | book a train ticket | A2 | Contextual inference | Đặt mua vé đi tàu trước chuyến đi |
| 52 | bookings | reserve a seat | A2 | Contextual inference | Giữ trước một chỗ ngồi trên phương tiện |
| 53 | bookings | choose a window seat | A2 | Contextual inference | Chọn ghế ở cạnh cửa sổ |
| 54 | bookings | select an aisle seat | B1 | Contextual inference | Chọn ghế sát lối đi giữa hai dãy ghế |
| 55 | bookings | check ticket availability | B1 | Contextual inference | Kiểm tra còn vé cho chuyến đi hay không |
| 56 | bookings | confirm a booking | A2 | Contextual inference | Xác nhận một đặt chỗ đã được ghi nhận |
| 57 | bookings | booking reference | B1 | Contextual inference | Mã số dùng tra cứu một đơn đặt chỗ |
| 58 | bookings | itinerary | C1 | Cambridge sense | Lịch trình chi tiết của một chuyến du lịch |
| 59 | bookings | return ticket | A2 | Contextual inference | Vé đi và về cho cùng hành trình |
| 60 | bookings | one-way flight | A2 | Contextual inference | Chuyến bay chỉ có lượt đi không đặt lượt về |
| 61 | bookings | check in online | A2 | Contextual inference | Làm thủ tục nhận chỗ qua trang mạng |
| 62 | bookings | boarding time | A2 | Contextual inference | Giờ bắt đầu cho hành khách lên máy bay |
| 63 | bookings | baggage allowance | B2 | Contextual inference | Khối lượng hoặc số kiện hành lý được phép mang |
| 64 | bookings | carry-on luggage | B1 | Contextual inference | Hành lý được phép mang lên khoang khách |
| 65 | bookings | checked baggage | B1 | Contextual inference | Hành lý ký gửi vào khoang chứa của máy bay |
| 66 | bookings | request early check-in | B1 | Contextual inference | Đề nghị khách sạn cho nhận phòng sớm |
| 67 | bookings | late check-out | B1 | Contextual inference | Dịch vụ trả phòng muộn hơn giờ quy định |
| 68 | bookings | room reservation | A2 | Contextual inference | Đơn đặt phòng lưu trú trước |
| 69 | bookings | double room | A2 | Contextual inference | Phòng khách sạn có một giường lớn cho hai người |
| 70 | bookings | twin room | A2 | Contextual inference | Phòng khách sạn có hai giường đơn riêng biệt |
| 71 | bookings | hotel reception | A2 | Contextual inference | Quầy tiếp tân của khách sạn |
| 72 | bookings | breakfast included | A2 | Contextual inference | Giá phòng đã bao gồm bữa ăn sáng |
| 73 | bookings | refundable rate | B2 | Contextual inference | Mức giá đặt phòng cho phép hoàn tiền theo điều kiện |
| 74 | bookings | cancellation fee | B1 | Contextual inference | Phí bị thu khi hủy chỗ đặt trước |
| 75 | bookings | change the travel date | A2 | Contextual inference | Dời ngày khởi hành sang ngày khác |
| 76 | disruptions | my train is delayed | A2 | Contextual inference | Chuyến tàu tôi đi bị chậm giờ |
| 77 | disruptions | the flight has been cancelled | B1 | Contextual inference | Chuyến bay đã bị hãng hủy |
| 78 | disruptions | missed connection | B2 | Contextual inference | Lỡ chuyến nối tiếp trong hành trình |
| 79 | disruptions | platform change | B1 | Contextual inference | Thông báo đổi sân ga lên tàu |
| 80 | disruptions | service disruption | B2 | Contextual inference | Gián đoạn hoạt động bình thường của tuyến vận tải |
| 81 | disruptions | road closure | B1 | Contextual inference | Việc đóng một đoạn đường không cho xe đi qua |
| 82 | disruptions | diversion | B2 | Contextual inference | Tuyến đường đi vòng tạm thời thay lộ trình cũ |
| 83 | disruptions | traffic accident | B1 | Contextual inference | Vụ tai nạn xảy ra trên đường giao thông |
| 84 | disruptions | unexpected delay | B1 | Contextual inference | Sự chậm trễ ngoài dự kiến |
| 85 | disruptions | delayed departure | B1 | Contextual inference | Giờ khởi hành bị lùi lại so với lịch |
| 86 | disruptions | lost luggage | B1 | Contextual inference | Hành lý bị thất lạc trong chuyến đi |
| 87 | disruptions | missing baggage | B1 | Contextual inference | Hành lý đáng lẽ đến nhưng chưa nhận được |
| 88 | disruptions | damaged suitcase | B1 | Contextual inference | Va li bị vỡ hoặc hỏng trong quá trình vận chuyển |
| 89 | disruptions | flight cancellation | B1 | Contextual inference | Việc hủy một chuyến bay theo lịch |
| 90 | disruptions | rebook a flight | B1 | Contextual inference | Đặt lại chuyến bay sau khi lịch thay đổi |
| 91 | disruptions | reschedule my trip | B2 | Contextual inference | Đổi lịch chuyến đi sang thời điểm khác |
| 92 | disruptions | request travel assistance | B2 | Contextual inference | Yêu cầu được hỗ trợ khi đang di chuyển |
| 93 | disruptions | customer service desk | B1 | Contextual inference | Quầy phụ trách giải đáp và hỗ trợ hành khách |
| 94 | disruptions | refund for the ticket | B1 | Contextual inference | Khoản tiền được hoàn lại cho vé đã mua |
| 95 | disruptions | missed the last bus | A2 | Contextual inference | Đã lỡ chuyến xe buýt cuối ngày |
| 96 | disruptions | wrong train | A2 | Contextual inference | Chuyến tàu không đúng với hành trình cần đi |
| 97 | disruptions | I need directions | A2 | Contextual inference | Tôi cần được chỉ đường đi |
| 98 | disruptions | I cannot find my ticket | A1 | Contextual inference | Tôi không thể tìm thấy vé của mình |
| 99 | disruptions | Is there another route | A2 | Contextual inference | Có tuyến đường khác để đi không |
| 100 | disruptions | When is the next train | A1 | Contextual inference | Chuyến tàu kế tiếp đến lúc nào |
