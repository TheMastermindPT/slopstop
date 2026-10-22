# #123 s8 scoped mutation — STOPPED on survivors

- GO: Pedro "Arranca" (decisions log §139). Rule: all killed, with no pre-declared exceptions.
- Code `3001364` (tree `37f295329be4dba4159facdbfa4f3755c270a3be`). The log header shows tree `7d09f541` because it also holds the committed evidence; outside `.rpiv` the code equals `3001364` (`after-run.txt`).
- Backups of `harness-supervisor.ts`, both s8 configs and `reports/mutation/` (scratchpad `s8-mutation-backup`, `SHA256SUMS`). CPU 5.5/4.0/4.3, alone. `pnpm exec stryker run stryker.desktop-s8.config.json`: 21 s, exit 0, dry run 37 tests. No timeout, no error, no Defender alert. Afterwards the source and configs match the backup.

## Result

- Score **86.96**. **69 mutants: 60 Killed, 9 Survived, 0 Timeout, 0 NoCoverage, 0 Ignored.**
- The rule fails, so I stopped: no rerun, no test edit, no triage. The list is in `non-killed.txt`:
  - `:185` (`if (this.#child === child) this.#child = undefined;` in the stop's `exit` handler): ConditionalExpression `false`, ConditionalExpression `true`, EqualityOperator `!==`;
  - `:411` (`stdout?.off("data", onStdout).off("end", finish).off("close", finish);` in `finish`): StringLiteral `"end"` → `""` (col 41) and `"close"` → `""` (col 60);
  - `:417` (`if (this.#observations.get(child) === observation) this.#observations.delete(child);` in `forget`): ConditionalExpression `false`, ConditionalExpression `true`, EqualityOperator `!==`, and CallExpression (the `delete` removed).
- All 9 are pre-s8 lines inside the mutated `#stopChild` / `#watchOutput` ranges. `drainOutput` and the new drain lines are all Killed.
