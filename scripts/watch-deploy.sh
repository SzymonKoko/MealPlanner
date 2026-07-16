#!/bin/sh
set -eu

REPO_DIR="${WATCH_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
INTERVAL_SECONDS="${WATCH_INTERVAL_SECONDS:-30}"
DEPLOY_COMMAND="${WATCH_DEPLOY_COMMAND:-sh scripts/deploy-production.sh}"
LOCK_DIR="${WATCH_LOCK_DIR:-/tmp/mealplanner-watch-deploy.lock}"

log() {
  printf "%s %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

finish() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another watch-deploy process is already running: $LOCK_DIR" >&2
  exit 1
fi
trap finish EXIT INT TERM

cd "$REPO_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a Git work tree: $REPO_DIR" >&2
  exit 1
fi

UPSTREAM="${WATCH_UPSTREAM:-$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)}"
if [ -z "$UPSTREAM" ]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  UPSTREAM="origin/$CURRENT_BRANCH"
fi

REMOTE="${WATCH_REMOTE:-${UPSTREAM%%/*}}"
REMOTE_BRANCH="${WATCH_REMOTE_BRANCH:-${UPSTREAM#*/}}"

log "Watching $UPSTREAM from $REPO_DIR every ${INTERVAL_SECONDS}s"

while true; do
  if ! git diff --quiet || ! git diff --cached --quiet; then
    log "Tracked files are not clean; skipping pull and deploy"
  else
    git fetch "$REMOTE" "$REMOTE_BRANCH" >/dev/null 2>&1

    LOCAL_SHA="$(git rev-parse HEAD)"
    REMOTE_SHA="$(git rev-parse "$UPSTREAM")"

    if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
      BASE_SHA="$(git merge-base HEAD "$UPSTREAM")"

      if [ "$BASE_SHA" != "$LOCAL_SHA" ]; then
        log "Local branch diverged from $UPSTREAM; refusing automatic deploy"
        exit 1
      fi

      log "New commit detected: $REMOTE_SHA"
      git pull --ff-only "$REMOTE" "$REMOTE_BRANCH"

      log "Running deploy: $DEPLOY_COMMAND"
      sh -c "$DEPLOY_COMMAND"
      log "Deploy finished"
    fi
  fi

  if [ "${WATCH_ONCE:-0}" = "1" ]; then
    exit 0
  fi

  sleep "$INTERVAL_SECONDS"
done
