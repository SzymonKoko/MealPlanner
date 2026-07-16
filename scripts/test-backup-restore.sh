#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

COMPOSE_DISABLE_ENV_FILE=1 docker compose run --rm --no-deps --entrypoint /bin/sh backup -c '
  set -eu
  latest=$(ls -1t /backups/*.dump 2>/dev/null | awk "NR == 1")
  if [ -z "$latest" ]; then
    echo "No database backup found" >&2
    exit 1
  fi
  latest_uploads=$(ls -1t /backups/*uploads*.tar.gz 2>/dev/null | awk "NR == 1")
  if [ -z "$latest_uploads" ]; then
    echo "No uploads backup found" >&2
    exit 1
  fi
  tar -tzf "$latest_uploads" >/dev/null

  test_db="mealplanner_restore_test_$(date +%s)"
  cleanup() {
    dropdb --if-exists "$test_db" >/dev/null 2>&1 || true
  }
  trap cleanup EXIT INT TERM

  createdb "$test_db"
  pg_restore --exit-on-error --no-owner --no-privileges -d "$test_db" "$latest"
  psql -d "$test_db" -v ON_ERROR_STOP=1 -c "
    SELECT 1
    FROM users, households, recipes, meal_plan_entries, shopping_lists
    LIMIT 1
  " >/dev/null
  echo "Restore test passed for $latest and $latest_uploads"
'
