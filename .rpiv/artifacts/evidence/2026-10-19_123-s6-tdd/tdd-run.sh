#!/usr/bin/env bash
# #123 s6 TDD run helper. Usage: tdd-run.sh <log-name> <command...>
# Runs the command from the worktree root and writes <log-name>.log beside this script with a
# header: parent commit, working-tree digest, command and start time.
# Digest: the sha256 (first 16 hex) of `git diff --binary HEAD` plus one `path hash-object` line
# per untracked file, both excluding .rpiv (so the evidence logs themselves never move it).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(git -C "$HERE" rev-parse --show-toplevel)
NAME=$1; shift
cd "$ROOT"
DIGEST=$({ git diff --binary HEAD -- . ':(exclude).rpiv'
  git ls-files --others --exclude-standard -- . ':(exclude).rpiv' | sort | while read -r f; do
    echo "$f $(git hash-object "$f")"; done; } | sha256sum | cut -c1-16)
LOG="$HERE/$NAME.log"
{
  echo "parent: $(git rev-parse --short HEAD)"
  echo "working-tree digest: $DIGEST"
  echo "command: $*"
  echo "started: $(date -Iseconds)"
  echo "---"
} > "$LOG"
"$@" >> "$LOG" 2>&1
CODE=$?
echo "--- exit: $CODE" >> "$LOG"
echo "$NAME digest=$DIGEST exit=$CODE"
