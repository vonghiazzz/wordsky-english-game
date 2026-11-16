# LIFE-03 — Family, friends and social relationships (100 candidates)

**Status: DRAFT, PROVISIONAL, not imported or published.** PR contents are editorial fixtures only. No reviewer was impersonated, no new topic was created in any database, and neither SRS nor game scoring was modified.

## Scope

The dataset `vocab/batches/LIFE-03.json` adds **100 distinct English terms or practical expressions in four groups × 25**:

| Editorial group | Intended topic | New entries |
|---|---|---:|
| Người thân và quan hệ gia đình | Family | 25 |
| Tình bạn và lời mời | Social Relationships - Quan hệ xã hội | 25 |
| Tụ họp và hoạt động xã hội | Social Relationships - Quan hệ xã hội | 25 |
| Chia sẻ cảm xúc và hỗ trợ | Feelings - Cảm xúc | 25 |

- Existing WordSky topics: `Family`, `Feelings - Cảm xúc`.
- **Proposed / not activated**: `Social Relationships - Quan hệ xã hội`. Its presence in the roadmap is NOT approval to insert or enable a topic; a separate inactive-Preview registration and release decision is required.
- The dictionary-like 280-word GitHub seed, 117 original CEFR drafts, LIFE-01 (100) and LIFE-02 (100) were checked: **zero exact English duplicates and zero identical literal Vietnamese cues**. **Production PostgreSQL was not queried** and must be checked before any future import.

## CEFR: source checked vs contextual inference

Cambridge Dictionary explains that CEFR labels apply to particular words, phrases or senses, rather than an entire conversation universally: https://dictionary.cambridge.org/help.htm

Source verification dated **2026-11-16** supports:

- **20 exact-sense Cambridge labels**, all in the family group. The English entry's relevant noun meaning and level were inspected individually. Examples: `grandson` and `granddaughter` **A2**; `nephew` and `niece` **B1**; `stepfather` and `stepmother` **B2**; `sibling`, `spouse` and `toddler` **C2**. These may be surprising but must **not be downgraded to match a numeric target**.
- **80 contextual inferences** across family/relationships/social gatherings/emotional support. Teaching resources corroborate the **communication themes**, NOT a separate A1–C2 grade for each WordSky phrase. All 80 are `cefr_evidence_kind=contextual_inference`, with `cefr_source_label=null` and a source-specific warning. Oxford/Cambridge source URLs are not forged as per-entry evidence.
- `in-law` is **C1 provisional**: the Cambridge English headword definition does not show a direct English-profile CEFR label; a related bilingual result points to C1. The record intentionally remains a contextual inference and needs reviewer adjudication.
- Every item, including 20 with Cambridge headword labels, remains `review_status=PROVISIONAL`; a sense label alone is **not a review of IPA, translation, or gameplay answer acceptability**.

### Levels actually proposed

| A1 | A2 | B1 | B2 | C1 | C2 | Total |
|---:|---:|---:|---:|---:|---:|---:|
| 8 | 26 | 43 | 19 | 1 | 3 | 100 |

The LIFE-1000 A1/A2/B1/B2 distribution is an **editorial target only**, not a grading quota that overrides real dictionary labels.

### Reference themes (verified public educational resources)

- **Family relationships:** British Council [Starting Out — Episode 09 Family photos](https://learnenglish.britishcouncil.org/free-resources/general/video-series/starting-out/episode-09-family-photos); Cambridge individual noun entries linked per record.
- **Invitations and friendship:** Cambridge Grammar Today [Invitations](https://dictionary.cambridge.org/grammar/british-grammar/invitations); British Council [Messaging to make plans — A2](https://learnenglish.britishcouncil.org/free-resources/writing/a2/messaging-make-plans) and [B1 speaking](https://learnenglish.britishcouncil.org/free-resources/speaking/b1).
- **Social gatherings:** Cambridge Invitations and British Council A2 messaging/B1 speaking cover communicative functions. Example sentences and translations are WordSky-authored rather than quoted course text.
- **Emotional support:** British Council [Responding to news — B1](https://learnenglish.britishcouncil.org/free-resources/speaking/b1/responding-news), Cambridge [Offers](https://dictionary.cambridge.org/grammar/british-grammar/offers).

## Human review / unsafe-to-auto-activate cases

**Priority review A — semantic duplicates and answer ambiguity.** `grandson` / `nephew`, `granddaughter` / `niece` and the stepfamily terms can be confused in Vietnamese if relationship context is omitted. Forms such as `get along with`, `catch up`, `feel upset`, `make up after an argument` may have several correct Vietnamese/English expressions. Exact textual collision checks do **not** establish semantic uniqueness. Require a sense-disambiguated prompt and accepted-answer policy before SRS strict recall.

**Priority review B — level and IPA.** Check the 80 non-labeled CEFR placements against additional individual-sense evidence. `in-law` C1 is provisional. `sibling`, `spouse`, and `toddler` have verified Cambridge C2 headword tags but still need editorial decisions about relevance to daily-life learning. Confirm connected-speech IPA, UK/US variants, register and whether each constructed example is idiomatic.

**Priority review C — topic design.** Review whether the new `Social Relationships` topic meaningfully adds value beyond `Family`, `Greetings` and `Feelings`. No new topic or CEFR importer changes are in this PR. The existing LIFE-02 disabled-topic gate is topic-specific and is **not** automatically reused or bypassed for LIFE-03.

## QA, security and release boundary

- `npm run vocab:plan` must preflight **LIFE-01, LIFE-02 and LIFE-03** together. Checks 25 per group, exact duplicates vs seed + old CEFR drafts + saved batches, non-approved state, evidence metadata and safe source URL syntax.
- `npm run check && npm test` plus isolated PostgreSQL17 / Chromium and Firefox browser / SRS acceptance.
- Unit tests assert exactly **20 Cambridge sense-labeled records** and **80 contextual records** and reject fabricated CEFR source labels or approval.
- No personal data, importer change, API change, SRS writes, feature flag or Production/Preview database connection.
- After independent bilingual review: a separate approved-topic creation plan, CEFR importer gating, Production catalog duplicate scan, backup and rollback rehearsal are required. GitHub merge does NOT publish vocabulary.

## Complete 100-entry inventory

| # | Group | English | Proposed CEFR | Evidence | Vietnamese cue |
|---:|---|---|---|---|---|
| 1 | family | grandmother | A2 | Cambridge sense | Bà là mẹ của bố hoặc mẹ mình |
| 2 | family | grandfather | A2 | Cambridge sense | Ông là bố của bố hoặc mẹ mình |
| 3 | family | grandson | A2 | Cambridge sense | Cháu trai là con trai của con mình |
| 4 | family | granddaughter | A2 | Cambridge sense | Cháu gái là con gái của con mình |
| 5 | family | grandparents | A2 | Context estimate | Ông bà thuộc thế hệ cha mẹ của bố mẹ |
| 6 | family | sibling | C2 | Cambridge sense | Một người anh chị em cùng cha mẹ hoặc chung một người thân sinh |
| 7 | family | cousin | A2 | Cambridge sense | Anh chị em họ là con của cô chú bác cậu dì |
| 8 | family | niece | B1 | Cambridge sense | Cháu gái là con gái của anh chị em mình |
| 9 | family | nephew | B1 | Cambridge sense | Cháu trai là con trai của anh chị em mình |
| 10 | family | husband | A1 | Cambridge sense | Người chồng trong quan hệ hôn nhân |
| 11 | family | wife | A1 | Cambridge sense | Người vợ trong quan hệ hôn nhân |
| 12 | family | spouse | C2 | Cambridge sense | Người phối ngẫu là vợ hoặc chồng |
| 13 | family | parent | A1 | Cambridge sense | Một người làm cha hoặc mẹ |
| 14 | family | daughter | A1 | Cambridge sense | Con gái của một người |
| 15 | family | son | A1 | Cambridge sense | Con trai của một người |
| 16 | family | toddler | C2 | Cambridge sense | Em bé đang ở tuổi tập đi |
| 17 | family | teenager | A2 | Cambridge sense | Thanh thiếu niên từ mười ba đến mười chín tuổi |
| 18 | family | adult | A1 | Cambridge sense | Người đã trưởng thành |
| 19 | family | relative | B1 | Cambridge sense | Người họ hàng có quan hệ thân tộc |
| 20 | family | in-law | C1 | Context estimate | Người thân qua quan hệ hôn nhân |
| 21 | family | stepmother | B2 | Cambridge sense | Mẹ kế là vợ của cha nhưng không phải mẹ ruột |
| 22 | family | stepfather | B2 | Cambridge sense | Bố dượng là chồng của mẹ nhưng không phải bố ruột |
| 23 | family | stepbrother | B2 | Context estimate | Con trai riêng của bố dượng hoặc mẹ kế (không cùng huyết thống) |
| 24 | family | stepsister | B2 | Context estimate | Con gái riêng của bố dượng hoặc mẹ kế (không cùng huyết thống) |
| 25 | family | only child | A2 | Context estimate | Con một không có anh chị em ruột |
| 26 | friendship | close friend | A2 | Context estimate | Người bạn thân có quan hệ gần gũi |
| 27 | friendship | best friend | A1 | Context estimate | Người bạn thân nhất của mình |
| 28 | friendship | childhood friend | B1 | Context estimate | Người bạn quen từ thời thơ ấu |
| 29 | friendship | old friend | A2 | Context estimate | Người bạn quen đã lâu năm |
| 30 | friendship | mutual friend | B2 | Context estimate | Người bạn chung của hai người |
| 31 | friendship | new acquaintance | B2 | Context estimate | Người mới quen chưa thật thân |
| 32 | friendship | get along with | B1 | Context estimate | Có quan hệ hòa thuận với ai |
| 33 | friendship | make time for someone | B1 | Context estimate | Chủ động dành thời gian cho ai |
| 34 | friendship | lose touch | B1 | Context estimate | Mất liên lạc với người từng quen |
| 35 | friendship | make friends | A2 | Context estimate | Kết bạn với những người mới |
| 36 | friendship | hang out | B1 | Context estimate | Đi chơi và dành thời gian cùng bạn bè |
| 37 | friendship | catch up | B1 | Context estimate | Hỏi thăm và cập nhật chuyện sau thời gian xa cách |
| 38 | friendship | ask someone out | B1 | Context estimate | Rủ ai đó đi hẹn hò lãng mạn |
| 39 | friendship | accept an invitation | B1 | Context estimate | Nhận lời mời tham gia một dịp gặp gỡ |
| 40 | friendship | turn down an invitation | B1 | Context estimate | Từ chối lời mời một cách lịch sự |
| 41 | friendship | invite someone over | B1 | Context estimate | Mời ai đến nhà mình chơi |
| 42 | friendship | meet for coffee | A2 | Context estimate | Hẹn gặp nhau để uống cà phê |
| 43 | friendship | give someone a call | A2 | Context estimate | Gọi điện thoại cho một người |
| 44 | friendship | send a message | A2 | Context estimate | Gửi một tin nhắn cho người khác |
| 45 | friendship | share interests | B1 | Context estimate | Có những mối quan tâm chung để chia sẻ |
| 46 | friendship | have a lot in common | B1 | Context estimate | Có nhiều điểm giống nhau về sở thích hoặc tính cách |
| 47 | friendship | trust someone | A2 | Context estimate | Tin tưởng một người |
| 48 | friendship | rely on someone | B2 | Context estimate | Dựa vào ai khi cần giúp đỡ |
| 49 | friendship | get to know someone | B1 | Context estimate | Tìm hiểu một người để dần trở nên quen thân |
| 50 | friendship | keep a promise | B1 | Context estimate | Giữ đúng lời đã hứa với người khác |
| 51 | gatherings | birthday celebration | A2 | Context estimate | Buổi mừng sinh nhật dành cho một người |
| 52 | gatherings | family gathering | B1 | Context estimate | Buổi sum họp của những người trong gia đình |
| 53 | gatherings | dinner party | B1 | Context estimate | Bữa tiệc tối có mời khách tới dùng bữa |
| 54 | gatherings | housewarming party | B2 | Context estimate | Bữa tiệc mừng chuyển đến nhà mới |
| 55 | gatherings | wedding ceremony | B1 | Context estimate | Nghi lễ chính thức trong một đám cưới |
| 56 | gatherings | wedding reception | B2 | Context estimate | Tiệc tiếp đãi khách sau lễ cưới |
| 57 | gatherings | graduation party | B1 | Context estimate | Bữa tiệc chúc mừng một người tốt nghiệp |
| 58 | gatherings | farewell party | B1 | Context estimate | Bữa tiệc chia tay người sắp rời đi |
| 59 | gatherings | get-together | B1 | Context estimate | Buổi gặp mặt thân mật không quá trang trọng |
| 60 | gatherings | group outing | B1 | Context estimate | Chuyến đi chơi chung của một nhóm người |
| 61 | gatherings | plan a gathering | B1 | Context estimate | Lên kế hoạch cho một buổi tụ họp |
| 62 | gatherings | arrange a meeting | B1 | Context estimate | Sắp xếp thời gian và địa điểm để gặp nhau |
| 63 | gatherings | send an invitation | A2 | Context estimate | Gửi lời mời tham dự một sự kiện |
| 64 | gatherings | RSVP | B2 | Context estimate | Xác nhận có tham dự hay không theo yêu cầu trong thiệp mời |
| 65 | gatherings | bring a gift | A2 | Context estimate | Mang theo một món quà tặng khi đến dự |
| 66 | gatherings | greet the guests | B1 | Context estimate | Ra chào đón những vị khách tới dự |
| 67 | gatherings | make a toast | B2 | Context estimate | Nâng ly nói lời chúc mừng mọi người |
| 68 | gatherings | take group photos | A2 | Context estimate | Chụp ảnh có nhiều người cùng đứng trong hình |
| 69 | gatherings | host an event | B1 | Context estimate | Đứng ra tổ chức và tiếp đón một sự kiện |
| 70 | gatherings | join the celebration | B1 | Context estimate | Tham gia vào hoạt động ăn mừng của mọi người |
| 71 | gatherings | introduce two friends | A2 | Context estimate | Giới thiệu hai người bạn cho nhau làm quen |
| 72 | gatherings | start a conversation | A2 | Context estimate | Mở đầu một cuộc trò chuyện với người khác |
| 73 | gatherings | exchange contact details | B1 | Context estimate | Trao đổi số điện thoại hoặc thông tin liên lạc |
| 74 | gatherings | say goodbye | A1 | Context estimate | Nói lời chào tạm biệt khi rời đi |
| 75 | gatherings | see someone off | B1 | Context estimate | Đến tiễn ai khi họ lên đường |
| 76 | feelings | feel lonely | A2 | Context estimate | Cảm thấy cô đơn vì thiếu người chia sẻ |
| 77 | feelings | feel left out | B1 | Context estimate | Cảm thấy bị đứng ngoài một nhóm hoặc hoạt động |
| 78 | feelings | feel disappointed | B1 | Context estimate | Cảm thấy thất vọng vì kết quả không như mong đợi |
| 79 | feelings | feel relieved | B1 | Context estimate | Cảm thấy nhẹ nhõm khi điều lo lắng đã qua |
| 80 | feelings | feel grateful | B1 | Context estimate | Cảm thấy biết ơn vì sự giúp đỡ nhận được |
| 81 | feelings | feel upset | A2 | Context estimate | Cảm thấy buồn bực vì một chuyện không vui |
| 82 | feelings | feel worried | A2 | Context estimate | Cảm thấy lo lắng về điều có thể xảy ra |
| 83 | feelings | feel embarrassed | B1 | Context estimate | Cảm thấy ngượng ngùng vì chuyện vừa xảy ra |
| 84 | feelings | feel stressed | B1 | Context estimate | Cảm thấy căng thẳng vì áp lực |
| 85 | feelings | feel jealous | B1 | Context estimate | Cảm thấy ghen tị khi người khác có thứ mình muốn |
| 86 | feelings | feel overwhelmed | B2 | Context estimate | Cảm thấy quá tải vì quá nhiều cảm xúc hoặc việc |
| 87 | feelings | cheer someone up | B1 | Context estimate | Làm một người đang buồn vui vẻ trở lại |
| 88 | feelings | listen without judging | B2 | Context estimate | Lắng nghe tâm sự mà không phán xét người nói |
| 89 | feelings | offer support | B1 | Context estimate | Chủ động ngỏ ý hỗ trợ khi người khác khó khăn |
| 90 | feelings | show empathy | B2 | Context estimate | Thể hiện sự thấu cảm với cảm xúc người khác |
| 91 | feelings | reassure someone | B2 | Context estimate | Trấn an để ai đó bớt lo sợ |
| 92 | feelings | encourage a friend | B1 | Context estimate | Động viên bạn bè tiếp tục cố gắng |
| 93 | feelings | apologise sincerely | B2 | Context estimate | Xin lỗi một cách chân thành |
| 94 | feelings | forgive someone | B1 | Context estimate | Tha thứ cho ai sau lỗi lầm của họ |
| 95 | feelings | make up after an argument | B2 | Context estimate | Làm hòa với nhau sau một cuộc cãi vã |
| 96 | feelings | talk things through | B2 | Context estimate | Cùng trao đổi thẳng thắn để giải quyết một vấn đề |
| 97 | feelings | give someone space | B2 | Context estimate | Để ai có thời gian và khoảng riêng khi cần |
| 98 | feelings | be there for someone | B1 | Context estimate | Luôn ở bên hỗ trợ ai vào lúc họ cần |
| 99 | feelings | share your feelings | A2 | Context estimate | Chia sẻ cảm xúc thật của mình với người khác |
| 100 | feelings | ask for help | A2 | Context estimate | Chủ động đề nghị người khác giúp đỡ |
