#!/usr/bin/env bash
# #123 s5 heavy runs on 1ab1762 (decisions §130): in sequence, stop at the first non-zero exit.
E=$(cd "$(dirname "$0")" && pwd); W=/c/Users/pedro/Documents/GitHub/slopstop-123
echo "head $(git -C $W rev-parse --short HEAD) cpu 24/20/15 start $(date -Iseconds)" > $E/t7.log
run() { name=$1; shift; echo "== $name start $(date -Iseconds)" >> $E/t7.log
  ( time "$@" </dev/null ) > $E/$name.log 2>&1; code=$?
  echo "== $name exit $code end $(date -Iseconds)" >> $E/t7.log; return $code; }
cd $W/apps/harness
run integration pnpm exec vitest run --config vitest.integration.config.ts &&
run registration pnpm exec vitest run --config vitest.registration.config.ts &&
run native-long pnpm exec vitest run --config vitest.native-long.config.ts &&
{ cd $W; run launch-smoke pnpm package:launch-smoke; }
echo "done $(date -Iseconds) head $(git -C $W rev-parse --short HEAD) status [$(git -C $W status --short -- apps | tr '\n' ' ')]" >> $E/t7.log
