#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${PETBANK_ROOT:-/srv/pet-bank}"
COMPOSE_FILE="${PETBANK_COMPOSE_FILE:-${ROOT}/current/prj/petbank-server/deploy/compose.yml}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" -p petbank-api exec -T api node src/authorization-cli.mjs list-accounts
