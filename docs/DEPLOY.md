# Deploy English Street

Mục tiêu: chạy toàn bộ game trên **một VPS** (2 vCPU / 2–4 GB RAM là đủ cho beta 50–100 người)
bằng Docker Compose, HTTPS tự động qua Caddy. Mọi thứ nằm trong `infra/`.

```
Internet ──► Caddy (80/443, Let's Encrypt)
               ├─ play.example.com ──► web   (nginx, bundle Vite tĩnh)
               ├─ api.example.com  ──► api   (Fastify :4000)  ──► Postgres, Redis, Claude API
               └─ ws.example.com   ──► game  (Colyseus :2567)
```

## 1. Chuẩn bị

1. VPS Ubuntu 22.04+ với Docker Engine + plugin compose (`docker compose version` chạy được).
2. Ba bản ghi DNS **A** trỏ về IP VPS: `play.`, `api.`, `ws.` (tên tuỳ ý, khai báo trong `.env`).
3. Mở cổng 80 và 443 (TCP, và UDP 443 cho HTTP/3 nếu muốn).
4. Claude API key (console.anthropic.com) và đã đặt **spend limit** cho workspace đó.

## 2. Cấu hình

```bash
git clone https://github.com/auduongvanhieu/english_street.git /opt/english-street
cd /opt/english-street
cp .env.example .env
nano .env
```

Các biến bắt buộc cho production:

| Biến | Ghi chú |
|---|---|
| `ANTHROPIC_API_KEY` | key thật; `NPC_PROVIDER` để `auto` |
| `AUTH_SECRET` | chuỗi ngẫu nhiên dài (`openssl rand -hex 32`); API **từ chối chạy** với giá trị mặc định khi `NODE_ENV=production` |
| `ADMIN_TOKEN` | token cho `/admin/*` (`openssl rand -hex 24`) |
| `POSTGRES_PASSWORD` | mật khẩu DB (compose tự ghép thành `DATABASE_URL`) |
| `WEB_DOMAIN`, `API_DOMAIN`, `WS_DOMAIN`, `ACME_EMAIL` | tên miền + email Let's Encrypt |
| `BETA_CODES` | mã mời cho beta kín, ví dụ `beta-hieu,beta-lop1`; để trống = mở cho mọi người |
| `NPC_DAILY_BUDGET_USD`, `NPC_DAILY_TURNS_PER_PLAYER` | trần chi phí (xem README) |

`TRUST_PROXY=true`, `REDIS_URL`, `WEB_ORIGIN` và `VITE_*` đã được compose đặt sẵn theo domain, không cần sửa.

## 3. Chạy

```bash
docker compose --env-file .env -f infra/docker-compose.prod.yml up -d --build
docker compose -f infra/docker-compose.prod.yml logs -f api game
```

- Container `api` tự chạy `prisma migrate deploy` trước khi phục vụ.
- Caddy xin chứng chỉ ngay lần đầu (cần DNS đã trỏ đúng).
- Kiểm tra: `curl https://api.example.com/health` → `{"ok":true,"db":"ok","counters":"redis"}`,
  `curl https://ws.example.com/health` → `{"ok":true,"rooms":0,...}`, mở `https://play.example.com`.

Cập nhật phiên bản mới:

```bash
git pull && docker compose --env-file .env -f infra/docker-compose.prod.yml up -d --build
```

## 4. Vận hành

**Thống kê** (JSON, bảo vệ bằng `ADMIN_TOKEN`):

```bash
curl -H "authorization: Bearer $ADMIN_TOKEN" https://api.example.com/admin/stats?days=7
curl -H "authorization: Bearer $ADMIN_TOKEN" https://api.example.com/admin/budget     # chi phí hôm nay
curl -H "authorization: Bearer $ADMIN_TOKEN" https://api.example.com/admin/feedback   # góp ý từ nút 💬 Feedback
curl -H "authorization: Bearer $ADMIN_TOKEN" https://api.example.com/admin/reports    # báo cáo người chơi
```

`/admin/stats` gồm: người dùng (tổng, đăng ký, hoạt động hôm nay, DAU theo ngày), quest (bắt đầu /
hoàn thành / bỏ, tỉ lệ hoàn thành, điểm trung bình, theo từng quest), NPC (số lượt, tỉ lệ dùng giọng nói,
loại lỗi hay gặp, số lần bị chặn vì hạn mức, chi phí hôm nay), tương tác (quest cặp đôi, voice chat, report),
client (tải trang, tỉ lệ mobile, FPS trung bình, số phiên FPS < 30, draw call).

**Backup DB** hằng đêm: `crontab -e` → `0 3 * * * /opt/english-street/infra/backup.sh` (giữ 14 ngày trong `/var/backups/english-street`).

**Beta kín**: đặt `BETA_CODES`, restart `api` và `game`. Màn hình đăng nhập hiện ô "Invite code";
mã hợp lệ đổi lấy pass 90 ngày lưu trong trình duyệt; API và game server đều kiểm tra pass (hoặc tài khoản đã đăng nhập).
Gỡ gate: xoá `BETA_CODES` rồi restart.

**Chạy nhiều instance**: hạn mức, ngân sách, rate limit, session NPC và session cặp đôi đều nằm trong Redis
nên `api` scale ngang được (đặt sau Caddy với nhiều upstream). `game` hiện một instance (mỗi room 50 người,
tự tạo room mới khi đầy); muốn nhiều instance game cần thêm `@colyseus/redis-presence` + `@colyseus/redis-driver`.

## 5. Load test

```bash
BOTS=50 SECONDS=30 WS_URL=wss://ws.example.com pnpm --filter @es/game-server load:bots
```

Kết quả đo ngày 2026-11-03 trên máy dev (1 instance game, không Redis):

| Bots | Rooms | p50 / p95 round-trip | CPU | RSS |
|---|---|---|---|---|
| 50 | 1 | 19 / 45 ms | 12 % | 122 MB |
| 100 | 2 | 23 / 47 ms | 18 % | 125 MB |

## 6. Phương án khác

- **Web tĩnh trên Cloudflare Pages / Vercel**: build `pnpm --filter @es/web build` với `VITE_API_URL`, `VITE_GAME_WS_URL`
  trỏ về VPS; bỏ service `web` và host `WEB_DOMAIN` trong Caddyfile; `WEB_ORIGIN` = domain Pages.
- **Fly.io / Railway**: dùng `infra/Dockerfile` với `--target api` và `--target game`, Postgres/Redis managed;
  đặt `TRUST_PROXY=true`.
