# English Street — Game học tiếng Anh đa người chơi trên con phố 3D

## 1. Bối cảnh (Context)

Người dùng muốn một game học tiếng Anh theo kiểu "nhập vai đời thường": người chơi hoá thân thành nhân vật, đi dạo trên một con phố có đầy đủ cửa hàng và nghề nghiệp như ngoài đời (quán cà phê, hiệu thuốc, ngân hàng, bưu điện, phòng khám…). Mỗi gian hàng do một NPC vận hành. Nhiều người chơi cùng online trên một con phố, nói chuyện với NPC và với nhau bằng tiếng Anh.

Mục tiêu học tập: luyện giao tiếp theo **tình huống thực tế** (gọi món, hỏi đường, phỏng vấn, khám bệnh…) thay vì học từ vựng rời rạc. Người học được NPC phản hồi tự nhiên, được sửa lỗi nhẹ nhàng, và có động lực tiến bộ qua nhiệm vụ/điểm/trang bị.

Thư mục `/root/session_manager_workspaces/english-street/` hiện **trống** — đây là dự án greenfield.

Quyết định đã chốt với người dùng:
| Hạng mục | Lựa chọn |
|---|---|
| Nền tảng | Web (trình duyệt) |
| Đồ hoạ | 3D low-poly |
| Giao tiếp | Text + giọng nói (STT/TTS) |
| NPC AI | LLM (Claude) + kịch bản nhiệm vụ, có chấm điểm & sửa lỗi |

---

## 2. Thiết kế game (Game Design)

### 2.1 Vòng lặp cốt lõi (core loop)
1. Người chơi xuất hiện trên phố → chọn nhiệm vụ từ bảng tin (Quest Board) hoặc tự do khám phá.
2. Đi tới cửa hàng → tương tác với NPC → hội thoại tiếng Anh (gõ hoặc nói) để hoàn thành mục tiêu (vd: "Mua 2 cà phê và hỏi giờ đóng cửa").
3. NPC phản hồi theo persona + vai trò; hệ thống chấm: hoàn thành mục tiêu? ngữ pháp? từ vựng? phát âm (nếu dùng voice)?
4. Nhận XP, tiền (coins), mở khoá nhiệm vụ/khu vực/trang phục mới.
5. Gặp người chơi khác → chat/voice tiếng Anh, làm nhiệm vụ nhóm (vd: cùng đặt bàn nhà hàng, một người là khách một người là nhân viên).

### 2.2 Con phố và các gian hàng (MVP: 8 NPC, mở rộng dần)
| Gian hàng | NPC / nghề | Chủ đề giao tiếp | CEFR gợi ý |
|---|---|---|---|
| Café | Barista | Gọi món, thanh toán, yêu cầu đặc biệt | A1–A2 |
| Cửa hàng tiện lợi | Nhân viên thu ngân | Hỏi giá, hỏi vị trí hàng, đổi trả | A1–A2 |
| Bưu điện | Nhân viên bưu điện | Gửi thư/bưu kiện, điền form | A2 |
| Phòng khám | Bác sĩ / Lễ tân | Mô tả triệu chứng, đặt lịch | A2–B1 |
| Ngân hàng | Giao dịch viên | Mở tài khoản, chuyển tiền, khiếu nại | B1 |
| Quầy thông tin du lịch | Hướng dẫn viên | Hỏi đường, gợi ý địa điểm | A2 |
| Văn phòng tuyển dụng | HR | Phỏng vấn xin việc, giới thiệu bản thân | B1–B2 |
| Công viên | Người qua đường (NPC xã giao) | Small talk, thời tiết, sở thích | A1–B2 |

Mở rộng sau: nhà hàng, khách sạn, hiệu thuốc, tiệm cắt tóc, trường học, đồn cảnh sát, sân bay…

### 2.3 Hệ thống nhiệm vụ (Quest)
- **Quest = kịch bản có mục tiêu đo được**, lưu dưới dạng JSON/YAML, ví dụ:
  ```yaml
  id: cafe-order-01
  npc: barista
  level: A2
  title: "Morning Coffee"
  goals:
    - id: greet      ; desc: "Greet the barista"
    - id: order      ; desc: "Order a latte and a croissant"
    - id: ask_price  ; desc: "Ask how much it costs"
    - id: pay        ; desc: "Pay and say goodbye"
  target_vocab: [latte, croissant, receipt, "to go"]
  target_phrases: ["Could I have…", "How much is…"]
  max_turns: 12
  ```
- LLM đóng vai NPC nhưng nhận `goals` trong system prompt; sau mỗi lượt, LLM trả **structured output** gồm: câu thoại NPC + danh sách goal vừa đạt + nhận xét lỗi (nếu có).
- Quest kết thúc khi đủ goal hoặc hết lượt → màn hình tổng kết: điểm, lỗi đã sửa, từ mới, gợi ý câu hay hơn.

### 2.4 Hệ thống học tập
- **Trình độ CEFR** (A1→C1) gán cho người chơi; NPC điều chỉnh độ khó câu trả lời theo trình độ (độ dài câu, từ vựng).
- **Sửa lỗi "mềm"**: NPC không ngắt lời; lỗi hiển thị dưới dạng gợi ý nhỏ cạnh câu của người chơi ("💡 *I would like* a coffee"). Có nút "Explain" để xem giải thích.
- **Sổ tay (Notebook)**: tự động lưu từ/cụm từ mới gặp, hỗ trợ ôn tập dạng flashcard (spaced repetition đơn giản).
- **Phát âm**: dùng STT transcript so với câu dự kiến → điểm phát âm sơ bộ; giai đoạn sau có thể dùng dịch vụ chấm phát âm chuyên dụng.
- **Tiến trình**: XP, level, streak hàng ngày, huy hiệu theo chủ đề ("Café Regular", "Job Hunter").

### 2.5 Đa người chơi
- Tất cả người chơi trong cùng **room** (một con phố, tối đa ~50 người/room, tự động tạo room mới khi đầy).
- Thấy nhau di chuyển, tên trên đầu, emote.
- **Chat gần (proximity chat)**: text bubble + voice chat (WebRTC) chỉ nghe được người trong bán kính N mét.
- **Nhiệm vụ cặp đôi**: 2 người nhận 2 vai (khách – nhân viên) trong một gian hàng; NPC đóng vai "giám khảo" đánh giá cả hai.
- Lọc nội dung chat (profanity filter) + nút report.

### 2.6 Nhân vật
- Avatar low-poly tuỳ biến: giới tính, màu da, tóc, trang phục (mở khoá bằng coins).
- Điều khiển: WASD/phím mũi tên + chuột (PC); joystick ảo (mobile web).

---

## 3. Kiến trúc kỹ thuật

### 3.1 Tech stack (đề xuất)
| Tầng | Công nghệ | Lý do |
|---|---|---|
| Client 3D | **Three.js + React Three Fiber (R3F)** + TypeScript + Vite | Hệ sinh thái web lớn nhất, low-poly chạy tốt, R3F giúp quản lý scene theo component; UI (HUD, chat, quest) dùng React thường |
| UI | React + Tailwind CSS + Zustand (state) | Nhanh, nhẹ |
| Multiplayer | **Colyseus** (Node.js, WebSocket) | Room-based, state sync tự động, đã dùng rộng cho game web |
| Backend API | Node.js + **Fastify** + TypeScript | Chung ngôn ngữ với client; nhanh |
| NPC AI | **Claude API** qua `@anthropic-ai/sdk` — model mặc định `claude-opus-5-5`, streaming, structured output | Chất lượng hội thoại + sửa lỗi; có thể hạ xuống `claude-sonnet-5-5`/`claude-haiku-5-5` cho NPC small-talk để giảm chi phí (quyết định của bạn) |
| STT | Web Speech API (miễn phí, Chrome/Edge) → fallback **Deepgram/Whisper API** | MVP không tốn phí; nâng cấp khi cần độ chính xác |
| TTS | Web SpeechSynthesis (miễn phí) → nâng cấp **ElevenLabs / OpenAI TTS** cho giọng NPC riêng | Tương tự |
| Voice chat P2P | WebRTC qua **LiveKit** (self-host hoặc cloud) | Proximity audio, có SDK web sẵn |
| DB | **PostgreSQL** (Prisma ORM) + **Redis** (session, rate-limit, cache) | Chuẩn, dễ host |
| Auth | Email/password + Google OAuth (Lucia hoặc Auth.js) | Đơn giản cho MVP |
| Asset 3D | **Kenney.nl** (CC0 low-poly city/characters), Quaternius, Poly Pizza; format glTF/GLB | Miễn phí, đồng bộ phong cách |
| Hạ tầng | Docker Compose (dev) → Fly.io/Railway/VPS (prod); client tĩnh lên Cloudflare Pages/Vercel | Rẻ, đủ cho MVP |

### 3.2 Sơ đồ hệ thống
```
Browser (R3F client)
  ├─ WebSocket ──► Colyseus Game Server  (vị trí, animation, chat bubble, quest state)
  ├─ HTTPS ──────► Fastify API Server    (auth, profile, quest list, progress, notebook)
  │                   └─► Claude API (NPC dialogue, grading)   ← có cache persona/quest prompt
  │                   └─► STT/TTS provider (fallback)
  └─ WebRTC ─────► LiveKit (proximity voice)

PostgreSQL ◄─── API + Game Server         Redis ◄─── session / rate limit / NPC conv cache
```

### 3.3 Cấu trúc monorepo (pnpm workspaces + Turborepo)
```
english-street/
├─ apps/
│  ├─ web/            # React + R3F client (Vite)
│  ├─ api/            # Fastify REST + Claude integration
│  └─ game-server/    # Colyseus rooms
├─ packages/
│  ├─ shared/         # types, zod schemas, quest schema, constants
│  ├─ quests/         # YAML/JSON quest + NPC persona content
│  └─ ui/             # shared React components (optional, sau)
├─ assets/            # GLB models, textures, audio (git-lfs)
├─ infra/             # docker-compose.yml, Dockerfiles, deploy scripts
├─ docs/              # GDD, prompt design, API docs
├─ package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json
└─ .env.example
```

### 3.4 Thiết kế NPC AI (phần quan trọng nhất)

**Luồng một lượt hội thoại**
1. Client gửi `{npcId, questId, text | audioTranscript}` lên API (`POST /npc/:id/chat`).
2. API lấy lịch sử hội thoại từ Redis (key `conv:{userId}:{npcId}`), ghép system prompt:
   - Persona NPC (tên, tính cách, giọng điệu, kiến thức về cửa hàng, menu/giá).
   - Quest goals + trạng thái goal đã đạt.
   - CEFR level của người chơi → quy tắc độ khó.
   - Quy tắc sư phạm: luôn ở trong vai, không dịch sang tiếng Việt trừ khi người chơi bế tắc 2 lượt, sửa lỗi qua trường riêng chứ không phá vai.
3. Gọi Claude với **structured output** (`output_config.format` + zod schema), streaming:
   ```ts
   {
     reply: string,                 // câu NPC nói
     emotion: "neutral"|"happy"|"confused"|"annoyed",   // → animation
     goals_completed: string[],     // goal id vừa đạt trong lượt này
     corrections: [{ original, corrected, explanation_vi, type }],
     new_vocab: [{ word, meaning_vi, example }],
     hint?: string                  // gợi ý nếu người chơi im/bế tắc
   }
   ```
4. API lưu lịch sử, cập nhật quest progress (Postgres), trả JSON về client.
5. Client: hiện bubble + TTS đọc `reply`, NPC chơi animation theo `emotion`, cập nhật checklist goal, hiện correction nhỏ.

**Tối ưu chi phí & độ trễ**
- Prompt caching: persona + quest + quy tắc đặt đầu system prompt với `cache_control`; lịch sử ở sau.
- Giới hạn lịch sử ~20 lượt/quest; tổng kết quest là 1 call riêng (grading).
- Rate limit: N lượt NPC/phút/người (Redis), hạn mức ngày cho tài khoản free.
- Dùng `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) để tránh lỗi refusal làm đứt hội thoại.
- NPC xã giao (công viên) có thể dùng model rẻ hơn; NPC quest dùng Opus 5.5.

**Guardrail**
- Người chơi gõ tiếng Việt → NPC trả lời tiếng Anh đơn giản + hint "Try saying it in English: …".
- Lọc nội dung đầu vào (profanity, prompt-injection cơ bản: không cho đổi vai NPC).

### 3.5 Multiplayer (Colyseus)
- `StreetRoom` state: `players: Map<sessionId, {id, name, x, y, z, rot, anim, avatar}>`, `bubbles` (chat gần, TTL 5 s).
- Client gửi input 20 Hz; server authoritative về vị trí (anti-cheat nhẹ), interpolation phía client.
- Va chạm đơn giản: navmesh/grid 2D trên mặt đường (không cần physics engine đầy đủ).
- Quest cặp đôi: `PairQuestRoom` con, spawn khi 2 người cùng bấm "Start together" ở NPC.

### 3.6 Dữ liệu (Prisma schema rút gọn)
- `User` (id, email, name, cefrLevel, xp, coins, streak, avatarConfig JSON)
- `Quest` (id, npcId, level, title, goals JSON, vocab JSON) — seed từ `packages/quests`
- `QuestAttempt` (userId, questId, status, score, transcript JSON, corrections JSON, startedAt, finishedAt)
- `VocabEntry` (userId, word, meaning, example, nextReviewAt, ease)
- `Friendship`, `Report` (cho social/moderation — giai đoạn sau)

---

## 4. Kế hoạch triển khai theo giai đoạn

### Giai đoạn 0 — Khởi tạo (1 tuần)
- Tạo monorepo pnpm + Turborepo, tsconfig, ESLint/Prettier, Docker Compose (Postgres, Redis).
- `apps/web`: Vite + React + R3F, scene trống với mặt đất + camera + ánh sáng.
- `apps/api`: Fastify hello world + Prisma migrate.
- `apps/game-server`: Colyseus room rỗng, client kết nối được.
- `packages/shared`: zod schema cho Player, Quest, NpcTurnResponse.
- CI: GitHub Actions lint + typecheck + build.

### Giai đoạn 1 — Con phố & di chuyển (2 tuần)
- Import tileset Kenney City Kit (GLB), dựng 1 con phố ~8 toà nhà bằng file layout JSON.
- Nhân vật low-poly có animation idle/walk/run (Mixamo hoặc Kenney characters).
- Điều khiển WASD + camera third-person; joystick ảo mobile.
- Đồng bộ vị trí qua Colyseus, hiển thị người chơi khác + tên.
- Trigger zone trước mỗi cửa hàng → prompt "Press E to talk".

### Giai đoạn 2 — NPC hội thoại text (2 tuần)
- Persona 3 NPC đầu (Barista, Cashier, Info Desk) + 6 quest A1–A2 trong `packages/quests`.
- `POST /npc/:id/chat` với Claude structured output, Redis conversation cache, prompt caching.
- UI hội thoại: khung chat, checklist goal, correction tooltip, màn hình tổng kết quest.
- Lưu `QuestAttempt`, XP/coins.
- Test prompt: bộ 20 hội thoại mẫu, kiểm tra NPC giữ vai + chấm goal đúng.

### Giai đoạn 3 — Giọng nói (1–2 tuần)
- STT: Web Speech API (push-to-talk, hiển thị transcript tạm thời) + fallback gửi audio lên API → Deepgram.
- TTS: SpeechSynthesis với voice theo NPC; nút phát lại; tuỳ chọn tắt.
- Lip-sync đơn giản: NPC chơi animation "talk" khi TTS đang phát.

### Giai đoạn 4 — Người chơi tương tác với nhau (2 tuần)
- Proximity text chat (bubble), emote.
- Voice chat WebRTC qua LiveKit, bật/tắt theo khoảng cách.
- Quest cặp đôi đầu tiên (nhà hàng: khách – phục vụ) với NPC giám khảo.
- Profanity filter + report.

### Giai đoạn 5 — Tiến trình & nội dung (2–3 tuần)
- Auth (email + Google), profile, chọn trình độ CEFR ban đầu (bài test ngắn 10 câu).
- Notebook từ vựng + flashcard ôn tập.
- Avatar customization, shop trang phục (coins).
- Mở rộng lên 8 NPC / ~30 quest; bảng tin nhiệm vụ hàng ngày; streak, huy hiệu.

### Giai đoạn 6 — Hoàn thiện & phát hành beta (2 tuần)
- Tối ưu hiệu năng (instancing, LOD, lazy-load GLB, giới hạn draw calls < 300).
- Tối ưu chi phí LLM: đo token/lượt, chọn model theo loại NPC, hạn mức tài khoản.
- Deploy: client → Cloudflare Pages; api + game-server → Fly.io/Railway; LiveKit cloud.
- Analytics cơ bản (PostHog): quest hoàn thành, thời gian chơi, lỗi phổ biến.
- Beta kín 20–50 người, thu phản hồi.

**Tổng ước lượng MVP (hết giai đoạn 3): ~6–7 tuần; bản beta đầy đủ: ~12–14 tuần** (1 dev full-time; nhanh hơn nếu có người làm nội dung quest song song).

---

## 5. Rủi ro & biện pháp
| Rủi ro | Biện pháp |
|---|---|
| Chi phí Claude API tăng theo số người chơi | Prompt caching, giới hạn lượt/ngày, model rẻ cho NPC phụ, quest ngắn (≤12 lượt) |
| STT trình duyệt không chính xác với accent Việt | Luôn cho sửa transcript trước khi gửi; fallback Deepgram |
| 3D nặng trên máy yếu / mobile | Low-poly, texture atlas, LOD, chế độ "low graphics" |
| NPC phá vai / nói tiếng Việt quá nhiều | Quy tắc trong system prompt + bộ test hội thoại tự động |
| Nội dung độc hại giữa người chơi | Filter + report + mute; voice chat opt-in |
| Thiếu nội dung quest | Định dạng YAML đơn giản, có thể dùng Claude sinh nháp quest rồi người duyệt |

---

## 6. Việc cần bạn quyết định tiếp (không chặn giai đoạn 0–1)
1. Tên game (tạm: **English Street**).
2. Có cần tiếng Việt trong UI/giải thích lỗi không? (kế hoạch hiện tại: UI song ngữ, giải thích lỗi bằng tiếng Việt).
3. Mô hình kinh doanh: free + hạn mức, hay subscription? (ảnh hưởng hạn mức LLM).
4. Model NPC: Opus 5.5 toàn bộ (chất lượng cao, đắt) hay chia Opus/Sonnet/Haiku theo loại NPC.

---

## 7. Kiểm chứng (Verification)
- **Giai đoạn 0**: `pnpm install && pnpm dev` chạy được 3 app; `docker compose up` có Postgres/Redis; CI xanh.
- **Giai đoạn 1**: mở 2 tab trình duyệt, thấy nhau di chuyển với độ trễ < 200 ms trên LAN; FPS ≥ 50 trên laptop tầm trung.
- **Giai đoạn 2**: chạy script `pnpm test:npc` với 20 kịch bản → NPC trả JSON hợp lệ 100%, chấm đúng goal ≥ 90%; người thật chơi 6 quest hoàn chỉnh không lỗi.
- **Giai đoạn 3**: nói 10 câu mẫu, transcript đúng ≥ 80% (Chrome); TTS phát và animation khớp.
- **Giai đoạn 4**: 2 người gần nhau nghe được nhau, đi xa thì tắt; quest cặp đôi hoàn thành và cả hai nhận điểm.
- **Giai đoạn 6**: load test 50 người/room bằng bot Colyseus; chi phí LLM đo được ≤ ngưỡng đặt ra (vd. < $0.05/quest với Opus 5.5 có cache).

## 8. Tiến độ

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| 0 — Khởi tạo | ✅ Xong (2026-11-03) | Monorepo pnpm + Turborepo, 3 app skeleton (web R3F, api Fastify+Prisma, game-server Colyseus), `packages/shared` + `packages/quests` (3 NPC, 6 quest), Docker Compose, CI. Typecheck/build xanh; test 2 client đồng bộ vị trí + chat gần đạt. |
| 1 — Con phố & di chuyển | ✅ Xong (2026-11-03) | Phố dựng từ Kenney City Builder (CC0) theo layout tile 4 m, 7 cửa hàng có biển tên, nhân vật RobotExpressive có animation idle/walk/run/wave, va chạm với toà nhà, camera góc 3, joystick mobile, NPC đứng trước cửa hàng + prompt "Press E to talk" mở panel chào + danh sách quest. Đã kiểm chứng bằng Chromium headless (ảnh trong docs/screenshots). |
| 2 — NPC hội thoại text | 🔜 Tiếp theo | Endpoint `POST /npc/:id/chat` với Claude structured output, Redis conversation, UI chat + checklist goal + correction, lưu QuestAttempt. |
| 3 — Giọng nói | ⏳ | |
| 4 — Người chơi tương tác | ⏳ | |
| 5 — Tiến trình & nội dung | ⏳ | |
| 6 — Hoàn thiện & beta | ⏳ | |

**Lưu ý kỹ thuật đã rút ra ở giai đoạn 0**
- Colyseus 0.18 đi với client `@colyseus/sdk` (schema v5); `colyseus.js` 0.16 không tương thích.
- Không gắn request handler tuỳ ý vào http server của Colyseus (che route `/matchmake`).
- `api` và `game-server` chạy bằng `tsx` cả dev lẫn prod; `pnpm build` của chúng chỉ typecheck.
- Máy dev hiện không có Docker/Postgres: API báo `db: down`, migration sinh bằng `prisma migrate diff`.

Mã nguồn: `/root/session_manager_workspaces/english-street/` (bản sao thiết kế tại `docs/GDD.md`).
