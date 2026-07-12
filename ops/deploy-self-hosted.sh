#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${PETBANK_REPO_URL:-https://github.com/nonomil/pet-bank.git}"
ROOT="${PETBANK_ROOT:-/srv/pet-bank}"
RELEASE_ID="${PETBANK_RELEASE_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
RELEASE_DIR="${ROOT}/releases/${RELEASE_ID}"
CURRENT_LINK="${ROOT}/current"
SHARED_DIR="${ROOT}/shared"

if [[ -e "$RELEASE_DIR" ]]; then
  echo "release already exists: $RELEASE_DIR" >&2
  exit 1
fi

mkdir -p "${ROOT}/releases" "${SHARED_DIR}/data" "${SHARED_DIR}/backups"
git clone --depth 1 "$REPO_URL" "$RELEASE_DIR"
cd "$RELEASE_DIR"

node --version
node scripts/assemble-pages-artifact.mjs site
node --test prj/petbank-server/test/*.test.mjs
node --check prj/petbank-server/src/server.mjs
node --check prj/petbank-server/src/security.mjs

if [[ ! -f "${SHARED_DIR}/server.env" ]]; then
  echo "missing ${SHARED_DIR}/server.env; create it before deployment" >&2
  exit 1
fi

ln -sfn "${SHARED_DIR}/server.env" "${RELEASE_DIR}/prj/petbank-server/.env"
cd "${RELEASE_DIR}/prj/petbank-server/deploy"
docker compose -p petbank-api stop api || true
if [[ -f "${SHARED_DIR}/data/petbank.db" ]]; then
  PETBANK_DATA_DIR="${SHARED_DIR}/data" PETBANK_BACKUP_DIR="${SHARED_DIR}/backups" "${RELEASE_DIR}/ops/backup-sqlite.sh"
fi
docker compose -p petbank-api up -d --build
curl --fail --silent --show-error http://127.0.0.1:3000/api/v1/health
printf '\n'

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx
fi
curl --fail --silent --show-error "http://127.0.0.1${PETBANK_STATIC_PREFIX:-}/app/" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1${PETBANK_STATIC_PREFIX:-}/parent/" >/dev/null
echo "current release: $RELEASE_DIR"
