# English Street

Game học tiếng Anh đa người chơi: người chơi đi dạo trên một con phố 3D low-poly,
trò chuyện bằng tiếng Anh (gõ hoặc nói) với các NPC chủ cửa hàng và với người chơi khác.

Thiết kế đầy đủ: [docs/GDD.md](docs/GDD.md).

## Cấu trúc

```
apps/web          React + React Three Fiber client (Vite)
apps/api          Fastify REST API + Prisma + Claude (NPC AI)
apps/game-server  Colyseus realtime server (vị trí, chat gần)
packages/shared   Zod schemas + types dùng chung
packages/quests   Nội dung NPC persona + quest (YAML)
infra             docker-compose (Postgres, Redis)
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

Không có Docker: cài Postgres/Redis cục bộ và sửa `DATABASE_URL`, `REDIS_URL` trong `.env`.
