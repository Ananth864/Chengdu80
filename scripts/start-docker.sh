#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v bun >/dev/null 2>&1 || {
  printf 'Error: Bun is required. Install it from https://bun.sh\n' >&2
  exit 1
}
command -v docker >/dev/null 2>&1 || {
  printf 'Error: Docker is required. Install and start Docker Desktop or Docker Engine.\n' >&2
  exit 1
}
docker compose version >/dev/null 2>&1 || {
  printf 'Error: Docker Compose v2 is required.\n' >&2
  exit 1
}

# Reuse the launcher so environment loading and Compose settings stay in sync.
exec bun "$script_dir/hosted.ts" deploy
