#!/usr/bin/env bash
# #123 s3 burst (decisions §116): the #94 Step 4a burst (../2026-10-10_94-tools/burst-rg-git.sh)
# with one deviation: every rg loop excludes node_modules. Same 6 read-only loops (4 rg, 2 git
# log), DURATION seconds, then it stops itself and exits once every loop has ended.
# A preflight lists the files the rg loops would read and refuses to start (exit 3) if any
# lies under node_modules. git log reads only the object store, never the working tree.
# Usage: burst-rg-git-no-node-modules.sh <logFile> [durationSeconds=180]
LOG=$1; DURATION=${2:-180}
REPO=/c/Users/pedro/Documents/GitHub/slopstop
RG_ARGS=(-n --no-ignore --glob '!**/node_modules/**' "Effect" "$REPO")
FILES=$(rg --files --no-ignore --glob '!**/node_modules/**' "$REPO" | wc -l)
UNDER=$(rg --files --no-ignore --glob '!**/node_modules/**' "$REPO" | rg -c -i 'node_modules')
echo "preflight files ${FILES} under-node_modules ${UNDER:-0}" >> "$LOG"
if [ "${UNDER:-0}" != "0" ]; then echo "preflight refused" >> "$LOG"; exit 3; fi
END=$(( $(date +%s) + DURATION ))
echo "burst start utc $(date -u +%FT%T.%3NZ) duration ${DURATION}s" >> "$LOG"
loop_rg() { while [ "$(date +%s)" -lt "$END" ]; do rg "${RG_ARGS[@]}" > /dev/null 2>&1; echo "rg$1 pass $(date -u +%T)" >> "$LOG"; done; }
loop_git() { while [ "$(date +%s)" -lt "$END" ]; do git -C "$REPO" log --stat -200 > /dev/null 2>&1; echo "git$1 pass $(date -u +%T)" >> "$LOG"; done; }
for i in 1 2 3 4; do loop_rg $i & done
for i in 1 2; do loop_git $i & done
wait
echo "burst end utc $(date -u +%FT%T.%3NZ)" >> "$LOG"
