# syntax=docker/dockerfile:1
# One Dockerfile, three targets:  --target api | game | web
#   docker build -f infra/Dockerfile --target api  -t english-street-api  .
#   docker build -f infra/Dockerfile --target web  --build-arg VITE_API_URL=https://api.example.com --build-arg VITE_GAME_WS_URL=wss://ws.example.com -t english-street-web .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate \
 && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
# postinstall runs `prisma generate` (needs the schema + packages/shared, hence the full copy above)
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------- API (Fastify + Prisma + Claude)
FROM base AS api
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then serve.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec tsx src/index.ts"]

# ---------------------------------------------------------------- Game server (Colyseus)
FROM base AS game
ENV NODE_ENV=production
WORKDIR /app/apps/game-server
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:2567/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "exec", "tsx", "src/index.ts"]

# ---------------------------------------------------------------- Web (static, nginx)
FROM base AS web-build
ARG VITE_API_URL
ARG VITE_GAME_WS_URL
ENV VITE_API_URL=$VITE_API_URL VITE_GAME_WS_URL=$VITE_GAME_WS_URL
RUN pnpm --filter @es/web build

FROM nginx:1.27-alpine AS web
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
