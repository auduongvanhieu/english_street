#!/usr/bin/env bash
# Nightly database backup (cron, user sm):   30 3 * * * bash /home/sm/apps/english-street/infra/vps/backup.sh
# Writes ~/backups/english-street/es-<time>.jsonl.gz (all tables, newest 14 kept). Restore:
#   pnpm --filter @es/api db:restore ~/backups/english-street/<file> --yes
set -euo pipefail
APP=/home/sm/apps/english-street
export NVM_DIR=$HOME/.nvm; . "$NVM_DIR/nvm.sh"
cd "$APP"
set -a; . ./.env; set +a
mkdir -p "$HOME/backups/english-street"
pnpm --silent --filter @es/api db:backup >> "$HOME/backups/english-street/backup.log" 2>&1
