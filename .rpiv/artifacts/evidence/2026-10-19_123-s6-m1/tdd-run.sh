#!/usr/bin/env bash
# #123 s6 fix-round run helper (copied unchanged into round 2). Usage: tdd-run.sh <log-name> <command...>
# Runs the command from the worktree root and writes <log-name>.log beside this script with a
# header: parent commit, working-tree identities, command and start time.
# - digest: the round-1 formula (sha256, first 16 hex, of `git diff --binary HEAD` plus one
#   `path hash-object` line per untracked file, both excluding .rpiv). It changes when a new
#   file is staged (S6-K15), so it is kept for comparison only.
# - tree: the identity used in this round. A temporary index starts from HEAD and takes every
#   working-tree change except .rpiv/artifacts/evidence; `git write-tree` names it. Staging
#   does not move it, and it equals the commit's tree once exactly those changes are committed.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(git -C "$HERE" rev-parse --show-toplevel)
NAME=$1; shift
cd "$ROOT"
DIGEST=$({ git diff --binary HEAD -- . ':(exclude).rpiv'
  git ls-files --others --exclude-standard -- . ':(exclude).rpiv' | sort | while read -r f; do
    echo "$f $(git hash-object "$f")"; done; } | sha256sum | cut -c1-16)
INDEX=$(mktemp)
GIT_INDEX_FILE=$INDEX git read-tree HEAD
GIT_INDEX_FILE=$INDEX git add -A -- . ':(exclude).rpiv/artifacts/evidence'
TREE=$(GIT_INDEX_FILE=$INDEX git write-tree)
rm -f "$INDEX"
LOG="$HERE/$NAME.log"
{
  echo "parent: $(git rev-parse --short HEAD)"
  echo "tree: $TREE"
  echo "working-tree digest: $DIGEST"
  echo "command: $*"
  echo "started: $(date -Iseconds)"
  echo "---"
} > "$LOG"
"$@" >> "$LOG" 2>&1
CODE=$?
echo "--- exit: $CODE" >> "$LOG"
echo "$NAME tree=${TREE:0:16} digest=$DIGEST exit=$CODE"
