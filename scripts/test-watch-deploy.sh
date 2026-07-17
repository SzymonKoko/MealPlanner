#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WATCH_SCRIPT="$ROOT_DIR/scripts/watch-deploy.sh"

if [ ! -f "$WATCH_SCRIPT" ]; then
  echo "Missing watcher script: $WATCH_SCRIPT" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
WATCH_PID=""
cleanup() {
  if [ -n "$WATCH_PID" ]; then
    kill "$WATCH_PID" 2>/dev/null || true
    wait "$WATCH_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

ORIGIN="$TMP_DIR/origin.git"
SEED="$TMP_DIR/seed"
WORK="$TMP_DIR/work"

git init --bare "$ORIGIN" >/dev/null
git clone "$ORIGIN" "$SEED" >/dev/null 2>&1
git -C "$SEED" config user.name "Deploy Test"
git -C "$SEED" config user.email "deploy-test@example.com"

printf "version-one\n" > "$SEED/app.txt"
mkdir -p "$SEED/scripts"
cat > "$SEED/scripts/deploy-production.sh" <<'DEPLOY'
#!/bin/sh
set -eu
if [ -f fail-deploy ]; then
  rm fail-deploy
  exit 42
fi
printf "deployed:%s\n" "$(git rev-parse --short HEAD)" >> deploy.log
DEPLOY
chmod +x "$SEED/scripts/deploy-production.sh"
git -C "$SEED" add app.txt scripts/deploy-production.sh
git -C "$SEED" commit -m "Initial app" >/dev/null
git -C "$SEED" branch -M main
git -C "$SEED" push -u origin main >/dev/null 2>&1
git --git-dir="$ORIGIN" symbolic-ref HEAD refs/heads/main

git clone "$ORIGIN" "$WORK" >/dev/null 2>&1
LOG_FILE="$WORK/watch-deploy.log"
printf "stale watcher log\n" > "$LOG_FILE"

printf "version-two\n" > "$SEED/app.txt"
touch "$SEED/fail-deploy"
git -C "$SEED" add app.txt fail-deploy
git -C "$SEED" commit -m "Failing update" >/dev/null
git -C "$SEED" push >/dev/null 2>&1

WATCH_REPO_DIR="$WORK" \
WATCH_INTERVAL_SECONDS=1 \
WATCH_DEPLOY_COMMAND="sh scripts/deploy-production.sh" \
WATCH_LOCK_DIR="$TMP_DIR/watch.lock" \
WATCH_LOG_FILE="$LOG_FILE" \
  sh "$WATCH_SCRIPT" > "$TMP_DIR/watch.stdout" 2>&1 &
WATCH_PID=$!

attempt=0
while [ "$attempt" -lt 20 ] && ! grep -q "Deploy failed with status 42" "$LOG_FILE"; do
  attempt=$((attempt + 1))
  sleep 1
done

if ! kill -0 "$WATCH_PID" 2>/dev/null; then
  echo "Watcher stopped after a failed deploy" >&2
  cat "$TMP_DIR/watch.stdout" >&2
  exit 1
fi

if grep -q "stale watcher log" "$LOG_FILE"; then
  echo "Watcher did not clear the previous log" >&2
  cat "$LOG_FILE" >&2
  exit 1
fi

printf "version-three\n" > "$SEED/app.txt"
git -C "$SEED" add app.txt
git -C "$SEED" commit -m "Successful update" >/dev/null
git -C "$SEED" push >/dev/null 2>&1

attempt=0
while [ "$attempt" -lt 20 ] && [ ! -f "$WORK/deploy.log" ]; do
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$(cat "$WORK/app.txt")" != "version-three" ]; then
  echo "Watcher did not pull the update after a failed deploy" >&2
  cat "$TMP_DIR/watch.stdout" >&2
  exit 1
fi

if [ "$(wc -l < "$WORK/deploy.log" | tr -d ' ')" != "1" ]; then
  echo "Watcher did not complete exactly one successful deploy" >&2
  cat "$TMP_DIR/watch.stdout" >&2
  exit 1
fi

if grep -q "Deploy failed" "$LOG_FILE" || ! grep -q "Deploy finished" "$LOG_FILE"; then
  echo "Watcher did not reset the log for the successful deploy" >&2
  cat "$LOG_FILE" >&2
  exit 1
fi

echo "watch deploy test passed"
