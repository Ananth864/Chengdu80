#!/usr/bin/env bash
# Bootstraps the fully self-hosted stack on a fresh machine: no Cloudflare,
# Alchemy, or Convex Cloud account required.
#
# Usage:
#   bash scripts/setup-selfhosted.sh
#
# Idempotent: safe to re-run. Reuses existing secrets/keys instead of
# regenerating them, and skips steps that already succeeded.
#
# What this does, end to end:
#   1. Checks for required tools (bun, docker, docker compose, openssl, curl).
#   2. Creates apps/web/.env (from .env.example) with generated secrets if missing.
#   3. Runs `bun install`.
#   4. Starts the self-hosted Convex backend + dashboard via docker compose.
#   5. Waits for the Convex backend to be healthy.
#   6. Generates a Convex admin key (first run only) and writes
#      packages/backend/.env.local.
#   7. Sets CD80_DEMO_MODE and PLATFORM_INTERNAL_KEY on the Convex deployment
#      (must match apps/web/.env's PLATFORM_INTERNAL_KEY).
#   8. Deploys Convex functions/schema.
#   9. Prints next steps to run the web app (Docker or local Node process).

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

log() { printf '\n==> %s\n' "$1"; }
die() { printf 'error: %s\n' "$1" >&2; exit 1; }

# --- 1. Required tools -------------------------------------------------
log "Checking required tools"
command -v docker >/dev/null 2>&1 || die "docker is required. Install Docker Desktop or Docker Engine: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || die "docker compose (v2) is required. Update Docker Desktop/Engine."
command -v openssl >/dev/null 2>&1 || die "openssl is required to generate secrets."
command -v curl >/dev/null 2>&1 || die "curl is required."

if ! command -v bun >/dev/null 2>&1; then
  log "bun not found; installing (curl -fsSL https://bun.sh/install | bash)"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  command -v bun >/dev/null 2>&1 || die "bun install failed; install manually from https://bun.sh then re-run this script."
fi
log "bun: $(bun --version), docker: $(docker --version)"

# --- 2. apps/web/.env ----------------------------------------------------
log "Preparing apps/web/.env"
rand_hex() { openssl rand -hex 32; }

if [ ! -f apps/web/.env ]; then
  platform_key="$(rand_hex)"
  cp apps/web/.env.example apps/web/.env
  # Fill required secrets; leave provider API keys blank for the user to set.
  sed -i.bak "s/^CD80_DEMO_MODE=.*/CD80_DEMO_MODE=1/" apps/web/.env
  sed -i.bak "s#^VITE_CONVEX_URL=.*#VITE_CONVEX_URL=http://127.0.0.1:3210#" apps/web/.env
  sed -i.bak "s/^PLATFORM_INTERNAL_KEY=.*/PLATFORM_INTERNAL_KEY=${platform_key}/" apps/web/.env
  rm -f apps/web/.env.bak
  chmod 600 apps/web/.env
  echo "Created apps/web/.env with a generated PLATFORM_INTERNAL_KEY (not printed)."
  echo "Edit apps/web/.env to add GLM_API_KEY / OPENAI_API_KEY / TUSHARE_TOKEN for live features."
else
  echo "apps/web/.env already exists; leaving it unchanged."
fi

platform_internal_key="$(grep '^PLATFORM_INTERNAL_KEY=' apps/web/.env | cut -d= -f2-)"
[ -n "$platform_internal_key" ] || die "PLATFORM_INTERNAL_KEY is empty in apps/web/.env; set it to a random 32+ char value."

# --- 3. Install dependencies --------------------------------------------
log "Installing workspace dependencies (bun install)"
bun install

# --- 4. .env.selfhost for docker-compose --------------------------------
log "Preparing .env.selfhost (docker-compose secrets)"
if [ ! -f .env.selfhost ]; then
  cat > .env.selfhost <<EOF
CONVEX_INSTANCE_SECRET=$(rand_hex)
PLATFORM_INTERNAL_KEY=${platform_internal_key}
CD80_DEMO_MODE=1
EOF
  chmod 600 .env.selfhost
  echo "Created .env.selfhost with a generated CONVEX_INSTANCE_SECRET."
else
  echo ".env.selfhost already exists; leaving it unchanged."
  # Keep PLATFORM_INTERNAL_KEY in sync with apps/web/.env so the two match.
  if command -v sed >/dev/null 2>&1; then
    sed -i.bak "s/^PLATFORM_INTERNAL_KEY=.*/PLATFORM_INTERNAL_KEY=${platform_internal_key}/" .env.selfhost
    rm -f .env.selfhost.bak
  fi
fi

# --- 5. Start Convex backend + dashboard --------------------------------
log "Starting self-hosted Convex backend + dashboard"
docker compose --env-file .env.selfhost up -d convex-backend convex-dashboard

log "Waiting for Convex backend to become healthy"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3210/version >/dev/null 2>&1; then
    echo "Convex backend is up."
    break
  fi
  sleep 2
done
curl -fsS http://127.0.0.1:3210/version >/dev/null 2>&1 || die "Convex backend did not become healthy in time. Check: docker compose logs convex-backend"

# --- 6. Admin key + packages/backend/.env.local -------------------------
log "Ensuring Convex admin key / packages/backend/.env.local"
if [ ! -f packages/backend/.env.local ]; then
  admin_key_line="$(docker compose --env-file .env.selfhost exec -T convex-backend ./generate_admin_key.sh | grep -A0 '|' | tail -1 | xargs)"
  [ -n "$admin_key_line" ] || die "Failed to generate a Convex admin key. Run manually: docker compose exec convex-backend ./generate_admin_key.sh"
  cat > packages/backend/.env.local <<EOF
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=${admin_key_line}
CD80_DEMO_MODE=1
EOF
  chmod 600 packages/backend/.env.local
  echo "Created packages/backend/.env.local with a generated admin key (not printed)."
else
  echo "packages/backend/.env.local already exists; leaving it unchanged."
fi

# --- 7. Convex deployment env vars ---------------------------------------
log "Setting Convex deployment env vars (CD80_DEMO_MODE, PLATFORM_INTERNAL_KEY)"
(
  cd packages/backend
  bunx --no-install convex env set CD80_DEMO_MODE 1 --env-file .env.local
  bunx --no-install convex env set PLATFORM_INTERNAL_KEY "${platform_internal_key}" --env-file .env.local
)

# --- 8. Deploy Convex functions ------------------------------------------
log "Deploying Convex schema and functions"
(
  cd packages/backend
  bunx --no-install convex deploy --env-file .env.local -y
)

# --- 9. Build and start the web app --------------------------------------
log "Building the web app (VITE_DEMO_MODE/VITE_CONVEX_URL must be set at build time)"
(
  cd apps/web
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  # VITE_DEMO_MODE is derived from CD80_DEMO_MODE (same as scripts/hosted.ts);
  # it is not stored in .env.example and must be set at build time.
  export VITE_DEMO_MODE="${CD80_DEMO_MODE:-1}"
  bunx --no-install vp build
)

log "Starting the web app as a local Node process"
web_pid_file="$repo_root/.selfhosted-web.pid"
if [ -f "$web_pid_file" ] && kill -0 "$(cat "$web_pid_file")" 2>/dev/null; then
  echo "Web app already running (pid $(cat "$web_pid_file")); stopping it first."
  kill "$(cat "$web_pid_file")" 2>/dev/null || true
  sleep 1
fi
(
  cd apps/web
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  export VITE_DEMO_MODE="${CD80_DEMO_MODE:-1}"
  export PORT="${CD80_PORT:-3098}"
  nohup node server/node-entry.mjs >"$repo_root/.selfhosted-web.log" 2>&1 &
  echo $! > "$web_pid_file"
)
sleep 2
if ! kill -0 "$(cat "$web_pid_file")" 2>/dev/null; then
  die "Web app failed to start. Check .selfhosted-web.log"
fi

# --- 10. Done --------------------------------------------------------------
log "Self-hosted stack is ready"
cat <<EOF

Web app:           http://localhost:3098
Convex backend:    http://127.0.0.1:3210
Convex dashboard:  http://127.0.0.1:6791

The web app is running as a background Node process (pid $(cat "$web_pid_file")),
logging to .selfhosted-web.log. Stop it with:
  kill \$(cat .selfhosted-web.pid)

To instead build and run the containerized image (e.g. for Coolify/k3s — point
VITE_CONVEX_URL at a publicly reachable Convex URL there instead of 127.0.0.1,
since it's inlined into the browser bundle at build time):

  bun run deploy:hosted

Or load both generated environment files explicitly:

  docker compose --env-file .env.selfhost --env-file apps/web/.env up -d --build

The containerized web app is available at http://localhost:3001.
EOF
