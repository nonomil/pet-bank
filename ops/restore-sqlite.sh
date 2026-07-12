#!/usr/bin/env bash
set -Eeuo pipefail

DATA_DIR="${PETBANK_DATA_DIR:-/srv/pet-bank/shared/data}"
DB_PATH="${DATA_DIR}/petbank.db"
BACKUP_PATH="${1:-}"
COMPOSE_FILE="${PETBANK_COMPOSE_FILE:-/srv/pet-bank/current/prj/petbank-server/deploy/compose.yml}"

if [[ -z "$BACKUP_PATH" || ! -f "$BACKUP_PATH" ]]; then
  echo "usage: $0 /srv/pet-bank/shared/backups/petbank-<timestamp>.db" >&2
  exit 2
fi

if [[ "${PETBANK_CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "refusing restore: set PETBANK_CONFIRM_RESTORE=YES after stopping the API" >&2
  exit 3
fi

if command -v docker >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" -p petbank-api stop api || true
fi

mkdir -p "$DATA_DIR"
umask 077
if [[ -f "$DB_PATH" ]]; then
  cp --reflink=auto --preserve=mode,timestamps "$DB_PATH" "${DB_PATH}.before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
fi
cp --reflink=auto --preserve=mode,timestamps "$BACKUP_PATH" "$DB_PATH"
sha256sum "$DB_PATH"
if command -v docker >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" -p petbank-api start api || true
fi
echo "database restored: $DB_PATH"
