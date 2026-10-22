# #123 combined normal-slice mutation, run 3 — STOPPED on non-killed mutants

- Coordinator option (a2) (decisions log §139): the mutation-only `testNamePattern` skips the two rows that run the real canary on the real tree, `runs the canary before any package: real canary` and `passes on the repository` (commit `1a2d2ce`, tree `706d2c277e43498be4c3da48f6ca6a77079af430`). `pnpm check` keeps both. A local run of the mutation config showed exactly those 2 skipped and the other 30 passing.
- Run: backups (scratchpad `combined-mutation3-backup`, `SHA256SUMS`); CPU 6.7/4.2/2.0, alone. Same `--mutate` ranges (`run-meta.txt`). The dry run passed (491 tests, 1 min 30 s). Done in 7 min 11 s; Stryker exit 1, because 79.12 is under its own break threshold of 80. No error after the dry run, no Defender alert.
- Afterwards all five sources and both configs match the backup (`after-run.txt`).

## Result

- Score **79.12**. **258 mutants: 191 Killed, 6 Timeout (count as killed), 37 Survived, 15 NoCoverage, 9 Ignored (static).**

| File | Killed | Timeout | Survived | NoCoverage | Ignored |
| --- | --- | --- | --- | --- | --- |
| `check-effect-diagnostics.mjs` | 105 | 0 | 26 | 13 | 5 |
| `project-storage-node-errors.ts` | 58 | 6 | 9 | 2 | 4 |
| `project-storage-upgrade-node-adapter.ts:558-564` | 7 | 0 | 2 | 0 | 0 |
| `registration-registry.ts:182-200` (s4) | 13 | 0 | 0 | 0 | 0 |
| `registry-database.ts:79-90` (s4) | 8 | 0 | 0 | 0 | 0 |

- The rule fails, so I stopped: no rerun, no test edit, no triage. The full list is in `non-killed.txt` (file:line:col, status, mutator, replacement, source line).
- The s4 ranges are all killed. The non-killed mutants are in the s2 files and the s5b gate script; for the gate script, some `checkCanary` ones may sit on paths only the two skipped real-canary rows reach (not verified).
