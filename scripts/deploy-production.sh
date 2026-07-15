#!/bin/sh
set -e

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env already exists — skipping copy"
else
  cp .env.production.example .env
  echo "Created .env from .env.production.example"
  echo "Edit .env and set AUTH_SECRET + AUTHENTIK_CLIENT_SECRET before deploy"
fi

docker compose up -d --build

echo ""
echo "If first deploy, run migration:"
echo "  docker compose exec -T postgres psql -U mealplanner -d mealplanner < src/db/migrations/0001_initial.sql"
echo ""
echo "Health check:"
echo "  curl http://localhost:3102/api/health"
