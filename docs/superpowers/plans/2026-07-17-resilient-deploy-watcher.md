# Resilient Deploy Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the deploy watcher alive after a failed deploy and reset its managed log whenever it detects a new remote commit.

**Architecture:** Extend the existing shell integration test to exercise two consecutive updates, with the first deploy failing. Keep logging inside `watch-deploy.sh`, truncate the configured log at the start of each detected update, and handle deploy-command failure inside the loop.

**Tech Stack:** POSIX shell, Git, existing temporary-repository integration test.

---

### Task 1: Reproduce failed-deploy watcher termination

**Files:**
- Modify: `scripts/test-watch-deploy.sh`
- Test: `scripts/test-watch-deploy.sh`

- [ ] **Step 1: Write the failing integration scenario**

Change the generated deploy script to fail when a marker exists and append successful deploys otherwise:

```sh
if [ -f fail-deploy ]; then
  rm fail-deploy
  exit 42
fi
printf "deployed:%s\n" "$(git rev-parse --short HEAD)" >> deploy.log
```

Run the watcher continuously in the background with `WATCH_LOG_FILE`, push a first commit containing `fail-deploy`, wait for its failure record, then push a second commit and wait for `deploy.log`.

- [ ] **Step 2: Run the test and verify RED**

Run: `sh scripts/test-watch-deploy.sh`

Expected: FAIL because `set -e` terminates the watcher after exit code 42 or because the watcher does not own and reset `WATCH_LOG_FILE`.

- [ ] **Step 3: Commit the regression test**

```bash
git add scripts/test-watch-deploy.sh
git commit -m "test: reproduce deploy watcher stopping on failure"
```

### Task 2: Manage log and survive deploy failures

**Files:**
- Modify: `scripts/watch-deploy.sh`
- Test: `scripts/test-watch-deploy.sh`

- [ ] **Step 1: Add managed logging**

Define:

```sh
LOG_FILE="${WATCH_LOG_FILE:-$REPO_DIR/watch-deploy.log}"

log() {
  message="$(printf "%s %s" "$(date '+%Y-%m-%d %H:%M:%S')" "$*")"
  printf "%s\n" "$message"
  printf "%s\n" "$message" >> "$LOG_FILE"
}
```

After detecting a changed remote SHA and before logging the detected commit, truncate with:

```sh
: > "$LOG_FILE"
```

- [ ] **Step 2: Handle deploy failure without exiting**

Replace the unguarded deploy invocation with:

```sh
if sh -c "$DEPLOY_COMMAND"; then
  log "Deploy finished"
else
  deploy_status=$?
  log "Deploy failed with status $deploy_status; watcher will continue"
fi
```

- [ ] **Step 3: Run the focused integration test**

Run: `sh scripts/test-watch-deploy.sh`

Expected: `watch deploy test passed`; the old log entry is absent, the first failure is recorded, and the second commit is deployed.

- [ ] **Step 4: Run repository verification**

Run:

```bash
npm run typecheck
npm run lint
npm test
```

Expected: typecheck and lint pass. Full tests have no new failures; the three known `NEXT_REDIRECT` failures remain accounted for separately if still present.

- [ ] **Step 5: Commit implementation**

```bash
git add scripts/watch-deploy.sh scripts/test-watch-deploy.sh
git commit -m "fix: keep deploy watcher alive after failures"
```
