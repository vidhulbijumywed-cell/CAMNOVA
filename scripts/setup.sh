#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npm run env:init
docker volume create camnova_pgdata >/dev/null
docker compose up -d db
npm run db:wait
npm run db:generate
# Restore a retained cloud snapshot backup before considering seed data.
if [ -f .local/cloud-backup.dump ]; then
  if [ "$(docker compose exec -T db psql -U camnova -d camnova -Atc 'SELECT to_regclass($$public."Booking"$$)')" = "" ]; then
    docker compose exec -T db pg_restore -U camnova -d camnova --clean --if-exists --no-owner < .local/cloud-backup.dump
  fi
fi
npm run db:migrate
npm run db:seed
