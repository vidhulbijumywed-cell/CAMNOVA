#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local
backup_file=$(mktemp .local/camnova-backup.XXXXXX)
trap 'rm -f "$backup_file"' EXIT
docker compose exec -T db pg_dump -U camnova -d camnova -Fc > "$backup_file"
mv "$backup_file" .local/cloud-backup.dump
chmod 600 .local/cloud-backup.dump
printf 'Database snapshot saved to ignored .local/cloud-backup.dump\n'
