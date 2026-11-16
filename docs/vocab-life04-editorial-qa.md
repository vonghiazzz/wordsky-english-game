# LIFE-04 — Food, kitchen, cooking, dining (100 editorial entries)

**Status: DRAFT / all 100 PROVISIONAL.** This repository fixture does not change Production vocabulary, existing 26-topic seed, user progress, SRS, gameplay, approved CEFR records or any DB topic.

## Scope

Source file: `vocab/batches/LIFE-04.json`. Precisely **4 × 25 = 100 new entries**:

| Group | Intended topic | Count |
|---|---|---:|
| Ingredients and food | Food (existing) | 25 |
| Kitchen objects and tools | Cooking & Kitchen - Nấu ăn (proposed) | 25 |
| Cooking actions and recipe phrases | Cooking & Kitchen - Nấu ăn (proposed) | 25 |
| Restaurant and dining expressions | Restaurant - Nhà hàng (existing) | 25 |

`Cooking & Kitchen - Nấu ăn` is still an **unapproved, inactive proposed topic**. The LIFE-02 and LIFE-03 topic-registration policies do NOT authorize creating a LIFE-04 topic. That requires a separate later gate, isolated Preview QA, review, and explicit approval.

## Independent educational source checks (2026-11-16)

**Direct source-labeled evidence (14 entries, selected food sense):** Cambridge English Dictionary entry links are recorded in each word's `source_url`. Labels:
`tomato` A1; `potato` A1; `salt` A1; `onion` A2; `garlic` A2; `carrot` A2; `mushroom` A2; `cucumber` B1; `lettuce` B1; `beef` B1; `pork` B1; `turkey` B1 (meat sense); `flour` B1; `vinegar` B2.

Examples of specific source evidence:
- Cambridge [tomato](https://dictionary.cambridge.org/dictionary/english/tomato): edible tomato sense **A1**
- Cambridge [carrot](https://dictionary.cambridge.org/dictionary/english/carrot): vegetable sense **A2**, distinct from its informal reward sense **C2**
- Cambridge [beef](https://dictionary.cambridge.org/dictionary/english/beef): food/meat sense **B1**, not the informal complaint sense
- Cambridge [vinegar](https://dictionary.cambridge.org/dictionary/english/vinegar): food-condiment sense **B2**

**Contextual CEFR estimates (86 entries)** are deliberately distinct and `cefr_source_label=null`, because broad lesson A1/A2 level does **not** certify individual vocabulary:
- British Council [Food in Britain 1](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/food-britain-1)
- British Council [Kitchens 1 — A2](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/kitchens-1)
- British Council [Meals and cooking — A2](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/meals-cooking)
- British Council [Restaurants 1 — A1](https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2/restaurants-1)
- British Council [Booking a table — A1 listening](https://learnenglish.britishcouncil.org/free-resources/listening/a1/booking-table)
- British Council [Ordering in a café — A1 listening](https://learnenglish.britishcouncil.org/free-resources/listening/a1/ordering-cafe)

These are **teaching-context references only**; they are not fabricated as verbatim source quotations or individual A1–C2 attestations. Examples, IPA and Vietnamese cues are original WordSky editorial drafts requiring independent bilingual review.

## Proposed CEFR counts

| A1 | A2 | B1 | B2 | Total |
|---:|---:|---:|---:|---:|
| 10 | 39 | 44 | 7 | 100 |

These counts are descriptive, not a quota that can override source labels. Source labels still require validation of POS, selected sense and translation.

## QA facts and unresolved release conditions

- Zero exact English duplicates / identical Vietnamese cue collisions versus the 280 repository seed words, 117 legacy CEFR drafts, LIFE-01 (100), LIFE-02 (100), LIFE-03 (100), and within LIFE-04. No direct comparison with the **live** Production database has yet been performed.
- Literal Vietnamese cue uniqueness does **not** imply semantic disambiguation. Check confusing foods and kitchen tools; cooking phrases often permit synonyms and multiple correct responses.
- Restaurant requests like `Can I pay by card` and `Could I have the receipt` can have contractions, punctuation and translation variants. Do **not** feed these drafts directly to strict-answer recall or live SRS before acceptance rules and human review.
- A participant's learning records must never be deleted/reset by later catalog imports. Preview content import must be idempotent, preserve UUIDs, and be tested with account SRS fixtures.
- `npm run vocab:plan` automatically validates **all four saved batches** (100 × 4). New tests verify full records, source type, exact uniqueness and non-import status.
- `npm run check`, `npm test` and Chromium/Firefox/SRS/isolated PostgreSQL CI must pass on exact PR SHA before merge.
- **No CEFR APPROVED** records, no Admin approval, no new DB topics, no Vercel or Production deployment in this PR.

## Full editorial review inventory

| # | Group | Word / expression | CEFR proposal | Evidence kind | Vietnamese meaning |
|---:|---|---|---|---|---|
| 1 | ingredients | tomato | A1 | Cambridge sense label | Quả cà chua dùng để nấu ăn |
| 2 | ingredients | onion | A2 | Cambridge sense label | Củ hành tây có nhiều lớp |
| 3 | ingredients | garlic | A2 | Cambridge sense label | Tỏi dùng để tạo mùi thơm món ăn |
| 4 | ingredients | carrot | A2 | Cambridge sense label | Củ cà rốt màu cam |
| 5 | ingredients | potato | A1 | Cambridge sense label | Củ khoai tây |
| 6 | ingredients | cucumber | B1 | Cambridge sense label | Quả dưa chuột ăn sống trong salad |
| 7 | ingredients | lettuce | B1 | Cambridge sense label | Rau xà lách thường ăn sống |
| 8 | ingredients | spinach | B1 | Contextual inference | Rau bina có lá xanh |
| 9 | ingredients | broccoli | B1 | Contextual inference | Bông cải xanh có nhiều nhánh |
| 10 | ingredients | cabbage | B1 | Contextual inference | Bắp cải có các lớp lá cuộn |
| 11 | ingredients | mushroom | A2 | Cambridge sense label | Nấm ăn dùng trong món nấu |
| 12 | ingredients | bell pepper | B1 | Contextual inference | Ớt chuông không cay |
| 13 | ingredients | beef | B1 | Cambridge sense label | Thịt bò dùng làm thực phẩm |
| 14 | ingredients | pork | B1 | Cambridge sense label | Thịt lợn dùng để chế biến món ăn |
| 15 | ingredients | turkey | B1 | Cambridge sense label | Thịt gà tây dùng làm món ăn |
| 16 | ingredients | prawn | B1 | Contextual inference | Con tôm biển dùng làm thực phẩm |
| 17 | ingredients | tofu | B1 | Contextual inference | Đậu phụ làm từ đậu nành |
| 18 | ingredients | chickpea | B2 | Contextual inference | Hạt đậu gà thường nấu hoặc làm salad |
| 19 | ingredients | lentil | B2 | Contextual inference | Hạt đậu lăng nhỏ dùng nấu súp |
| 20 | ingredients | flour | B1 | Cambridge sense label | Bột mì để làm bánh và nấu ăn |
| 21 | ingredients | sugar | A1 | Contextual inference | Đường tạo vị ngọt cho thức ăn |
| 22 | ingredients | salt | A1 | Cambridge sense label | Muối ăn dùng để nêm món |
| 23 | ingredients | vinegar | B2 | Cambridge sense label | Giấm có vị chua dùng nêm món |
| 24 | ingredients | cooking oil | A2 | Contextual inference | Dầu ăn dùng để chiên xào |
| 25 | ingredients | soy sauce | B1 | Contextual inference | Nước tương làm từ đậu nành |
| 26 | kitchen | cutting board | A2 | Contextual inference | Thớt để cắt thái thực phẩm |
| 27 | kitchen | vegetable peeler | B1 | Contextual inference | Dụng cụ nạo vỏ rau củ |
| 28 | kitchen | cheese grater | B1 | Contextual inference | Bàn nạo phô mai thành sợi |
| 29 | kitchen | colander | B2 | Contextual inference | Rổ có lỗ dùng để ráo nước thực phẩm |
| 30 | kitchen | sieve | B2 | Contextual inference | Rây lưới mịn dùng lọc hoặc rây bột |
| 31 | kitchen | mixing bowl | A2 | Contextual inference | Bát lớn để trộn nguyên liệu |
| 32 | kitchen | measuring cup | A2 | Contextual inference | Cốc có vạch đo thể tích |
| 33 | kitchen | measuring spoon | B1 | Contextual inference | Thìa có định lượng cố định |
| 34 | kitchen | frying pan | A2 | Contextual inference | Chảo đáy phẳng dùng để rán |
| 35 | kitchen | saucepan | B1 | Contextual inference | Nồi nhỏ có tay cầm để nấu sốt |
| 36 | kitchen | wok | B1 | Contextual inference | Chảo sâu lòng dùng để xào |
| 37 | kitchen | pan lid | A2 | Contextual inference | Nắp đậy vừa chiếc chảo nấu |
| 38 | kitchen | spatula | B1 | Contextual inference | Xẻng dẹt dùng lật thức ăn |
| 39 | kitchen | ladle | B1 | Contextual inference | Muôi dài để múc canh |
| 40 | kitchen | kitchen tongs | B1 | Contextual inference | Kẹp gắp thức ăn dùng trong bếp |
| 41 | kitchen | whisk | B1 | Contextual inference | Dụng cụ đánh trứng bằng dây kim loại |
| 42 | kitchen | rolling pin | B2 | Contextual inference | Cây cán bột làm bánh |
| 43 | kitchen | baking tray | B1 | Contextual inference | Khay phẳng dùng nướng bánh |
| 44 | kitchen | oven glove | B1 | Contextual inference | Găng tay chịu nhiệt để lấy đồ nóng |
| 45 | kitchen | apron | B1 | Contextual inference | Tạp dề bảo vệ quần áo khi nấu |
| 46 | kitchen | food container | A2 | Contextual inference | Hộp đựng thực phẩm có nắp |
| 47 | kitchen | storage jar | B1 | Contextual inference | Lọ có nắp dùng bảo quản thực phẩm khô |
| 48 | kitchen | kitchen counter | B1 | Contextual inference | Mặt bàn bếp để sơ chế thức ăn |
| 49 | kitchen | kitchen scale | B1 | Contextual inference | Cân nhà bếp đo khối lượng nguyên liệu |
| 50 | kitchen | dish rack | B1 | Contextual inference | Giá úp bát đĩa cho ráo nước |
| 51 | cooking | wash the vegetables | A1 | Contextual inference | Rửa sạch rau củ trước khi nấu |
| 52 | cooking | peel the potatoes | A2 | Contextual inference | Gọt bỏ vỏ khoai tây |
| 53 | cooking | chop the onions | A2 | Contextual inference | Băm hành tây thành miếng nhỏ |
| 54 | cooking | slice the tomatoes | A2 | Contextual inference | Thái cà chua thành các lát mỏng |
| 55 | cooking | dice the carrots | B1 | Contextual inference | Thái cà rốt thành hạt lựu |
| 56 | cooking | mince the garlic | B2 | Contextual inference | Băm tỏi thật nhuyễn |
| 57 | cooking | boil water | A1 | Contextual inference | Đun nước đến khi sôi mạnh |
| 58 | cooking | simmer the soup | B1 | Contextual inference | Ninh súp liu riu ở lửa nhỏ |
| 59 | cooking | steam the fish | A2 | Contextual inference | Hấp cá bằng hơi nước nóng |
| 60 | cooking | grill the meat | A2 | Contextual inference | Nướng thịt trên vỉ hoặc lửa trực tiếp |
| 61 | cooking | fry an egg | A1 | Contextual inference | Rán một quả trứng trong chảo |
| 62 | cooking | stir-fry the vegetables | B1 | Contextual inference | Xào rau củ bằng ít dầu ở lửa lớn |
| 63 | cooking | roast the chicken | A2 | Contextual inference | Quay hoặc nướng gà trong lò |
| 64 | cooking | bake a cake | A2 | Contextual inference | Nướng một chiếc bánh ngọt trong lò |
| 65 | cooking | mix the ingredients | A2 | Contextual inference | Trộn đều các nguyên liệu trong công thức |
| 66 | cooking | add a pinch of salt | A2 | Contextual inference | Nêm một nhúm muối nhỏ |
| 67 | cooking | season the soup | B1 | Contextual inference | Nêm nếm gia vị cho món súp |
| 68 | cooking | stir the sauce | A2 | Contextual inference | Khuấy nước sốt cho đều |
| 69 | cooking | preheat the oven | B1 | Contextual inference | Làm nóng lò trước khi cho đồ vào |
| 70 | cooking | turn down the heat | B1 | Contextual inference | Giảm nhiệt độ của bếp đang nấu |
| 71 | cooking | cover the pan | A2 | Contextual inference | Đậy nắp chảo để giữ nhiệt |
| 72 | cooking | drain the pasta | B1 | Contextual inference | Chắt nước khỏi mì ống đã luộc |
| 73 | cooking | taste the sauce | A2 | Contextual inference | Nếm thử nước sốt để kiểm tra vị |
| 74 | cooking | serve the food | A2 | Contextual inference | Dọn món ăn ra cho mọi người dùng |
| 75 | cooking | let it cool | A2 | Contextual inference | Để món ăn nguội bớt trước khi dùng |
| 76 | dining | A table for two, please | A1 | Contextual inference | Xin xếp một bàn cho hai người |
| 77 | dining | Do you have a reservation | A2 | Contextual inference | Anh chị đã đặt bàn trước chưa |
| 78 | dining | Could we sit by the window | A2 | Contextual inference | Chúng tôi có thể ngồi gần cửa sổ không |
| 79 | dining | May I see the specials | B1 | Contextual inference | Tôi có thể xem các món đặc biệt hôm nay không |
| 80 | dining | What do you recommend | A2 | Contextual inference | Bạn gợi ý tôi nên gọi món nào |
| 81 | dining | Is this dish spicy | A2 | Contextual inference | Món này có vị cay không |
| 82 | dining | Does it contain peanuts | B1 | Contextual inference | Món này có chứa đậu phộng không |
| 83 | dining | I am allergic to peanuts | B1 | Contextual inference | Tôi bị dị ứng với đậu phộng |
| 84 | dining | Could you make it less spicy | A2 | Contextual inference | Bạn có thể làm món này bớt cay không |
| 85 | dining | Can we order now | A1 | Contextual inference | Bây giờ chúng tôi gọi món được chưa |
| 86 | dining | I will have the grilled fish | A2 | Contextual inference | Tôi sẽ gọi món cá nướng |
| 87 | dining | Could I have some water | A1 | Contextual inference | Cho tôi xin một ít nước uống được không |
| 88 | dining | Can I get an extra plate | A2 | Contextual inference | Tôi có thể xin thêm một chiếc đĩa không |
| 89 | dining | Could we share this dish | A2 | Contextual inference | Hai chúng tôi có thể cùng ăn chung món này không |
| 90 | dining | Please bring the sauce separately | B1 | Contextual inference | Xin mang nước sốt ra riêng chứ đừng rưới lên món |
| 91 | dining | Is service included | B1 | Contextual inference | Giá này đã gồm phí phục vụ chưa |
| 92 | dining | Could we split the bill | B1 | Contextual inference | Chúng tôi có thể chia tiền hóa đơn không |
| 93 | dining | Do you accept cards | A2 | Contextual inference | Nhà hàng có nhận thanh toán bằng thẻ không |
| 94 | dining | Can I pay by card | A2 | Contextual inference | Tôi có thể thanh toán bằng thẻ không |
| 95 | dining | Could I have the receipt | A2 | Contextual inference | Tôi có thể lấy biên lai thanh toán không |
| 96 | dining | The food was excellent | A2 | Contextual inference | Đồ ăn vừa rồi rất xuất sắc |
| 97 | dining | This is not what I ordered | A2 | Contextual inference | Đây không phải món tôi đã gọi |
| 98 | dining | My meal is cold | A2 | Contextual inference | Phần ăn được mang ra đã nguội |
| 99 | dining | Could you replace this dish | B1 | Contextual inference | Bạn có thể đổi món ăn này giúp tôi không |
| 100 | dining | Can we take the leftovers home | B1 | Contextual inference | Chúng tôi có thể mang thức ăn còn lại về không |
