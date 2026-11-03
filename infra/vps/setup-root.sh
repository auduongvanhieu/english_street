#!/usr/bin/env bash
# One-time root setup on the coffeesos VPS (run with sudo). Idempotent.
#   sudo bash /home/sm/apps/english-street/infra/vps/setup-root.sh
set -euo pipefail
APP=/home/sm/apps/english-street
DOMAIN=englishstreet.coffeesos.online
WWW=/var/www/$DOMAIN
HERE=$(cd "$(dirname "$0")" && pwd)

echo "== 1. static web root"
mkdir -p "$WWW" && chown sm:sm "$WWW"

echo "== 2. nginx"
cp "$HERE/nginx-upgrade-map.conf" /etc/nginx/conf.d/00-englishstreet-upgrade-map.conf
[ -f /etc/nginx/conf.d/$DOMAIN.conf ] || cp "$HERE/nginx-englishstreet.conf" /etc/nginx/conf.d/$DOMAIN.conf
nginx -t && systemctl reload nginx

echo "== 3. systemd services (run as sm)"
cp "$HERE/englishstreet-api.service" "$HERE/englishstreet-game.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable englishstreet-api englishstreet-game

echo "== 4. let sm restart the services and reload nginx without a password"
cat > /etc/sudoers.d/englishstreet <<'SUDO'
sm ALL=(root) NOPASSWD: /bin/systemctl restart englishstreet-api, /bin/systemctl restart englishstreet-game, /bin/systemctl status englishstreet-api, /bin/systemctl status englishstreet-game, /bin/systemctl reload nginx, /usr/sbin/nginx -t
SUDO
chmod 440 /etc/sudoers.d/englishstreet && visudo -cf /etc/sudoers.d/englishstreet

echo "== 5. Redis (sessions, quotas)"
if ! ss -ltn | grep -q ':6379 '; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q redis-server
  systemctl enable --now redis-server
fi

echo "== 6. Postgres database"
if ! grep -q '^DATABASE_URL=postgresql://englishstreet:' "$APP/.env"; then
  PW=$(openssl rand -hex 16)
  SQL="DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='englishstreet') THEN CREATE ROLE englishstreet LOGIN PASSWORD '$PW'; END IF; END \$\$; ALTER ROLE englishstreet PASSWORD '$PW';"
  PGC=$(docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | awk '/postgres/ {print $1; exit}' || true)
  if [ -n "$PGC" ]; then
    # Reuse the Postgres container already running on this machine (127.0.0.1:5432).
    PGU=$(docker exec "$PGC" printenv POSTGRES_USER 2>/dev/null || echo postgres)
    docker exec -i "$PGC" psql -U "$PGU" -v ON_ERROR_STOP=1 -c "$SQL"
    docker exec -i "$PGC" psql -U "$PGU" -tc "SELECT 1 FROM pg_database WHERE datname='englishstreet'" | grep -q 1 || docker exec -i "$PGC" psql -U "$PGU" -c "CREATE DATABASE englishstreet OWNER englishstreet"
    PORT=$(docker port "$PGC" 5432/tcp 2>/dev/null | head -1 | sed 's/.*://'); PORT=${PORT:-5432}
  else
    ss -ltn | grep -q ':5432 ' && { echo "Port 5432 busy but no postgres container found; create a DB manually and set DATABASE_URL in $APP/.env"; exit 1; }
    DEBIAN_FRONTEND=noninteractive apt-get install -y -q postgresql
    systemctl enable --now postgresql
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "$SQL"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='englishstreet'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE englishstreet OWNER englishstreet"
    PORT=5432
  fi
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://englishstreet:$PW@127.0.0.1:$PORT/englishstreet|" "$APP/.env"
  echo "DATABASE_URL written to $APP/.env"
fi

echo "== 7. TLS certificate"
if [ ! -d /etc/letsencrypt/live/$DOMAIN ]; then
  certbot --nginx -d $DOMAIN --redirect --non-interactive --agree-tos -m "${ACME_EMAIL:-auduongvanhieu@gmail.com}" || echo "certbot failed (DNS not pointing here yet?) — rerun this script later"
fi

echo "== 8. start"
# stop any hand-started (nohup) copies of the app so systemd can take the ports
pkill -u sm -f "/home/sm/apps/english-street/node_modules" || true
sleep 1
systemctl restart englishstreet-api englishstreet-game
sleep 3
systemctl --no-pager --lines=0 status englishstreet-api englishstreet-game | grep -E 'service|Active'
echo "Done. Now, as sm:  bash $APP/infra/vps/deploy.sh   (runs migrations + rebuilds the web bundle)"
