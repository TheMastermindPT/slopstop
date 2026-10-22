# #123 Part A combined normal-slice mutation (s2, s4, s5b) — STOPPED: initial test run failed

- GO: Pedro "Arranca" (decisions log §139). The run plan was approved by the coordinator: one run limited with `--mutate` on `stryker.project-storage.config.json`.
- Steps done before the run:
  - **S5B-R2-6 pin**, commit `3b01560`: the row `directive under node_modules is ignored` in `keeps the waiver register exact: $name`. The fixture is `apps/sample/src/node_modules/x/a.ts`, not the brief's `apps/sample/node_modules/x/a.ts`, because the brief's path is never scanned: the scan reads each package's root-level files and its `src`, `tests` and `build` folders (`check-effect-diagnostics.mjs:220`, `:236-246`). Only a path inside a scanned folder reaches the `:242` exclusion (coordinator, §139).
    - Pin: `r2-6-pin.log`, 1 passed.
    - Binding: `:242` without the `node_modules` filter makes the row fail (`ok: false`, where `ok: true` was expected). The file is restored MATCH (`bind-r2-6-no-exclusion.log`). The assertion diff prints only `ok`; the failure code is in the "2 matching properties omitted" part.
    - The first attempt's `-t` matched no test, because Vitest truncates the long `$name` with "…" (`*-attempt1-nomatch.log`).
  - **Config**, commit `3f9fcfe` (tree `d7e58aa20e3fb3eebf04002957b4c87e71d98f79`), with ranges resolved by content on `4d22a65` (`config-check.log`: every path exists and every range is inside its file):
    - `project-storage-node-errors.ts` (whole file);
    - `project-storage-upgrade-node-adapter.ts:558-564` (`markerQueryFailure`; the brief's `:556-564`/`:558-564` covered the same function);
    - `registry-database.ts:79-90` (`stopStandaloneAuthority`, the s4 release);
    - `registration-registry.ts:182-200` (`stop`);
    - `check-effect-diagnostics.mjs`, unchanged since `010ee05`, so the brief's lines hold: `:19-22` (`failure`), `:41-63` (classification: `diagnosticAt`, `attachRule`, `parseDiagnostics`), `:157-175` (canary comparison), `:191` (`projects`), `:215-253` (register scan), `:256-262` (`incompleteEntries`);
    - includes added: `project-storage-node-registry.test.ts`, `project-storage-node-errors.test.ts`, `project-storage-upgrade-node-adapter.test.ts`, `project-storage-upgrade-steps.integration.test.ts` (T8), `registration-registry.test.ts`, `scripts/check-effect-diagnostics.test.mjs`.
- Run: backups of the five sources and both configs (scratchpad `combined-mutation-backup`, `SHA256SUMS`); CPU 3.7/3.8/2.3, alone. `pnpm exec stryker run stryker.project-storage.config.json --mutate <the ten ranges>`, 19:00:50-19:02:22 (`mutation.log`, `run-meta.txt`).

## Result: STOPPED, no mutant ran

- Stryker found the 5 files and instrumented 258 mutants. Then the **initial (dry) test run failed**, so Stryker ended with `ConfigError: There were failed tests in the initial test run.` (exit 1).
- The one failing test: `check-effect-diagnostics.test.mjs`, `runs the canary before any package: real canary`, `expected { ok: false, … } to match object { ok: true, canary: 'matched' }`.
- This row runs the real canary project through the real compiler binary. It passes in the normal `pnpm check` and in the plain Vitest run. It fails only inside Stryker's sandbox copy, where the script and its canary resolve from `.stryker-tmp/sandbox-…`. I did not diagnose it further (no rerun).
- No timeout, no Defender alert. Afterwards all five sources and both configs match the backup (`after-run.txt`). Stryker left its sandbox `.stryker-tmp/sandbox-T3hPRi` (git-ignored, kept for a diagnosis).
- No counts per config exist: nothing was mutated.
