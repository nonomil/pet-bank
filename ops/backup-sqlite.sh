#!/usr/bin/env bash
set -Eeuo pipefail

DATA_DIR="${PETBANK_DATA_DIR:-/srv/pet-bank/shared/data}"
BACKUP_DIR="${PETBANK_BACKUP_DIR:-/srv/pet-bank/shared/backups}"
DB_PATH="${DATA_DIR}/petbank.db"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_PATH="${BACKUP_DIR}/petbank-${STAMP}.db"

if [[ ! -f "$DB_PATH" ]]; then
  echo "database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077
cp --reflink=auto --preserve=mode,timestamps "$DB_PATH" "$BACKUP_PATH"
sha256sum "$BACKUP_PATH" | tee "${BACKUP_PATH}.sha256"
echo "backup created: $BACKUP_PATH"
