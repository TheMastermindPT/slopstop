#!/usr/bin/env bash
# #123 s5b heavy runs on HEAD 8881a57 (code = 54d2e12), decisions §134: in sequence, stop at the first non-zero exit.
E=$(cd "$(dirname "$0")" && pwd); W=/c/Users/pedro/Documents/GitHub/slopstop-123
echo "head $(git -C $W rev-parse --short HEAD) cpu 8/6/6 start $(date -Iseconds)" > $E/t7.log
run() { name=$1; shift; echo "== $name start $(date -Iseconds) command: $*" >> $E/t7.log
  ( time "$@" </dev/null ) > $E/$name.log 2>&1; code=$?
  echo "== $name exit $code end $(date -Iseconds)" >> $E/t7.log; return $code; }
cd $W/apps/harness
run integration pnpm exec vitest run --config vitest.integration.config.ts &&
run registration pnpm exec vitest run --config vitest.registration.config.ts &&
run native-long pnpm exec vitest run --config vitest.native-long.config.ts &&
{ cd $W; run package-smoke pnpm package:smoke; }
echo "done $(date -Iseconds) head $(git -C $W rev-parse --short HEAD) tracked-changes [$(git -C $W status --short --untracked-files=no | tr '\n' ' ')]" >> $E/t7.log
