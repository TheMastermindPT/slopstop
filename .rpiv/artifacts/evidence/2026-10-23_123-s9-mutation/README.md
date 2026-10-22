# #123 s9 scoped mutation — STOPPED on 2 non-killed mutants (awaiting triage)

- GO: coordinator, Pedro's decision (only the s9 scoped mutation; test:integration, e2e and package:smoke dropped here, covered by check:deep before the push).
- Code `271b418` (tree `35a2ba243c54cce5935f45459a66ac89e74a561d`). Backup before the run: scratchpad `s9-mutation-backup` (558 tracked files, `SHA256SUMS`, tar). CPU 2/16/14 %, no League/TFT/overwolf process, alone.
- Command: `pnpm exec stryker run stryker.project-storage.config.json --mutate apps/harness/src/process-fatal-diagnostics.ts,apps/harness/src/process-shutdown.ts,apps/harness/src/process-connection.ts`. Dry run 25 tests (related). 47 s, exit 0, no error.
- After the run: every backed-up file matches its sha256; tracked tree clean at `271b418` (`after-run.txt`).

## Result

Score **98.48**. 137 mutants: **123 Killed, 7 Timeout (count as killed), 1 Survived, 1 NoCoverage, 5 Ignored** (`non-killed.txt`, `mutation.json.txt`).

| Mutant | Status | Why it lives | Killable? |
| --- | --- | --- | --- |
| `process-fatal-diagnostics.ts:69:10` `typeof tag === "string"` → `true` | Survived | `IDENTIFIER_TAG.test` coerces a non-string `_tag` to a string; no row has a non-string `_tag` whose string form is an identifier. E.g. `{ _tag: true }` would summarize as `{ tag: true }`, `{ _tag: ["Abc"] }` as `{ tag: ["Abc"] }`. Real gap, not equivalent. | Yes: one B1 row, e.g. `a non-string tag`: `{ _tag: true }` → `[{ kind: "object" }]`. |
| `process-fatal-diagnostics.ts:78:63` `: []` → `["Stryker was here"]` | NoCoverage | No row has a `RegistrationCleanupUnconfirmed` whose `parts` is not an array. | Yes: one B1 row, e.g. `parts not a list`: `{ _tag: "RegistrationCleanupUnconfirmed", parts: P }` → `[{ tag: "RegistrationCleanupUnconfirmed", parts: [] }]`. |
| `process-fatal-diagnostics.ts:60:24` × 5 Regex mutants of `IDENTIFIER_TAG` | Ignored | `ignoreStatic: true` (module-level constant), as in every earlier run of this config; not counted. | Not run. By reading: the `a non-identifier tag` rows (`P`, 65 characters, 64 characters) would kill the `^`/`$`-dropping and `{0,63}`-dropping variants. |

Nothing has been changed after the run. The two rows above are proposals for the coordinator's and Pedro's triage.
