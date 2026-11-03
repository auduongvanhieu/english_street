# English Street

Game học tiếng Anh đa người chơi: người chơi đi dạo trên một con phố 3D low-poly,
trò chuyện bằng tiếng Anh (gõ hoặc nói) với các NPC chủ cửa hàng và với người chơi khác.

Thiết kế đầy đủ: [docs/GDD.md](docs/GDD.md).

![Phố English Street](docs/screenshots/phase1-street.png)

**Điều khiển:** WASD / mũi tên di chuyển · Shift chạy · E nói chuyện với NPC · Enter mở chat · Esc đóng.
Trong hội thoại: nhấn giữ 🎤 để nói (Chrome/Edge/Safari), thả ra rồi sửa transcript nếu cần và Send; 🔊 phát lại câu NPC; nút loa ở header để tắt tiếng.
Với người chơi khác: phím 1-5 emote; nút "🎙️ Voice" bật voice chat gần (WebRTC P2P, nghe được trong ~8 m); ⚑ cạnh tin nhắn để report.
Quest cặp đôi: gặp Lucas ở Le Petit Bistro, chọn "Dinner for Two", mời một người chơi đang đứng gần; một người làm khách, một người làm phục vụ, Lucas chấm từng câu.

![Quest cặp đôi](docs/screenshots/phase4-pair-quest.png)
Trên mobile: joystick ảo góc trái, chạm nút "Tap to talk" khi đứng gần NPC.

Asset 3D (CC0): xem [apps/web/public/models/CREDITS.md](apps/web/public/models/CREDITS.md).

## Cấu trúc

```
apps/web          React + React Three Fiber client (Vite)
apps/api          Fastify REST API + Prisma + Claude (NPC AI)
apps/game-server  Colyseus realtime server (vị trí, chat gần)
packages/shared   Zod schemas + types dùng chung
packages/quests   Nội dung NPC persona + quest (YAML)
infra             docker-compose dev (Postgres, Redis) + Dockerfile, compose production, Caddy
docs              GDD, DEPLOY.md, ảnh chụp
```

## Chạy dev

```bash
cp .env.example .env            # điền ANTHROPIC_API_KEY
pnpm install
pnpm db:up                      # Postgres + Redis (cần Docker)
pnpm --filter @es/api prisma migrate dev
pnpm dev                        # web :5173, api :4000, game-server :2567
```

Các app Node (`api`, `game-server`) chạy trực tiếp TypeScript bằng `tsx` (cả dev lẫn prod);
`pnpm build` của chúng chỉ typecheck. Client web build bằng Vite ra `apps/web/dist`.

```bash
```

Không có Docker: API tự chuyển sang lưu trữ in-memory khi không kết nối được Postgres/Redis
(đủ để chơi thử, mất dữ liệu khi restart).

## NPC AI

NPC trò chuyện bằng Claude (`claude-opus-5-5`, structured output). Cần API key từ
https://platform.claude.com (tính phí theo token, **không** dùng được gói Claude Pro/Max của claude.ai).

| `NPC_PROVIDER` | Hành vi |
|---|---|
| `auto` (mặc định) | Dùng Claude nếu `ANTHROPIC_API_KEY` thật, ngược lại dùng mock |
| `claude` | Bắt buộc Claude, lỗi nếu thiếu key |
| `mock` | NPC giả lập cục bộ theo từ khoá, không tốn phí, dùng để dev/test UI |

Kiểm tra chất lượng hội thoại với 20 kịch bản mẫu (đúng goal, không nói tiếng Việt, có hint khi bí):

```bash
pnpm --filter @es/api eval:npc                      # provider theo .env
NPC_PROVIDER=claude pnpm --filter @es/api eval:npc  # chấm model thật
```

![Chat với NPC](docs/screenshots/phase2-chat.png)

### Chống đốt token

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `NPC_MODEL_BASIC` | `claude-haiku-5-5` | Model cho quest A1–A2 và chat tự do (B1+ dùng `NPC_MODEL`) |
| `NPC_DAILY_TURNS_PER_PLAYER` | 60 | Lượt NPC mỗi người mỗi ngày (theo IP: gấp 3) |
| `NPC_DAILY_BUDGET_USD` | 5 | Trần chi tiêu ước tính mỗi ngày cho cả hệ thống; chạm trần thì NPC nghỉ đến hôm sau |
| `NPC_HISTORY_MAX` | 10 | Số tin nhắn gần nhất gửi lên model |

Xem mức chi hôm nay: `GET /admin/budget` (header `authorization: Bearer $ADMIN_TOKEN`). Ngoài ra hãy đặt spend limit cho workspace trên console Anthropic.
Khi có Redis, các bộ đếm này dùng chung cho mọi instance API.

## Tài khoản và tiến trình

Chơi khách (tiến trình gắn với trình duyệt) hoặc đăng ký email + mật khẩu (tiến trình khách được chuyển sang tài khoản).
Sau khi vào: bài test 10 câu xếp trình độ CEFR, hồ sơ XP/level/coins/streak/huy hiệu, 3 quest ngày có thưởng thêm,
sổ tay từ vựng tự lưu từ hội thoại với ôn tập flashcard, và shop màu avatar. Đặt `AUTH_SECRET` thật trong `.env` khi deploy.

## Hiệu năng

- Tile phố vẽ bằng `InstancedMesh` (một draw call cho mỗi cặp model/mesh), nhà cửa hàng giữ màu riêng.
- Nút ⚙️ High/Low: Low tắt bóng, pixel ratio 1, không antialias, chỉ vẽ người chơi trong 28 m; mặc định Low trên thiết bị cảm ứng.
- Người chơi xa hơn 45 m không được vẽ, name tag chỉ trong 22 m; cảnh 3D chỉ tải sau màn đăng nhập.
- Đo trên Chromium headless (1280×720): High 391 draw call, Low 210 (trước giai đoạn 6: 567 / 249). `window.__esPerf` giữ mẫu FPS/draw call mới nhất.

![Chế độ Low](docs/screenshots/phase6-street-low.png)

## Analytics, góp ý, beta kín

- Mọi sự kiện quan trọng (vào phố, lượt NPC, quest bắt đầu/kết thúc, quest cặp đôi, voice, report, FPS) ghi vào bảng `Event`.
  Xem tổng hợp: `GET /admin/stats?days=7` với header `authorization: Bearer $ADMIN_TOKEN` (không đặt token: mở ở dev, đóng ở production).
- Nút 💬 Feedback trong game ghi vào bảng `Feedback` → `GET /admin/feedback`; report người chơi → `GET /admin/reports`.
- `BETA_CODES=ma1,ma2` bật beta kín: màn đăng nhập hỏi mã mời, mã hợp lệ đổi lấy pass 90 ngày; API và game-server đều kiểm tra.

![Cổng beta](docs/screenshots/phase6-beta-gate.png)

## Deploy

Một VPS + Docker Compose + Caddy (HTTPS tự động), xem [docs/DEPLOY.md](docs/DEPLOY.md):

```bash
cp .env.example .env   # AUTH_SECRET, ADMIN_TOKEN, POSTGRES_PASSWORD, domain, ANTHROPIC_API_KEY
docker compose --env-file .env -f infra/docker-compose.prod.yml up -d --build
```

Load test game-server: `BOTS=50 SECONDS=30 pnpm --filter @es/game-server load:bots` (50 bot: p95 45 ms, CPU 12 %).

## Mobile

The web client has a touch HUD (joystick, Talk button, bottom sheets, keyboard-safe inputs) and is installable
as a PWA (Add to Home Screen). See `docs/PERF.md` for the layout notes and draw-call budget.

## Settings, Vietnamese subtitles, IPA (Step 2 / phase 8)

- ⚙️ **Settings** sheet: Vietnamese subtitles (auto = on for A1–A2), IPA line, NPC voice + speed, voice chat,
  graphics quality, ambient volume. Stored in `localStorage` (`es:subs`, `es:ipa`, `es:ttsRate`, `es:ambient`).
- **Subtitles**: the chat request carries `subtitles: true`; the NPC structured output then fills `reply_vi`
  (same Claude call, measured at ≈ +0.0001 USD per turn on Haiku). Static text (greetings, nearby chat,
  single words) goes through `POST /translate`, a Haiku call cached in Redis for 30 days by text hash.
- **IPA**: `GET /dict/ipa?words=a,b` from CMUdict (BSD, `apps/api/data/cmudict.dict.gz`, US English,
  ARPAbet → IPA with stress marks). No LLM involved. Tap any word in an NPC line for IPA + meaning + 🔊 + save to notebook (`POST /me/vocab`).
- `/admin/stats` → `learning`: subtitle turns, word taps, chat translations, settings changes.

## Talking to other players (Step 2 / phase 9)

- **Tap a player** → popup: *Request to talk*, wave, report. The other side gets Accept / Not now.
  A talk is a private text channel (server-relayed, profanity-masked, nobody else receives it) plus voice:
  the requester's microphone is used if on, the partner auto-joins the voice mesh in **listen-only** mode
  (no mic permission needed) and can turn their own mic on from the talk box. The server (`StreetRoom`) is the
  referee: both players must be within `PROXIMITY_RADIUS + INTERACT_RADIUS`, neither already in a talk,
  and the talk ends when they drift beyond `TALK_DROP_RADIUS` or one of them leaves.
- **Shout** 📢: a text shout (toggle next to the chat input) is delivered to everyone within `SHOUT_RADIUS`
  (24 m vs 8 m for normal chat), shown as a big red bubble, limited to one per 5 s per player. Holding the
  📢 button shouts with your voice: your `shouting` flag is in the room state, and every player within the
  radius connects to you at full volume (listen-only if they had voice off); releasing drops the extra connections.
- Status dots next to names: red = shouting, green = talking with you, grey = talking with someone else.
- Load test: `BOTS=50 SECONDS=30 SHOUT_RATE=0.002 pnpm --filter @es/game-server load:bots` (≈10 % of bots
  shouting per minute) measured 12 % CPU on the dev VPS, same as without shouts.

## NPC characters (Step 2 / phase 10)

Each shopkeeper is a Quaternius CC0 human (`public/models/characters/*.glb`, 7 base models, ~500 KB each after
`pnpm --filter @es/web build:models`: unused clips removed, meshopt-compressed). `scene/npcLook.ts` maps every NPC
to a model plus **material recolours** (the stock outfit becomes a uniform: white coat, green store vest, grey suit…)
and **procedural accessories** attached to bones (`scene/Human.tsx`): barista cap, postal cap, sun hat, name badge,
stethoscope, bow tie, apron. Bone-space objects are scaled by the inverse bone world scale (the rigs use ~95×).
Players still use the robot model; the same pipeline will give them human avatars in Step 3.
Preview any look without joining the game: `http://localhost:5173/dev/preview.html?npcs=barista,doctor` (dev only).
