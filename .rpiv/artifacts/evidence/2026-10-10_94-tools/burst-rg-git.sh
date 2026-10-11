#!/usr/bin/env bash
# #94 Step 4a synthetic burst: read-only rg and git loops for DURATION seconds, then stops itself.
# Usage: burst-rg-git.sh <logFile> [durationSeconds=180]
LOG=$1; DURATION=${2:-180}
REPO=/c/Users/pedro/Documents/GitHub/slopstop
END=$(( $(date +%s) + DURATION ))
echo "burst start utc $(date -u +%FT%T.%3NZ) duration ${DURATION}s" >> "$LOG"
loop_rg() { while [ "$(date +%s)" -lt "$END" ]; do rg -n --no-ignore "Effect" "$REPO" > /dev/null 2>&1; echo "rg$1 pass $(date -u +%T)" >> "$LOG"; done; }
loop_git() { while [ "$(date +%s)" -lt "$END" ]; do git -C "$REPO" log --stat -200 > /dev/null 2>&1; echo "git$1 pass $(date -u +%T)" >> "$LOG"; done; }
for i in 1 2 3 4; do loop_rg $i & done
for i in 1 2; do loop_git $i & done
wait
echo "burst end utc $(date -u +%FT%T.%3NZ)" >> "$LOG"
