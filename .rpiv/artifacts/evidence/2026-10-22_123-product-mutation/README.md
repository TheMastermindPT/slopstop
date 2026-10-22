# #123 combined mutation, product rerun — STOPPED: one survivor outside the declared list

- Decision: Pedro "Produto agora, gate depois" (decisions log §139). The gate-script mutants are a named residual in issue #139 and are not touched here.
- Kill commit **`1796bcc`** (tree `826d7f2e67e666c085c0dca8f58f3424abfe851a`). Its rows, bindings and gates are in `../2026-10-22_123-product-kill/`:
  - `reads an error code only from an object, never from a function`: kills `:7:7` ×2 and the `:7` `&&` mutant;
  - `knows a busy storage error, directly or by its cause: $name`: kills `:57` ×2, `:61` and `:63`;
  - `keeps the marker failure's cause: $name` (adapter unit rows): kills `:560` and `:561`;
  - restructure: `isBusyStorageError` drops `error.cause !== undefined &&`, which removes the `:62` mutants;
  - 9 bindings, each failing its row and restored with sha256 and tree MATCH;
  - gates: `pnpm check` 3 281 tests, typecheck, dead-code and duplicates pass, and CodeScene 10 on the three changed files.
- Rerun: backups (scratchpad `product-mutation-backup`); CPU 12.6/9.6/3.5, alone. `--mutate` limited to the product ranges: `project-storage-node-errors.ts`, `project-storage-upgrade-node-adapter.ts:558-564`, `registry-database.ts:79-90`, `registration-registry.ts:182-200`. The dry run passed (468 tests); the run took 7 min 1 s, exit 0. Afterwards the sources match the backup.

## Result

- Score **97.03**. **105 mutants: 93 Killed, 5 Timeout, 2 Survived, 1 NoCoverage, 4 Ignored (static).**
- The adapter, `registry-database.ts` and `registration-registry.ts` are all killed.
- The remaining mutants in `project-storage-node-errors.ts`:
  - `:7:42` ConditionalExpression `input.error === null` → `false`: declared equivalent (D1 below);
  - `:11:11` NoCoverage BlockStatement, `catch` → `{}`: declared equivalent (D2 below);
  - **`:10:12` ConditionalExpression `typeof code === "string" ? code : undefined` → `true`: Survived. It is NOT in my declared list, so I stopped.** In run 3 the same mutant was a `Timeout` (`../2026-10-22_123-combined-mutation-3/mutation.json.txt`), so it counted as detected there; here it ran to the end and survived. No test gives a non-string `code`. It looks killable by a row with a numeric code (for example `{ code: 5 }`, where the mutant reaches `code?.startsWith` on a number and throws). Not done: the rule says stop.
  - `:21` ×4 Ignored: the static `Set` literal (`ignoreStatic`).

## Declared equivalents (2), for the coordinator's verification

| # | Mutant | Why no public-seam test can tell it apart |
| --- | --- | --- |
| D1 | `project-storage-node-errors.ts:7:42`, `input.error === null` → `false` | With the mutant, a `null` error goes on to `Reflect.get(null, "code")`. That throws a `TypeError` (Reflect.get requires an object), which the `catch` turns into `undefined`: the same answer as the guard. Every other input gives the same result whichever way this operand goes. |
| D2 | `project-storage-node-errors.ts:11:11`, the `catch` body `{ return undefined; }` → `{}` | With an empty catch, the function falls through to its end and returns `undefined` implicitly: the same value. It is also NoCoverage, because no input makes `Reflect.get` throw after the guard (it would need a throwing `code` getter). |
