#!/bin/sh
set -e

cd "$(dirname "$0")/.."

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

echo "Running database migrations..."
compose run --rm migrate

echo "Building and starting application..."
compose up -d --build app backup

echo ""
echo "Health check:"
echo "  curl http://192.168.1.213:3102/api/health"
echo ""
echo "Authentik redirect URI:"
echo "  https://food.rozwinswojbiznes.pl/api/auth/callback/authentik"
