# #123 s7 scoped mutation, final rerun — PASSED under the declared equivalents

- Coordinator option (b) for `workspace-bridge.ts:101` (decisions log §137): commit **`03a50c8`** (tree `f5e91866dfe0e6f6e6ff67edca2cc4b8462619da`) moves the stopped text into `faultText`'s `unsent` arm, which is still its one owner. No assertion changed. Its binding: the row `answers the stopped text for a request made after stop` fails when the text is emptied, and the file restores MATCH (`../2026-10-20_123-s7-kill/bind-m101b.log`). The s7 range for the file is now `:101-271` (`k12-check-101.log`: OK). Gates on `f5e91866`: `pnpm check` (3 264 tests, check:effect 50 = base), typecheck, dead-code and duplicates pass, s7 unit 327/327, CodeScene 10 (`../2026-10-20_123-s7-kill/gate-*.log`; the `f88f3a3` runs are kept as `*-f88f3a3.log`).
- Run: backups (scratchpad `s7-mutation3-backup`, `SHA256SUMS`); CPU 23.1/25.2/27.8; alone. 2 min 34 s, exit 0, dry run 327 tests. No timeout, no error, no Defender alert. Afterwards all nine sources match the backup (`after-run.txt`).

## Result

- Score **97.76**. **447 mutants: 436 Killed, 10 Survived, 0 Timeout, 0 NoCoverage, 1 Ignored** (`non-killed.txt`).
- `workspace-bridge.ts` (formerly `:101`): Killed.
- **Every non-killed mutant is allowed:**
  - the static Ignored at `project-storage-bridge.ts:38`;
  - the 10 declared equivalents E1-E9 in `../2026-10-20_123-s7-mutation-2/README.md`.

  In this file the workspace lines of E6, E8 and E9 are `:141`, `:170`, `:181` and `:261`; they moved with the restructure, and the code is the same.
- The all-killed rule therefore holds with the declared list, which is still awaiting the coordinator's verification.
