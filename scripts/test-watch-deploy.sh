#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WATCH_SCRIPT="$ROOT_DIR/scripts/watch-deploy.sh"

if [ ! -f "$WATCH_SCRIPT" ]; then
  echo "Missing watcher script: $WATCH_SCRIPT" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

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
printf "deployed:%s\n" "$(git rev-parse --short HEAD)" >> deploy.log
DEPLOY
chmod +x "$SEED/scripts/deploy-production.sh"
git -C "$SEED" add app.txt scripts/deploy-production.sh
git -C "$SEED" commit -m "Initial app" >/dev/null
git -C "$SEED" branch -M main
git -C "$SEED" push -u origin main >/dev/null 2>&1
git --git-dir="$ORIGIN" symbolic-ref HEAD refs/heads/main

git clone "$ORIGIN" "$WORK" >/dev/null 2>&1
printf "local watcher log\n" > "$WORK/watch-deploy.log"

printf "version-two\n" > "$SEED/app.txt"
git -C "$SEED" add app.txt
git -C "$SEED" commit -m "Update app" >/dev/null
git -C "$SEED" push >/dev/null 2>&1

WATCH_REPO_DIR="$WORK" \
WATCH_ONCE=1 \
WATCH_INTERVAL_SECONDS=1 \
WATCH_DEPLOY_COMMAND="sh scripts/deploy-production.sh" \
WATCH_LOCK_DIR="$TMP_DIR/watch.lock" \
  sh "$WATCH_SCRIPT" > "$TMP_DIR/watch.log"

if [ "$(cat "$WORK/app.txt")" != "version-two" ]; then
  echo "Watcher did not pull the latest commit" >&2
  cat "$TMP_DIR/watch.log" >&2
  exit 1
fi

if [ "$(wc -l < "$WORK/deploy.log" | tr -d ' ')" != "1" ]; then
  echo "Watcher did not run deploy exactly once" >&2
  cat "$TMP_DIR/watch.log" >&2
  exit 1
fi

if ! grep -q "Deploy finished" "$TMP_DIR/watch.log"; then
  echo "Watcher did not report a finished deploy" >&2
  cat "$TMP_DIR/watch.log" >&2
  exit 1
fi

echo "watch deploy test passed"
