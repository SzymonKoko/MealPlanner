#!/bin/sh
set -e

cd "$(dirname "$0")/.."

compose_version=$(docker compose version --short | tr -d 'v')
minimum_compose_version=2.30.0
oldest_version=$(printf "%s\n%s\n" "$minimum_compose_version" "$compose_version" | sort -V | awk 'NR == 1')
if [ "$oldest_version" != "$minimum_compose_version" ]; then
  echo "Docker Compose >= $minimum_compose_version is required (found $compose_version)" >&2
  exit 1
fi

compose() {
  COMPOSE_DISABLE_ENV_FILE=1 docker compose "$@"
}

ensure_env() {
  key="$1"
  value="$2"
  if ! grep -q "^${key}=" .env; then
    printf "\n%s=%s\n" "$key" "$value" >> .env
    echo "Added missing $key to .env"
  fi
}


require_env() {
  key="$1"
  value=$(sed -n "s/^${key}=//p" .env | tail -n 1)
  if [ -z "$value" ] || [ "$value" = "CHANGE_ME_GENERATE_RANDOM_SECRET_32_CHARS" ] || [ "$value" = "CHANGE_ME_FROM_AUTHENTIK_PANEL" ]; then
    echo "Missing required .env value: $key" >&2
    exit 1
  fi
}

if [ -f .env ]; then
  echo ".env already exists - skipping copy"
else
  cp .env.production.example .env
  echo "Created .env from .env.production.example"
  echo "Edit .env and set AUTH_SECRET + AUTHENTIK_CLIENT_SECRET before deploy"
  exit 1
fi

ensure_env AUTH_URL https://food.rozwinswojbiznes.pl
ensure_env NEXTAUTH_URL https://food.rozwinswojbiznes.pl
ensure_env AUTH_TRUST_HOST true
ensure_env APP_URL https://food.rozwinswojbiznes.pl
ensure_env AUTHENTIK_ISSUER https://auth.rozwinswojbiznes.pl/application/o/food-planner-app/
ensure_env DEV_AUTH_BYPASS false

require_env AUTH_SECRET
require_env AUTHENTIK_CLIENT_ID
require_env AUTHENTIK_CLIENT_SECRET

echo "Starting database..."
compose up -d postgres

echo "Creating verified pre-deploy backup..."
compose run --rm --no-deps --entrypoint /bin/sh backup -c '
  set -eu
  target="/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).dump"
  temporary="$target.tmp"
  pg_dump -Fc > "$temporary"
  pg_restore --list "$temporary" >/dev/null
  mv "$temporary" "$target"
  tar -czf "/backups/pre-deploy-uploads-$(date +%Y%m%d-%H%M%S).tar.gz" -C /uploads .
  echo "Backup saved to $target"
'

echo "Running database migrations..."
compose run --rm migrate

echo "Building and starting application..."
compose up -d --build --no-deps app backup

echo "Waiting for application readiness..."
attempt=1
while [ "$attempt" -le 30 ]; do
  if curl -fsS http://192.168.1.213:3102/api/health >/dev/null; then
    echo "Application is healthy"
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "Application did not become healthy" >&2
    compose logs --tail=100 app migrate >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done
echo ""
echo "Authentik redirect URI:"
echo "  https://food.rozwinswojbiznes.pl/api/auth/callback/authentik"
