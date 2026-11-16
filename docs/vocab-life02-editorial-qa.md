# LIFE-02 — Giao tiếp hằng ngày (100 editorial candidates)

**Editorial state:** `DRAFT` and **100/100 `PROVISIONAL`**. No Production data import, reviewer authentication, topic creation, Admin permissions, gameplay availability, CEFR `APPROVED`, account SRS update or Vercel deployment.

## Dependencies / merge order

This branch follows **PR #85 (roadmap foundation)** and **PR #86 (LIFE-01)**. Both are still awaiting merge at authoring time. LIFE-02 contains a new proposed topic not yet present in the active 26-topic seed. Merging JSON alone does **not** create a new topic.

## Scope

| Editorial group | Count | Sample phrases |
|---|---:|---|
| Giới thiệu và làm quen | 25 | Nice to meet you, Pleased to meet you, May I introduce myself, What should I call you, Where are you from |
| Hỏi thăm và đáp lời | 25 | How are you doing, How have you been, How is your day going, How was your weekend, How was your trip |
| Chuyện phiếm và duy trì hội thoại | 25 | What is the weather like, It is getting warmer, It is a lovely day, It is raining again, Do you come here often |
| Nhờ giúp đỡ và phép lịch sự | 25 | Could you help me, please, Can you give me a hand, Would you mind helping me, May I ask a question, Could you repeat that, please |

Each row includes the complete practical English expression (canonical typing string, without terminal punctuation), UK-leaning **draft** IPA, context-specific Vietnamese cue, an original English example and Vietnamese translation, part of speech/function, proposed CEFR, source link, evidence type and editorial caveat.

**Duplication checks:** zero duplicate English phrases or identical Vietnamese cues against 280 public seed words, 117 previously provisional CEFR words, LIFE-01's 100 proposals, and within LIFE-02. This **does not** establish uniqueness against live Production PostgreSQL or its private per-user vocabulary.

## Evidence and academic limits

### Verified educational reference pages
- [British Council LearnEnglish — Meeting new people, A1](https://learnenglish.britishcouncil.org/free-resources/speaking/a1/meeting-new-people)
- [British Council LearnEnglish — Talking about where you're from, A1](https://learnenglish.britishcouncil.org/free-resources/speaking/a1/talking-about-where-youre)
- [British Council LearnEnglish — Showing interest, A2](https://learnenglish.britishcouncil.org/free-resources/speaking/a2/showing-interest)
- [British Council LearnEnglish — A2 speaking programme](https://learnenglish.britishcouncil.org/free-resources/speaking/a2)
- [Cambridge English Grammar Today — Requests](https://dictionary.cambridge.org/grammar/british-grammar/requests)

These pages support the **communication functions and teaching contexts**. They do not individually certify the CEFR of every one of these 100 WordSky editorial phrases. The dataset therefore uses `cefr_evidence_kind=contextual_inference` and `cefr_source_label=null` **for all 100 entries**. No record falsely claims a dictionary-assigned individual CEFR level. Each proposed grade may change after independent source review.

**Provisional level counts** (instructional estimates, not certified distribution):

| A1 | A2 | B1 | B2 | Total |
|---:|---:|---:|---:|---:|
| 30 | 49 | 19 | 2 | 100 |

### Content and recall-specific caveats

- Many legitimate Vietnamese paraphrases map to the same English idea (e.g., `Nice to meet you`, `Pleased to meet you`). Literal nonmatching Vietnamese strings do not guarantee semantic unambiguity.
- Conversational phrases have contractions, punctuation and alternate spellings (e.g., `I am` vs `I'm`, `Let us` vs `Let's`). **Do not activate strict `gradeRecall()` for these as single-answer SRS prompts**, or count a plausible alternative answer as wrong, until the UX QA-S1 ambiguity/alternatives policy and human verification exist.
- IPA is an editorial draft and should be checked for natural connected speech, variants, punctuation and regional usage.
- Sources are URL-syntactically checked and verified as relevant learning pages; the per-expression **meaning, IPA, examples and CEFR estimates have not been independently certified by a bilingual reviewer**. Human editorial judgment is essential.
- Source and translations are original annotations rather than long quotations from British Council/Cambridge materials.

## New topic proposal (no database creation)

Proposed display name: **Everyday Conversation - Giao tiếp hằng ngày**.

Existing categories are `Greetings - Chào hỏi`, `Daily Life` and `Feelings - Cảm xúc`. The new topic is intended for **multiword social language and conversational responses**, rather than individual greeting words, objects, or emotions. Before activation: confirm naming, Admin browse/filters, consistent route navigation and category counts, and how anonymous guests see the topic.

Topic activation or insertion must happen in an independently approved workflow with an isolated Preview database and rollback. The existing CEFR importer deliberately permits only enabled topics already present in the 26-topic seed; this content PR leaves that safety rule untouched.

## QA and release checklist

1. `npm run vocab:plan` automatically validates **both** LIFE-01 and LIFE-02, 100 candidates each, 25 per group and zero collisions across public seed/CEFR drafts/batches.
2. `npm run check && npm test` plus isolated PostgreSQL17 and Chromium/Firefox browser SRS E2E green on exact branch SHA.
3. Independent bilingual review of all 100 phrases, IPA and authentic context; especially intertranslatable prompts, contracted alternatives and advanced B1–B2 cases.
4. Independent topic approval and local/Preview-only dry-run before any DB changes. Import only `APPROVED` items with trusted reviewer metadata and identity.
5. Production catalogue deduplication/backup, preview QA, user approval and rehearsed rollback before any later release.

No user data or Production secrets are needed or read in this PR.

## Review inventory (100 items)

| # | Group | English expression | Proposed CEFR | Vietnamese cue |
|---:|---|---|---|---|
| 001 | introductions | Nice to meet you | A1 | Rất vui được gặp bạn lần đầu |
| 002 | introductions | Pleased to meet you | A2 | Hân hạnh được làm quen với bạn |
| 003 | introductions | May I introduce myself | B1 | Cho phép tôi tự giới thiệu |
| 004 | introductions | What should I call you | A2 | Tôi nên xưng hô với bạn thế nào |
| 005 | introductions | Where are you from | A1 | Bạn đến từ quốc gia hoặc nơi nào |
| 006 | introductions | I am from Vietnam | A1 | Tôi đến từ Việt Nam |
| 007 | introductions | Where do you live | A1 | Bạn đang sinh sống ở đâu |
| 008 | introductions | I live nearby | A2 | Tôi sống ở khu vực gần đây |
| 009 | introductions | I just moved here | A2 | Tôi vừa chuyển đến khu này |
| 010 | introductions | This is my friend | A1 | Đây là người bạn của tôi |
| 011 | introductions | Meet my colleague | A2 | Hãy làm quen với đồng nghiệp của tôi |
| 012 | introductions | Let me introduce you | A2 | Để tôi giới thiệu bạn với mọi người |
| 013 | introductions | We have not met before | A2 | Trước đây chúng ta chưa từng gặp nhau |
| 014 | introductions | I have heard about you | B1 | Tôi đã nghe người khác nhắc đến bạn |
| 015 | introductions | It is good to see you | A2 | Thật vui khi được gặp lại bạn |
| 016 | introductions | Have we met before | A2 | Hình như trước đây chúng ta đã gặp nhau phải không |
| 017 | introductions | Are you new here | A1 | Bạn mới đến nơi này phải không |
| 018 | introductions | I am new here | A1 | Tôi là người mới ở đây |
| 019 | introductions | I work nearby | A2 | Chỗ làm của tôi ở gần đây |
| 020 | introductions | I study English | A1 | Tôi đang học tiếng Anh |
| 021 | introductions | What do you do | A1 | Bạn làm nghề gì để kiếm sống |
| 022 | introductions | What do you like doing | A1 | Bạn thích làm hoạt động gì |
| 023 | introductions | How do you know each other | B1 | Hai người quen biết nhau bằng cách nào |
| 024 | introductions | Welcome to our group | A1 | Chào mừng bạn tham gia nhóm chúng tôi |
| 025 | introductions | Glad to be here | A2 | Tôi rất vui vì có mặt tại đây |
| 026 | checking-in | How are you doing | A1 | Dạo này bạn thế nào (hỏi thân mật) |
| 027 | checking-in | How have you been | A2 | Dạo này bạn có khỏe không sau thời gian không gặp |
| 028 | checking-in | How is your day going | A2 | Hôm nay mọi chuyện của bạn diễn ra thế nào |
| 029 | checking-in | How was your weekend | A1 | Cuối tuần vừa rồi của bạn thế nào |
| 030 | checking-in | How was your trip | A1 | Chuyến đi vừa rồi của bạn thế nào |
| 031 | checking-in | How is everything | A2 | Mọi việc của bạn có ổn không |
| 032 | checking-in | How are things at work | A2 | Công việc dạo này của bạn thế nào |
| 033 | checking-in | Are you feeling better | A2 | Bạn đã thấy đỡ mệt hơn chưa |
| 034 | checking-in | Are you doing okay | A1 | Bạn có đang ổn không |
| 035 | checking-in | Are you free to talk | A2 | Bây giờ bạn có rảnh để trò chuyện không |
| 036 | checking-in | Is everything all right | A2 | Mọi chuyện vẫn ổn cả chứ |
| 037 | checking-in | What have you been up to | B1 | Gần đây bạn bận làm những việc gì |
| 038 | checking-in | What have you been doing lately | B1 | Dạo gần đây bạn thường làm gì |
| 039 | checking-in | How is your family | A1 | Gia đình bạn dạo này có khỏe không |
| 040 | checking-in | How did it go | A2 | Việc đó đã diễn ra thế nào |
| 041 | checking-in | That sounds great | A1 | Nghe có vẻ tuyệt đấy |
| 042 | checking-in | That sounds difficult | A2 | Nghe có vẻ khó khăn thật |
| 043 | checking-in | I am doing well | A1 | Mọi việc của tôi đang khá tốt |
| 044 | checking-in | I have been busy | A2 | Dạo này tôi khá bận rộn |
| 045 | checking-in | I feel a bit tired | A1 | Tôi cảm thấy hơi mệt |
| 046 | checking-in | Not too bad | A2 | Cũng khá ổn (trả lời khi được hỏi thăm) |
| 047 | checking-in | Could be better | B1 | Có thể tốt hơn (mọi việc chưa được như ý) |
| 048 | checking-in | Thanks for asking | A2 | Cảm ơn vì đã hỏi thăm tôi |
| 049 | checking-in | I appreciate your concern | B2 | Tôi trân trọng sự quan tâm của bạn |
| 050 | checking-in | I hope you feel better | A2 | Mong bạn sớm cảm thấy khá hơn |
| 051 | small-talk | What is the weather like | A1 | Thời tiết ở đây như thế nào |
| 052 | small-talk | It is getting warmer | A2 | Trời đang dần ấm hơn |
| 053 | small-talk | It is a lovely day | A1 | Hôm nay là một ngày thời tiết đẹp |
| 054 | small-talk | It is raining again | A1 | Trời lại đang mưa nữa rồi |
| 055 | small-talk | Do you come here often | A2 | Bạn có thường đến chỗ này không |
| 056 | small-talk | Is this your first time here | A2 | Đây có phải lần đầu bạn đến đây không |
| 057 | small-talk | Do you have any plans for the weekend | A2 | Cuối tuần này bạn đã có kế hoạch gì chưa |
| 058 | small-talk | What do you do in your free time | A1 | Khi rảnh bạn thường làm gì |
| 059 | small-talk | Are you into music | B1 | Bạn có hứng thú với âm nhạc không |
| 060 | small-talk | What kind of movies do you like | A2 | Bạn thích thể loại phim nào |
| 061 | small-talk | Have you seen this show | A2 | Bạn đã xem chương trình này chưa |
| 062 | small-talk | I just started watching it | A2 | Tôi vừa bắt đầu xem chương trình đó |
| 063 | small-talk | That reminds me of something | B1 | Điều đó khiến tôi nhớ tới một chuyện khác |
| 064 | small-talk | Speaking of that | B1 | Nhân tiện đang nói tới chuyện đó |
| 065 | small-talk | By the way | A2 | À nhân tiện tôi muốn nói thêm |
| 066 | small-talk | What about you | A1 | Còn bạn thì sao (hỏi ngược lại) |
| 067 | small-talk | I see what you mean | B1 | Tôi hiểu ý bạn đang nói |
| 068 | small-talk | That is interesting | A1 | Nghe chuyện đó thật thú vị |
| 069 | small-talk | Really, tell me more | A2 | Thật sao kể tôi nghe thêm đi |
| 070 | small-talk | No way | A2 | Không thể tin nổi (thể hiện ngạc nhiên) |
| 071 | small-talk | I had no idea | B1 | Tôi hoàn toàn không biết chuyện đó |
| 072 | small-talk | I guess so | A2 | Tôi đoán là đúng vậy |
| 073 | small-talk | Me too | A1 | Tôi cũng vậy (đáp lời khẳng định) |
| 074 | small-talk | Neither do I | B1 | Tôi cũng không (đáp lời phủ định) |
| 075 | small-talk | Let us keep in touch | A2 | Chúng ta hãy giữ liên lạc nhé |
| 076 | requests | Could you help me, please | A2 | Bạn có thể giúp tôi được không (cách hỏi lịch sự) |
| 077 | requests | Can you give me a hand | A2 | Bạn có thể phụ tôi một tay không |
| 078 | requests | Would you mind helping me | B1 | Bạn có phiền nếu giúp tôi không |
| 079 | requests | May I ask a question | A2 | Tôi xin phép hỏi một câu được không |
| 080 | requests | Could you repeat that, please | A2 | Bạn vui lòng nói lại câu vừa rồi được không |
| 081 | requests | Could you speak more slowly | A2 | Bạn vui lòng nói chậm hơn được không |
| 082 | requests | Could you write it down | A2 | Bạn có thể viết thông tin đó ra giấy không |
| 083 | requests | Can I borrow your pen | A1 | Tôi có thể mượn bút của bạn không |
| 084 | requests | Would it be okay if I sat here | B1 | Tôi ngồi ở đây thì có được không |
| 085 | requests | Do you mind if I open the window | B1 | Bạn có phiền nếu tôi mở cửa sổ không |
| 086 | requests | Could you show me how | A2 | Bạn có thể hướng dẫn tôi cách làm không |
| 087 | requests | Could you send me the details | B1 | Bạn có thể gửi thông tin chi tiết cho tôi không |
| 088 | requests | Could you wait a moment | A2 | Bạn có thể đợi một chút được không |
| 089 | requests | Please let me know | A2 | Xin hãy báo cho tôi biết khi có tin |
| 090 | requests | I would appreciate your help | B2 | Tôi sẽ rất biết ơn nếu được bạn giúp đỡ |
| 091 | requests | Thank you very much | A1 | Tôi cảm ơn bạn rất nhiều |
| 092 | requests | Thanks a lot | A1 | Cảm ơn bạn nhiều nhé |
| 093 | requests | You are welcome | A1 | Không có gì đâu (đáp lại lời cảm ơn) |
| 094 | requests | No problem at all | A2 | Hoàn toàn không có vấn đề gì |
| 095 | requests | That is very kind of you | A2 | Bạn thật tốt bụng khi giúp tôi |
| 096 | requests | Sorry to bother you | B1 | Xin lỗi vì đã làm phiền bạn |
| 097 | requests | Excuse me for a moment | A2 | Xin phép cho tôi ra ngoài một lát |
| 098 | requests | I did not mean to interrupt | B1 | Tôi không cố ý chen ngang lời bạn |
| 099 | requests | Can I get back to you | B1 | Tôi có thể phản hồi lại bạn sau không |
| 100 | requests | Let me check first | A2 | Để tôi kiểm tra trước đã |
