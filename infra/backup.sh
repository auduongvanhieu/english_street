#!/usr/bin/env sh
# Nightly Postgres dump (keep 14 days). Cron example:  0 3 * * * /opt/english-street/infra/backup.sh
set -eu
DIR="${BACKUP_DIR:-/var/backups/english-street}"
mkdir -p "$DIR"
docker compose -f "$(dirname "$0")/docker-compose.prod.yml" exec -T postgres pg_dump -U es english_street | gzip > "$DIR/es-$(date +%F).sql.gz"
find "$DIR" -name 'es-*.sql.gz' -mtime +14 -delete
