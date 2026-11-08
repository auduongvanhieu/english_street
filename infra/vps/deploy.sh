#!/usr/bin/env bash
# Deploy / update on the coffeesos VPS, as user sm:
#   bash /home/sm/apps/english-street/infra/vps/deploy.sh [mode]
# Modes:
#   (none)   pull, build the web app, copy it; restart the API and game server only when server code changed since
#            the last restart (apps/api, apps/game-server, packages, lockfile). Players are disconnected only then.
#   admin    only the admin site: the game's files (index.html, service worker, manifests) are left alone, nothing
#            restarts; players notice nothing.
#   web      game + admin web app, no restart (players get the new version the next time they open the game).
#   restart  like (none), but always restart.
#   check    fetch and say what a deploy would do (restart or not); changes nothing.
set -euo pipefail
APP=/home/sm/apps/english-street
WWW=/var/www/englishstreet.coffeesos.online
STAMP="$APP/.deployed-server-commit"   # the commit the running API / game server were started from
SERVER_PATHS=(apps/api apps/game-server packages pnpm-lock.yaml package.json pnpm-workspace.yaml)
MODE="${1:-auto}"
export NVM_DIR=$HOME/.nvm; . "$NVM_DIR/nvm.sh" >/dev/null
cd "$APP"

server_changed() { # $1 = target commit
  [ -f "$STAMP" ] || return 0
  [ -n "$(git diff --name-only "$(cat "$STAMP")" "$1" -- "${SERVER_PATHS[@]}" 2>/dev/null)" ]
}

case "$MODE" in
  auto|admin|web|restart|check) ;;
  *) echo "usage: deploy.sh [admin|web|restart|check]"; exit 2 ;;
esac

if [ "$MODE" = check ]; then
  git fetch -q
  if server_changed origin/main; then echo "restart needed: yes (server code changed)"; else echo "restart needed: no"; fi
  git log --oneline HEAD..origin/main | sed 's/^/  new: /'
  exit 0
fi

# pull first, then run the freshly pulled copy of this script (bash reads scripts as it goes)
if [ -z "${ES_DEPLOY_PULLED:-}" ]; then
  echo "== pull"; git pull --ff-only
  ES_DEPLOY_PULLED=1 exec bash "$APP/infra/vps/deploy.sh" "$MODE"
fi

RESTART=no
if [ "$MODE" = restart ] || { [ "$MODE" = auto ] && server_changed HEAD; }; then RESTART=yes; fi
if [ "$MODE" = web ] && server_changed HEAD; then echo "!! server code changed since the last restart: run deploy.sh (no mode) to restart"; fi

echo "== install"; pnpm install --frozen-lockfile
if [ "$RESTART" = yes ]; then
  echo "== migrate"; (cd apps/api && pnpm exec prisma migrate deploy) || echo "!! migrations failed (no DATABASE_URL yet?) — API falls back to in-memory storage"
fi

echo "== build web"
set -a; . ./.env; set +a          # VITE_API_URL / VITE_GAME_WS_URL for the bundle
pnpm --filter @es/web build
if [ -d "$WWW" ] && [ -w "$WWW" ]; then
  if [ "$MODE" = admin ]; then
    # new admin page and its assets only; the game's entry files stay as they are (old assets are kept, not deleted)
    rsync -a --exclude=/index.html --exclude=/sw.js --exclude='/workbox-*.js' --exclude=/registerSW.js --exclude='/manifest*.webmanifest' apps/web/dist/ "$WWW/"
    echo "admin site -> $WWW/admin"
  else
    rsync -a --delete apps/web/dist/ "$WWW/"
    echo "web bundle -> $WWW"
  fi
else
  echo "!! $WWW not writable; run setup-root.sh first"
fi

if [ "$RESTART" = yes ]; then
  echo "== restart services"
  if sudo -n systemctl restart englishstreet-api englishstreet-game 2>/dev/null; then
    sleep 3; sudo -n systemctl status englishstreet-api englishstreet-game --no-pager --lines=0 | grep -E 'service|Active'
  else
    # No passwordless sudo: the units have Restart=always, so ending our own processes makes systemd start fresh ones.
    echo "(no sudo) asking systemd to restart by stopping the current processes"
    pkill -u sm -f "/home/sm/apps/english-street/node_modules" || true
  fi
  git rev-parse HEAD > "$STAMP"
else
  echo "== no restart (players stay connected)"
fi

# the API can take a few seconds to answer after a restart
for i in $(seq 1 15); do
  a=$(curl -s -m 5 http://127.0.0.1:4600/health || true); g=$(curl -s -m 5 http://127.0.0.1:2600/health || true)
  [ -n "$a" ] && [ -n "$g" ] && break
  sleep 2
done
echo "api:  ${a:-DOWN}"; echo "game: ${g:-DOWN}"
echo "restarted: $RESTART"
[ -n "$a" ] && [ -n "$g" ]
