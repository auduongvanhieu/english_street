#!/usr/bin/env bash
# Deploy / update on the coffeesos VPS, as user sm:   bash /home/sm/apps/english-street/infra/vps/deploy.sh
set -euo pipefail
APP=/home/sm/apps/english-street
WWW=/var/www/englishstreet.coffeesos.online
export NVM_DIR=$HOME/.nvm; . "$NVM_DIR/nvm.sh"
cd "$APP"

echo "== pull"; git pull --ff-only
echo "== install"; pnpm install --frozen-lockfile
echo "== migrate"; (cd apps/api && pnpm exec prisma migrate deploy) || echo "!! migrations failed (no DATABASE_URL yet?) — API falls back to in-memory storage"
echo "== build web"
set -a; . ./.env; set +a          # VITE_API_URL / VITE_GAME_WS_URL for the bundle
pnpm --filter @es/web build
if [ -d "$WWW" ] && [ -w "$WWW" ]; then
  rsync -a --delete apps/web/dist/ "$WWW/"
  echo "web bundle -> $WWW"
else
  echo "!! $WWW not writable; run setup-root.sh first"
fi
echo "== restart services"
if sudo -n systemctl restart englishstreet-api englishstreet-game 2>/dev/null; then
  sleep 3; sudo -n systemctl status englishstreet-api englishstreet-game --no-pager --lines=0 | grep -E 'service|Active'
else
  echo "!! cannot restart via systemd (setup-root.sh not run yet)"
fi
curl -s http://127.0.0.1:4600/health; echo; curl -s http://127.0.0.1:2600/health; echo
